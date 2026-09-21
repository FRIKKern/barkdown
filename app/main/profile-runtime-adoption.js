// Same-machine cold copy only. Caller must close legacy shell writers and keep
// the staged destination inactive. Never stops a process or selects a profile.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { acquireFileLease } = require('./file-lease');
const { validateDescriptor } = require('./profile-runtime');
const exec = promisify(execFile);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const payload = new Set(['pgdata', 'media', 'indx', 'bundles', 'seeded']);
const phases = new Set(['prepared', 'backed-up', 'copied', 'committed', 'rolled-back']);
async function digest(file) {
  const sum = crypto.createHash('sha256'); let size = 0;
  for await (const bytes of fs.createReadStream(file)) { sum.update(bytes); size += bytes.length; }
  return { size, sha256: sum.digest('hex') };
}
function safe(file) {
  for (let at = path.resolve(file); ; at = path.dirname(at)) {
    if (fs.existsSync(at) && fs.lstatSync(at).isSymbolicLink()) throw new Error('Linked adoption paths are unsupported');
    if (path.dirname(at) === at) break;
  }
  return file;
}
function child(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid adoption manifest path');
  return safe(path.join(root, relative));
}
function identity(dir) { const p = fs.realpathSync.native(safe(dir)); return process.platform === 'win32' ? p.toLowerCase() : p; }
function disjoint(a, b) { a = identity(a); b = identity(b); if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep)) throw new Error('Adoption source and destination must be disjoint'); }
function write(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'), temp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(safe(temp), 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, safe(file));
}
async function inventory(root, allowCopyResidue = false) {
  const files = [], dirs = [];
  async function walk(relative) {
    const file = child(root, relative), stat = await fsp.lstat(file);
    if (stat.isDirectory()) { dirs.push(relative); for (const name of (await fsp.readdir(file)).sort()) await walk(relative + '/' + name); }
    else if (stat.isFile()) files.push({ path: relative, ...await digest(file) });
    else throw new Error('Unsupported adoption payload entry');
  }
  for (const name of (await fsp.readdir(root)).sort()) {
    if (payload.has(name)) await walk(name);
    else if (allowCopyResidue && /^\.adoption-copy-[a-f0-9-]+\.tmp$/.test(name)) { /* interrupted private copy, retained */ }
    else if (!(name === 'runtime-build' || name === 'owner.json' || name === 'boot-ready' || name === 'server.log' || /^postgres-\d+\.log$/.test(name) || /^owner\.json\.abandoned-/.test(name))) throw new Error(`Unclassified runtime entry: ${name}`);
  }
  if (!files.some(f => f.path === 'pgdata/PG_VERSION') || !files.some(f => f.path === 'seeded')) throw new Error('Existing initialized and seeded runtime required');
  return { files, dirs };
}
async function copy(source, target, manifest, checkpoint) {
  for (const dir of manifest.dirs) await fsp.mkdir(child(target, dir), { recursive: true });
  for (const entry of manifest.files) {
    const original = child(source, entry.path);
    const file = child(target, entry.path);
    if (fs.existsSync(file)) {
      for (const candidate of [original, file]) { const value = await digest(candidate); if (value.sha256 !== entry.sha256 || value.size !== entry.size) throw new Error('Adoption payload or destination differs: ' + entry.path); }
    } else {
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const temp = child(target, '.adoption-copy-' + crypto.randomUUID() + '.tmp'), sum = crypto.createHash('sha256'); let size = 0;
      await pipeline(fs.createReadStream(original), new Transform({ transform(bytes, encoding, done) { sum.update(bytes); size += bytes.length; done(null, bytes); } }), fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
      if (sum.digest('hex') !== entry.sha256 || size !== entry.size) throw new Error('Adoption payload changed: ' + entry.path);
      const fd = await fsp.open(temp, 'r+'); try { await fd.sync(); } finally { await fd.close(); }
      await fsp.rename(temp, file);
    }
    checkpoint('file-copied');
  }
}
async function assertCold(dataDir, { pgBin } = {}) {
  safe(dataDir);
  const pgdata = child(dataDir, 'pgdata');
  if (fs.existsSync(child(pgdata, 'postmaster.pid'))) throw new Error('Database has a postmaster.pid; stop and inspect it before adoption');
  if ((await fsp.readdir(child(pgdata, 'pg_tblspc'))).length) throw new Error('External tablespaces are unsupported');
  const bin = pgBin || path.join(process.env.SCOOP || path.join(process.env.USERPROFILE, 'scoop'), 'apps/postgresql/current/bin');
  const options = { windowsHide: true, timeout: 15000, env: { ...process.env, LC_ALL: 'C', LANG: 'C' } };
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const version = (await fsp.readFile(child(pgdata, 'PG_VERSION'), 'utf8')).trim();
  const tool = await exec(path.join(bin, 'pg_controldata' + suffix), ['--version'], options);
  if (!new RegExp('PostgreSQL\\) ' + version.replaceAll('.', '\\.') + '(?:\\.|\\s|$)').test(tool.stdout)) throw new Error('PostgreSQL major version differs; upgrade is not adoption');
  const control = await exec(path.join(bin, 'pg_controldata' + suffix), [pgdata], options);
  if (!/^Database cluster state:\s+shut down\s*$/m.test(control.stdout)) throw new Error('Database is not cleanly shut down');
  try { await exec(path.join(bin, 'pg_ctl' + suffix), ['-D', pgdata, 'status'], options); throw new Error('Database is running'); }
  catch (error) { if (error.code !== 3) throw error; }
  return { major: version };
}
function createRuntimeAdoption({ registry, readSecrets, checkCold = assertCold, checkpoint = () => {} }) {
  if (!registry?.storeFor || typeof readSecrets !== 'function') throw new Error('Trusted registry and credential reader required');
  async function locked(profileId, fn) {
    const store = registry.storeFor(profileId), root = safe(store.storeDir);
    const lock = acquireFileLease(path.join(path.dirname(path.dirname(root)), 'runtime-descriptors.lock'));
    try { return await fn(store); } finally { lock.release(); }
  }
  function receipt(store) {
    const value = store.readJson('runtime-adoption.json', null);
    if (!value) return null;
    if (value.version !== 1 || value.profileId !== store.profileId || !phases.has(value.phase) || typeof value.source !== 'string' || !path.isAbsolute(value.source) || !/^[a-f0-9]{64}$/.test(value.credentialsHash) || !Array.isArray(value.manifest?.files) || !Array.isArray(value.manifest?.dirs)) throw new Error('Malformed runtime adoption receipt');
    validateDescriptor(value.descriptor, store.profileId);
    const seen = new Set();
    for (const dir of value.manifest.dirs) child(store.storeDir, dir);
    for (const f of value.manifest.files) { child(store.storeDir, f.path); if (seen.has(f.path) || !payload.has(f.path.split('/')[0]) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Malformed runtime adoption manifest'); seen.add(f.path); }
    return value;
  }
  async function adopt({ profileId, legacyDir, pgBin }) {
    return locked(profileId, async store => {
      const source = path.resolve(legacyDir), data = child(source, 'local-barkpark/default');
      disjoint(source, store.storeDir);
      let j = receipt(store);
      if (j && identity(j.source) !== identity(source)) throw new Error('Adoption belongs to another source');
      if (j?.phase === 'rolled-back') throw new Error('Adoption was rolled back; retained data requires explicit review');
      const dest = child(store.storeDir, 'local-barkpark/runtime');
      if (j?.phase === 'committed') {
        if (JSON.stringify(store.readJson('runtime.json', null)) !== JSON.stringify(j.descriptor)) throw new Error('Committed runtime descriptor changed');
        for (const marker of ['pgdata/PG_VERSION', 'seeded']) { const file = child(dest, marker); if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error('Committed adopted runtime data is missing; explicit recovery required'); }
        return { profileId, phase: j.phase, dataDir: dest, backupDir: child(store.storeDir, 'runtime-adoption-backup') };
      }
      if (!j && (store.readJson('runtime.json', null) || fs.existsSync(dest))) throw new Error('Destination runtime must be empty and inactive');
      const sourceLease = acquireFileLease(child(data, 'owner.json'), { busy: 'Source runtime is owned; close it before adoption' });
      try {
        await checkCold(data, { pgBin });
        const credentials = await fsp.readFile(child(source, 'local-credentials.json'));
        if (!credentials.equals(await fsp.readFile(child(store.storeDir, 'local-credentials.json')))) throw new Error('Staged credentials differ from source; no new credentials may be generated');
        const secrets = await readSecrets(store);
        if (!secrets?.password || !secrets?.token) throw new Error('Cannot unlock existing same-machine credentials');
        const config = JSON.parse(await fsp.readFile(child(source, 'settings.json'), 'utf8')).barkpark?.local;
        const descriptor = validateDescriptor({ version: 1, profileId, source: config?.source, port: config?.port, pgPort: config?.pgPort }, profileId);
        for (const p of registry.load().profiles) { if (p.id === profileId) continue; const other = registry.storeFor(p.id).readJson('runtime.json', null); if (other && [other.port, other.pgPort].some(port => port === descriptor.port || port === descriptor.pgPort)) throw new Error('Original media origin ports belong to another profile'); }
        const manifest = await inventory(data);
        if (!j) { j = { version: 1, profileId, phase: 'prepared', source, descriptor, credentialsHash: hash(credentials), manifest }; store.writeJson('runtime-adoption.json', j); checkpoint('adoption-prepared'); }
        if (JSON.stringify(manifest) !== JSON.stringify(j.manifest) || hash(credentials) !== j.credentialsHash || JSON.stringify(descriptor) !== JSON.stringify(j.descriptor)) throw new Error('Source changed since adoption began');
        const backup = child(store.storeDir, 'runtime-adoption-backup');
        await fsp.mkdir(backup, { recursive: true });
        await copy(data, backup, manifest, checkpoint);
        write(child(backup, 'manifest.json'), { version: 1, manifest, credentialsHash: j.credentialsHash, descriptor });
        // Encrypted original bytes are retained separately; no unlocked secret is persisted.
        const credentialsBackup = child(backup, 'local-credentials.json');
        if (!fs.existsSync(credentialsBackup)) await fsp.writeFile(credentialsBackup, credentials, { flag: 'wx', mode: 0o600 });
        else if (!(await fsp.readFile(credentialsBackup)).equals(credentials)) throw new Error('Credential backup changed');
        j.phase = 'backed-up'; store.writeJson('runtime-adoption.json', j); checkpoint('adoption-backed-up');
        await fsp.mkdir(dest, { recursive: true });
        const destLease = acquireFileLease(child(dest, 'owner.json'));
        try {
          await copy(backup, dest, manifest, checkpoint);
          await checkCold(data, { pgBin });
          await checkCold(dest, { pgBin });
          if (JSON.stringify(await inventory(data)) !== JSON.stringify(manifest)) throw new Error('Source changed during cold copy');
          if (JSON.stringify(await inventory(dest, true)) !== JSON.stringify(manifest)) throw new Error('Destination differs after cold copy');
          j.phase = 'copied'; store.writeJson('runtime-adoption.json', j); checkpoint('adoption-copied');
          store.writeJson('runtime.json', descriptor); checkpoint('descriptor-committed');
          j.phase = 'committed'; store.writeJson('runtime-adoption.json', j); checkpoint('adoption-committed');
        } finally { destLease.release(); }
        return { profileId, phase: j.phase, dataDir: dest, backupDir: backup };
      } finally { sourceLease.release(); }
    });
  }
  async function rollback({ profileId, pgBin }) {
    return locked(profileId, async store => {
      const j = receipt(store); if (!j) throw new Error('No runtime adoption to roll back');
      const dest = child(store.storeDir, 'local-barkpark/runtime');
      let lease;
      try {
        if (fs.existsSync(dest)) {
          lease = acquireFileLease(child(dest, 'owner.json'));
          if (fs.existsSync(child(dest, 'pgdata/postmaster.pid'))) throw new Error('Destination database has a postmaster.pid; rollback refused');
          // A partial pre-publication copy may not yet contain pg_control. It
          // never had runtime authority; retain it and retire only the receipt.
          if (['copied', 'committed'].includes(j.phase) || store.readJson('runtime.json', null) || fs.existsSync(child(store.storeDir, 'runtime-adoption-retired-descriptor.json'))) await checkCold(dest, { pgBin });
        }
        const descriptor = child(store.storeDir, 'runtime.json');
        if (fs.existsSync(descriptor)) {
          if (JSON.stringify(store.readJson('runtime.json')) !== JSON.stringify(j.descriptor)) throw new Error('Runtime descriptor changed; refusing rollback');
          fs.renameSync(descriptor, child(store.storeDir, 'runtime-adoption-retired-descriptor.json'));
        }
        checkpoint('rollback-descriptor-retired');
        j.phase = 'rolled-back'; store.writeJson('runtime-adoption.json', j);
        return { source: j.source, retainedDataDir: dest, backupDir: child(store.storeDir, 'runtime-adoption-backup') };
      } finally { lease?.release(); }
    });
  }
  return Object.freeze({ adopt, rollback });
}
module.exports = { createRuntimeAdoption, assertCold, runtimeInventory: inventory };
