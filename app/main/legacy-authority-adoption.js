// Explicit same-machine authority adoption. This module never selects a global
// working folder, stops unknown processes, or silently seeds a replacement.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { pipeline } = require('node:stream/promises');
const { createProfileRegistry, validateProfileId } = require('./profile-registry');
const { createRuntimeAdoption, assertCold, runtimeInventory } = require('./profile-runtime-adoption');
const { acquireFileLease } = require('./file-lease');
const owners = new WeakMap();
const shellEntries = new Set(['workspace.json', 'settings.json', 'barkpark.json', 'local-credentials.json', 'paper-proposals.json', 'documents', 'attachments', 'agent-edits']);
const phases = new Set(['prepared', 'snapshotted', 'candidate', 'ready', 'activating', 'active', 'rolling-back', 'rolled-back']);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function safe(file) {
  for (let at = path.resolve(file); ; at = path.dirname(at)) {
    if (fs.existsSync(at) && fs.lstatSync(at).isSymbolicLink()) throw new Error('Linked authority paths are unsupported');
    if (path.dirname(at) === at) break;
  }
  return path.resolve(file);
}
function child(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid authority manifest path');
  return safe(path.join(root, relative));
}
const canonical = dir => { const value = fs.realpathSync.native(safe(dir)); return process.platform === 'win32' ? value.toLowerCase() : value; };
function disjoint(a, b) { a = path.resolve(a); b = path.resolve(b); if (process.platform === 'win32') { a = a.toLowerCase(); b = b.toLowerCase(); } if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep)) throw new Error('Source and authority staging paths must be disjoint'); }
function json(file) { return JSON.parse(fs.readFileSync(safe(file), 'utf8')); }
function write(file, value) {
  const temp = safe(file + '.' + crypto.randomUUID() + '.tmp');
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, safe(file));
}
async function digest(file) { const hash = crypto.createHash('sha256'); let size = 0; for await (const bytes of fs.createReadStream(safe(file))) { hash.update(bytes); size += bytes.length; } return { size, sha256: hash.digest('hex') }; }
function acquireAuthorityLease(userData) {
  const root = safe(userData); fs.mkdirSync(root, { recursive: true });
  const rootStat = fs.statSync(root), rootIdentity = canonical(root);
  const lockPath = child(root, 'workspace-owner.json'), lock = acquireFileLease(lockPath, { busy: 'This workspace is owned by another Barkdown process' });
  let released = false;
  const token = Object.freeze({
    assertOwned() { if (released) throw new Error('Workspace ownership was released'); const currentRoot = fs.statSync(safe(root)); if (!currentRoot.isDirectory() || currentRoot.dev !== rootStat.dev || currentRoot.ino !== rootStat.ino || canonical(root) !== rootIdentity) throw new Error('Workspace authority root was replaced'); const current = json(lockPath); if (current.pid !== process.pid || current.lease !== lock.lease) throw new Error('Workspace ownership changed'); },
    release() { if (released) return; lock.release(); released = true; },
  });
  owners.set(token, canonical(root));
  return token;
}
async function shellInventory(root) {
  const files = [], dirs = [];
  async function walk(relative) {
    const file = child(root, relative), stat = await fsp.lstat(file);
    if (stat.isDirectory()) { dirs.push(relative); for (const name of (await fsp.readdir(file)).sort()) await walk(relative + '/' + name); }
    else if (stat.isFile()) { if (/\.(lock|tmp)$/.test(relative)) throw new Error('Legacy shell has pending writes'); files.push({ path: relative, ...await digest(file) }); }
    else throw new Error('Unsupported legacy shell entry');
  }
  let runtime = false;
  for (const name of (await fsp.readdir(root)).sort()) {
    if (name === 'local-barkpark') {
      const local = child(root, name); const entries = await fsp.readdir(local);
      if (entries.length !== 1 || entries[0] !== 'default') throw new Error('Unclassified legacy runtime layout');
      safe(path.join(local, 'default')); runtime = true;
    } else { if (!shellEntries.has(name)) throw new Error('Unclassified legacy shell entry: ' + name); await walk(name); }
  }
  if (!files.some(f => f.path === 'workspace.json')) throw new Error('Existing legacy workspace is required');
  return { files, dirs, runtime };
}
async function snapshot(source, target, manifest, tempRoot, checkpoint) {
  await fsp.mkdir(target, { recursive: true }); await fsp.mkdir(tempRoot, { recursive: true });
  for (const dir of manifest.dirs) await fsp.mkdir(child(target, dir), { recursive: true });
  for (const file of manifest.files) {
    const from = child(source, file.path), to = child(target, file.path);
    const current = await digest(from); if (current.size !== file.size || current.sha256 !== file.sha256) throw new Error('Legacy shell changed: ' + file.path);
    if (fs.existsSync(to)) { const existing = await digest(to); if (existing.sha256 !== file.sha256 || existing.size !== file.size) throw new Error('Shell backup differs: ' + file.path); }
    else {
      await fsp.mkdir(path.dirname(to), { recursive: true });
      const temp = child(tempRoot, crypto.randomUUID() + '.tmp');
      await pipeline(fs.createReadStream(from), fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
      const copied = await digest(temp); if (copied.sha256 !== file.sha256 || copied.size !== file.size) throw new Error('Legacy shell changed during copy');
      const fd = await fsp.open(temp, 'r+'); try { await fd.sync(); } finally { await fd.close(); }
      await fsp.rename(temp, to);
    }
    checkpoint('shell-file-copied');
  }
}
function createLegacyAdoption({ userData, ownership, readSecrets, checkCold = assertCold, checkpoint = () => {} }) {
  const root = fs.realpathSync.native(safe(userData)), finalRoot = child(root, 'profile-data'), journalPath = child(root, 'legacy-adoption.json');
  const own = () => { if (!ownership || !fs.existsSync(root) || owners.get(ownership) !== canonical(root)) throw new Error('A bound workspace authority lease is required'); ownership.assertOwned(); };
  function paths(j) { const work = child(root, 'legacy-adoption-work/' + j.operationId); return { work, snapshot: child(work, 'shell-original'), candidate: child(work, 'candidate-registry'), retired: child(work, 'retired-registry'), temp: child(work, 'copy-temp') }; }
  function readJournal() {
    if (!fs.existsSync(journalPath)) return null;
    const j = json(journalPath);
    if (j.version !== 1 || !phases.has(j.phase) || typeof j.source !== 'string' || !path.isAbsolute(j.source) || j.finalRoot !== finalRoot || typeof j.name !== 'string' || !j.name.trim() || !Array.isArray(j.manifest?.files) || !Array.isArray(j.manifest?.dirs) || typeof j.manifest.runtime !== 'boolean') throw new Error('Invalid legacy authority journal');
    validateProfileId(j.operationId); if (j.profileId !== null) validateProfileId(j.profileId);
    if (['ready', 'activating', 'active', 'rolling-back', 'rolled-back'].includes(j.phase) && !/^[a-f0-9]{64}$/.test(j.readyHash)) throw new Error('Authority readiness checksum is missing');
    const seen = new Set();
    for (const dir of j.manifest.dirs) { child(root, dir); if (!shellEntries.has(dir.split('/')[0])) throw new Error('Invalid shell manifest directory'); }
    for (const f of j.manifest.files) { child(root, f.path); if (seen.has(f.path) || !shellEntries.has(f.path.split('/')[0]) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid shell manifest file'); seen.add(f.path); }
    disjoint(j.source, finalRoot); disjoint(j.source, paths(j).work); safe(j.source);
    return j;
  }
  function marker(j, location) {
    if (!fs.existsSync(location)) throw new Error('Published authority root is missing');
    const markerPath = child(location, 'legacy-authority.json'), bytes = fs.readFileSync(markerPath), value = JSON.parse(bytes);
    if (sha(bytes) !== j.readyHash) throw new Error('Authority readiness checksum differs');
    if (value.version !== 1 || value.operationId !== j.operationId || value.profileId !== j.profileId || value.finalRoot !== finalRoot || value.shellManifestHash !== sha(JSON.stringify(j.manifest))) throw new Error('Authority marker belongs to another or corrupt transaction');
    if (!Array.isArray(value.profileFiles)) throw new Error('Authority prepared-file manifest is missing');
    for (const file of value.profileFiles) { child(location, file.path); if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid prepared-file manifest'); }
    const registry = createProfileRegistry(location), data = registry.load();
    if (!data?.profiles.some(p => p.id === j.profileId)) throw new Error('Adopted profile is missing from authority');
    const store = registry.storeFor(j.profileId);
    if (!fs.existsSync(child(store.storeDir, 'workspace.json'))) throw new Error('Adopted workspace is missing');
    if (j.manifest.runtime) {
      const receipt = store.readJson('runtime-adoption.json', null), descriptor = store.readJson('runtime.json', null);
      if (!receipt || receipt.phase !== 'committed' || receipt.profileId !== j.profileId || JSON.stringify(receipt.descriptor) !== JSON.stringify(descriptor)) throw new Error('Adopted runtime authority is incomplete');
      for (const file of ['pgdata/PG_VERSION', 'seeded']) if (!fs.existsSync(child(store.storeDir, 'local-barkpark/runtime/' + file))) throw new Error('Adopted runtime data is missing');
    }
    return { registry, store };
  }
  async function verifyCandidate(j, location) {
    const result = marker(j, location), ready = json(child(location, 'legacy-authority.json'));
    for (const file of ready.profileFiles) { const value = await digest(child(location, file.path)); if (value.size !== file.size || value.sha256 !== file.sha256) throw new Error('Prepared profile file changed: ' + file.path); }
    if (j.manifest.runtime) {
      const receipt = result.store.readJson('runtime-adoption.json');
      if (JSON.stringify(await runtimeInventory(child(result.store.storeDir, 'local-barkpark/runtime'), true)) !== JSON.stringify(receipt.manifest)) throw new Error('Prepared runtime payload changed');
    }
    return result;
  }
  function inspect() {
    try {
      const j = readJournal();
      if (!j) return { status: 'none', finalRoot, actions: [] };
      const p = paths(j);
      if (j.phase === 'active') { marker(j, finalRoot); return { status: 'active', finalRoot, profileId: j.profileId, operationId: j.operationId, actions: ['rollback'] }; }
      if (j.phase === 'rolled-back') {
        if (fs.existsSync(finalRoot)) throw new Error('Rolled-back authority unexpectedly exists');
        marker(j, p.retired);
        if (!fs.existsSync(j.source)) throw new Error('Original legacy workspace is missing');
        return { status: 'rolled-back', finalRoot, legacyRoot: j.source, profileId: j.profileId, operationId: j.operationId, retainedRoot: p.retired, actions: [] };
      }
      if (fs.existsSync(finalRoot)) { if (j.phase !== 'activating' && j.phase !== 'rolling-back') throw new Error('Another registry occupies the final authority path'); marker(j, finalRoot); }
      return { status: ['activating', 'rolling-back'].includes(j.phase) ? 'activating' : 'staged', phase: j.phase, finalRoot, profileId: j.profileId, operationId: j.operationId, actions: j.phase === 'rolling-back' ? ['rollback'] : ['ready', 'activating'].includes(j.phase) ? ['activate'] : ['resume'] };
    } catch (error) { return { status: 'blocked', finalRoot, error: error.message, actions: [] }; }
  }
  async function transition(fn) {
    own(); const lock = acquireFileLease(child(root, 'legacy-adoption-operation.lock'));
    try { return await fn(); } finally { lock.release(); }
  }
  async function unchanged(j) { if (JSON.stringify(await shellInventory(j.source)) !== JSON.stringify(j.manifest)) throw new Error('Legacy shell changed since preparation'); }
  async function remap(j, store, snapshotRoot) {
    const finalStore = path.join(finalRoot, 'profiles', j.profileId), changes = [];
    const mappings = j.manifest.files.filter(f => f.path.startsWith('attachments/')).flatMap(f => {
      const from = path.join(j.source, ...f.path.split('/')), to = path.join(finalStore, ...f.path.split('/'));
      return [[from, to], [from.replaceAll('\\', '/'), to.replaceAll('\\', '/')], [pathToFileURL(from).href, pathToFileURL(to).href]];
    }).sort((a, b) => b[0].length - a[0].length);
    function strings(value, file) {
      if (typeof value === 'string') {
        let next = value;
        for (const [from, to] of mappings) {
          const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match the entire known owned filename, never a prefix of a missing
          // file such as picture.png-unresolved. URLs/Markdown may wrap it.
          next = next.replace(new RegExp(escaped + '(?=$|[\\s)\\]}"\'<>?#])', process.platform === 'win32' ? 'gi' : 'g'), () => to);
        }
        if (next !== value) changes.push({ file, beforeHash: sha(value), afterHash: sha(next) });
        // Any remaining old owned attachment prefix is an unresolved reference,
        // not permission to fall back to retained originals.
        const roots = [path.join(j.source, 'attachments'), path.join(j.source, 'attachments').replaceAll('\\', '/'), pathToFileURL(path.join(j.source, 'attachments')).href];
        if (roots.some(prefix => next.toLowerCase().includes(prefix.toLowerCase()))) throw new Error('Unresolved owned attachment reference in ' + file);
        return next;
      }
      if (Array.isArray(value)) return value.map(v => strings(v, file));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, strings(v, file)]));
      return value;
    }
    for (const file of j.manifest.files) {
      if (!file.path.endsWith('.json') && !file.path.endsWith('.md')) continue;
      if (file.path.startsWith('attachments/')) continue;
      const sourceBytes = await fsp.readFile(child(snapshotRoot, file.path));
      if (file.path.endsWith('.json')) {
        let value = JSON.parse(sourceBytes);
        // Match C003's app-wide appearance split; never copy it back into profile settings.
        if (file.path === 'settings.json') for (const key of ['theme', 'sidebarWidth', 'chatWidth', 'windowBounds']) delete value[key];
        const beforeCount = changes.length; value = strings(value, file.path);
        if (file.path === 'workspace.json') {
          for (const chat of Object.values(value.chats || {})) {
            if (chat.busy || chat.running || chat.runId) throw new Error('Legacy workspace records an unfinished run; explicit interruption reconciliation required');
          }
        }
        if (changes.length !== beforeCount) store.writeJson(file.path, value);
      } else {
        const output = strings(sourceBytes.toString('utf8'), file.path), target = child(store.storeDir, file.path);
        if (output !== sourceBytes.toString('utf8')) { const tmp = target + '.' + crypto.randomUUID() + '.tmp'; await fsp.writeFile(tmp, output, { flag: 'wx' }); await fsp.rename(tmp, target); }
      }
      checkpoint('reference-file-remapped');
    }
    for (const file of j.manifest.files.filter(f => f.path.startsWith('attachments/'))) {
      const value = await digest(child(store.storeDir, file.path)); if (value.sha256 !== file.sha256 || value.size !== file.size) throw new Error('Owned attachment copy differs');
    }
    write(child(store.storeDir, 'legacy-reference-map.json'), { version: 1, originalRoot: j.source, finalRoot: finalStore, changes });
  }
  async function prepare({ legacyDir = path.join(root, 'barkdown'), name = 'Personal' } = {}) {
    return transition(async () => {
      let j = readJournal();
      if (j?.phase === 'active') { const result = inspect(); if (result.status !== 'active') throw new Error(result.error); return result; }
      if (j && ['activating', 'rolling-back', 'rolled-back'].includes(j.phase)) throw new Error('Authority transition needs explicit recover action');
      if (fs.existsSync(finalRoot)) throw new Error('Existing profile-data is never overwritten by legacy adoption');
      const source = fs.realpathSync.native(safe(legacyDir));
      if (j && canonical(source) !== canonical(j.source)) throw new Error('Adoption belongs to another legacy source');
      if (!j) {
        disjoint(source, finalRoot); disjoint(source, child(root, 'legacy-adoption-work'));
        if (typeof name !== 'string' || !name.trim()) throw new Error('Profile name is required');
        const manifest = await shellInventory(source);
        j = { version: 1, operationId: crypto.randomUUID(), phase: 'prepared', source, finalRoot, name: name.trim(), profileId: null, manifest };
        write(journalPath, j); checkpoint('authority-prepared');
      }
      await unchanged(j); const p = paths(j);
      await snapshot(j.source, p.snapshot, j.manifest, p.temp, checkpoint);
      write(child(p.work, 'shell-manifest.json'), { version: 1, source: j.source, manifest: j.manifest });
      j.phase = 'snapshotted'; write(journalPath, j); checkpoint('authority-snapshotted');
      const registry = createProfileRegistry(p.candidate, { checkpoint: phase => checkpoint('registry-' + phase) });
      const profile = registry.adoptLegacy({ legacyDir: p.snapshot, name: j.name });
      if (j.profileId && j.profileId !== profile.id) throw new Error('Candidate profile identity changed');
      j.profileId = profile.id; j.phase = 'candidate'; write(journalPath, j); checkpoint('authority-candidate');
      const store = registry.storeFor(j.profileId);
      if (j.manifest.runtime) await createRuntimeAdoption({ registry, readSecrets, checkCold, checkpoint: phase => checkpoint('runtime-' + phase) }).adopt({ profileId: j.profileId, legacyDir: j.source });
      else if (store.readJson('settings.json', {}).barkpark?.local?.enabled) throw new Error('Enabled legacy runtime is missing; adoption will not seed a replacement');
      await remap(j, store, p.snapshot);
      await unchanged(j); own();
      const profileFiles = [];
      for (const file of [...j.manifest.files.map(f => f.path), 'legacy-reference-map.json', ...(j.manifest.runtime ? ['runtime.json', 'runtime-adoption.json'] : [])]) { const relative = 'profiles/' + j.profileId + '/' + file; profileFiles.push({ path: relative, ...await digest(child(p.candidate, relative)) }); }
      write(child(p.candidate, 'legacy-authority.json'), { version: 1, operationId: j.operationId, profileId: j.profileId, finalRoot, shellManifestHash: sha(JSON.stringify(j.manifest)), profileFiles });
      j.readyHash = sha(fs.readFileSync(child(p.candidate, 'legacy-authority.json')));
      marker(j, p.candidate);
      j.phase = 'ready'; write(journalPath, j); checkpoint('authority-ready');
      return inspect();
    });
  }
  async function recover({ action } = {}) {
    if (action === 'resume') { const j = readJournal(); if (!j) throw new Error('No adoption to resume'); return prepare({ legacyDir: j.source, name: j.name }); }
    return transition(async () => {
      const j = readJournal(); if (!j) throw new Error('No legacy authority transition exists');
      const p = paths(j);
      if (action === 'activate') {
        if (j.phase === 'active') { const result = inspect(); if (result.status !== 'active') throw new Error(result.error); return result; }
        if (!['ready', 'activating'].includes(j.phase)) throw new Error('Candidate is not ready for activation');
        if (fs.existsSync(finalRoot)) {
          if (j.phase !== 'activating' || fs.existsSync(p.candidate)) throw new Error('Another registry occupies the final authority path');
          marker(j, finalRoot);
        } else {
          const { store } = await verifyCandidate(j, p.candidate); await unchanged(j); let sourceLease;
          try {
            if (j.manifest.runtime) {
              const data = child(j.source, 'local-barkpark/default'); sourceLease = acquireFileLease(child(data, 'owner.json')); await checkCold(data);
              const receipt = store.readJson('runtime-adoption.json');
              if (JSON.stringify(await runtimeInventory(data)) !== JSON.stringify(receipt.manifest)) throw new Error('Legacy runtime changed after staging; activation refused');
            }
            j.phase = 'activating'; write(journalPath, j); checkpoint('authority-activating'); own();
            if (fs.existsSync(finalRoot)) throw new Error('Final authority appeared during activation; refused');
            fs.renameSync(p.candidate, finalRoot); checkpoint('authority-renamed');
            marker(j, finalRoot);
          } finally { sourceLease?.release(); }
        }
        j.phase = 'active'; write(journalPath, j); checkpoint('authority-active');
        return inspect();
      }
      if (action === 'rollback') {
        if (j.phase === 'rolled-back') { const result = inspect(); if (result.status !== 'rolled-back') throw new Error(result.error); return result; }
        if (!['active', 'activating', 'rolling-back'].includes(j.phase)) throw new Error('Only published authority can roll back; private staging is retained for inspection');
        if (fs.existsSync(finalRoot)) {
          const { store } = marker(j, finalRoot); let runtimeLease;
          try {
            if (j.manifest.runtime) { const data = child(store.storeDir, 'local-barkpark/runtime'); runtimeLease = acquireFileLease(child(data, 'owner.json')); await checkCold(data); }
            if (fs.existsSync(p.retired)) throw new Error('Retired authority already exists; inspect before rollback');
            j.phase = 'rolling-back'; write(journalPath, j); checkpoint('authority-rolling-back'); own();
            if (fs.existsSync(p.retired)) throw new Error('Retired authority appeared during rollback; refused');
            runtimeLease?.prepareRelocation();
            fs.renameSync(finalRoot, p.retired);
            if (runtimeLease) runtimeLease.relocated(child(p.retired, 'profiles/' + j.profileId + '/local-barkpark/runtime/owner.json'));
            checkpoint('authority-retired');
          } finally { runtimeLease?.release(); }
        } else { if (j.phase !== 'rolling-back') throw new Error('Published authority is missing; no fallback to legacy'); marker(j, p.retired); }
        j.phase = 'rolled-back'; write(journalPath, j); checkpoint('authority-rolled-back');
        return inspect();
      }
      throw new Error('Unknown authority recovery action');
    });
  }
  return Object.freeze({ prepare, inspect, recover });
}
module.exports = { acquireAuthorityLease, createLegacyAdoption };
