// A portable export of one profile (P3): a logical database dump, the owned media and the
// profile's own files, taken while the profile is prepared and its runtime is held, so the three
// describe one state. Credentials and machine-bound files never leave; the manifest says so.
// Nothing here imports, activates or deletes anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createUpstreamAdmission, holdReconciled } = require('./upstream-admission');
const { createPaperEvidenceOwner } = require('./paper-evidence-owner');
const { createStore } = require('./store');
const { carried } = require('./media-origins');
const fail = (code, message, cause) => { throw Object.assign(new Error(message), { code: 'export_' + code, cause }); };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const KIND = 'barkdown-profile-export';
// Profile files that travel. Everything else in the store is either a credential, a
// machine-bound record (ports, writer and preparation state, caches) or the runtime itself,
// which travels as the dump and the media.
const STORE_FILES = ['workspace.json', 'selection.json', 'paper-proposals.json'];
const STORE_DIRS = ['documents', 'attachments', 'selection', 'paper-creation', 'paper-deletions', 'agent-edits'];
const NEVER = new Set(['agent-edits/paper-owner-key.json']);
const EXCLUDED = [
  { path: 'local-credentials.json', reason: 'runtime credentials are created on the importing machine' },
  { path: 'settings.json: apiKeyEncrypted, barkpark.tokenEncrypted', reason: 'OS-encrypted on this machine; re-enter after import' },
  { path: 'agent-edits/paper-owner-key.json', reason: 'navigation ownership is re-derived for the importing library' },
  { path: 'local-barkpark/', reason: 'the live database directory never travels; the logical dump does' },
  { path: 'runtime.json, barkpark.json, writer-*.json, profile-*.json, goal-processes/, canvas-bundle/', reason: 'machine-bound ports, fences and caches' },
];
function walk(root, relative = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) fail('link', 'Linked files are not exported: ' + rel);
    if (entry.isDirectory()) out.push(...walk(root, rel)); else if (entry.isFile()) out.push(rel);
  }
  return out;
}
function copyTree(sourceRoot, targetRoot, prefix, skip = () => false) {
  const files = [];
  if (!fs.existsSync(sourceRoot)) return files;
  for (const rel of walk(sourceRoot)) {
    const name = prefix + '/' + rel;
    if (skip(rel)) continue;
    const target = path.join(targetRoot, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, rel), target, fs.constants.COPYFILE_EXCL);
    files.push({ path: name, bytes: fs.statSync(target).size, sha256: sha(target) });
  }
  return files;
}
function sanitizedSettings(storeDir) {
  const file = path.join(storeDir, 'settings.json');
  if (!fs.existsSync(file)) return null;
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete settings.apiKeyEncrypted; delete settings.windowBounds;
  if (settings.barkpark) { delete settings.barkpark.tokenEncrypted; if (settings.barkpark.local) settings.barkpark.local = { enabled: Boolean(settings.barkpark.local.enabled) }; }
  return JSON.stringify(settings, null, 2) + '\n';
}
function createProfileExport({ registry, preparation, runtimePool, admission = createUpstreamAdmission(), upstreamRef = () => null, now = () => new Date().toISOString(), checkpoint = () => {}, countPapers = defaultCount }) {
  if (!registry?.storeFor || typeof preparation?.withPrepared !== 'function' || typeof runtimePool?.acquire !== 'function') throw new TypeError('Registry, preparation and runtime pool are required');
  async function exportProfile(profileId, destinationDir, { timeoutMs = 60000, operation = 'export-' + crypto.randomUUID() } = {}) {
    if (typeof destinationDir !== 'string' || !path.isAbsolute(destinationDir)) fail('destination', 'Choose an absolute folder for the export');
    if (fs.existsSync(destinationDir) && fs.readdirSync(destinationDir).length) fail('destination', 'The export folder must be new or empty; nothing is overwritten');
    const profile = registry.load()?.profiles?.find(p => p.id === profileId);
    if (!profile) fail('profile', 'Unknown profile');
    const storeDir = registry.storeFor(profileId).storeDir;
    if (path.resolve(destinationDir).startsWith(path.resolve(storeDir) + path.sep)) fail('destination', 'The export cannot live inside the profile it exports');
    return preparation.withPrepared(profileId, async scope => {
      const lease = await runtimePool.acquire(profileId, { ownerId: 'profile-export', writes: false });
      try {
        if (!lease.data?.dump) fail('runtime', 'This profile has no owned runtime to export; enable its local runtime first');
        const target = { profileId, server: lease.connection.server, token: lease.connection.token, dataset: lease.connection.dataset || 'production' };
        checkpoint('hold:begin', { operation });
        const held = await holdReconciled(admission, target, operation, { timeoutMs });
        checkpoint('hold:held', { operation });
        let manifest, failure = null;
        try {
          await scope.assertCurrent();
          fs.mkdirSync(destinationDir, { recursive: true });
          const database = await lease.data.dump(path.join(destinationDir, 'database.dump'));
          checkpoint('after-dump', { operation });
          const media = copyTree(lease.data.mediaDir, destinationDir, 'media');
          checkpoint('after-media', { operation });
          const store = [];
          for (const name of STORE_FILES) {
            const source = path.join(storeDir, name);
            if (!fs.existsSync(source)) continue;
            const targetFile = path.join(destinationDir, 'profile', name);
            fs.mkdirSync(path.dirname(targetFile), { recursive: true }); fs.copyFileSync(source, targetFile, fs.constants.COPYFILE_EXCL);
            store.push({ path: 'profile/' + name, bytes: fs.statSync(targetFile).size, sha256: sha(targetFile) });
          }
          for (const dir of STORE_DIRS) store.push(...copyTree(path.join(storeDir, dir), destinationDir, 'profile/' + dir, rel => NEVER.has(dir + '/' + rel)));
          const settings = sanitizedSettings(storeDir);
          if (settings) { const file = path.join(destinationDir, 'profile', 'settings.json'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, settings, { flag: 'wx' }); store.push({ path: 'profile/settings.json', bytes: Buffer.byteLength(settings), sha256: sha(file), sanitized: true }); }
          checkpoint('after-store', { operation });
          await scope.assertCurrent();
          // Navigation keys carry the owner of this library's connection; the import re-owns them.
          let owner = null; try { owner = createPaperEvidenceOwner(createStore(storeDir, { create: false })).identify({ server: target.server, token: target.token, dataset: target.dataset, viaCli: false }); } catch {}
          const counted = await countPapers(target), counts = typeof counted === 'number' ? { papers: counted } : { papers: counted.papers, drafts: counted.drafts };
          // Media addresses in notes carry the origin they were uploaded under; the import answers them from its own runtime.
          let former = []; try { former = createStore(storeDir, { create: false }).readJson('profile-import.json', null)?.mediaOrigins || []; } catch {}
          const runtime = { origin: target.server, formerOrigins: carried({ runtime: { origin: null, formerOrigins: former } }, target.server) };
          manifest = { version: 1, kind: KIND, exportedAt: now(), profile: { id: profile.id, name: profile.name }, upstream: upstreamRef(), runtime, navigation: { owner }, counts,
            seal: { operation, generation: held.generation, boot: held.boot },
            database: { path: 'database.dump', format: 'pg_dump custom', serverVersion: database.serverVersion, bytes: fs.statSync(database.file).size, sha256: sha(database.file) },
            media, store: store.sort((a, b) => a.path.localeCompare(b.path)), excluded: EXCLUDED };
          fs.writeFileSync(path.join(destinationDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
        } catch (error) { failure = error; }
        try { await admission.reopen(target, held.capability); checkpoint('hold:reopened', { operation }); }
        catch (error) { throw Object.assign(new Error('The runtime could not be reopened after the export and stays held for explicit recovery: ' + error.message), { code: error.code || 'upstream_reopen', cause: error, exportFailure: failure }); }
        if (failure) throw failure;
        return { destinationDir, manifest };
      } finally { await lease.release(); }
    });
  }
  return Object.freeze({ exportProfile, verifyExport });
}
// Re-read every exported file against the manifest. Says nothing about whether it imports.
const HOST_FILES = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*)$/i;
// Manifests use one portable spelling. Validate every destination before reading
// payloads: import removes the profile/ prefix and must never receive native paths.
function manifestPaths(manifest) {
    const seen = new Set();
    const check = (entry, section) => {
      const name = entry?.path;
      if (typeof name !== 'string' || /[\\:<>"|?*\x00-\x1f]/.test(name) || name.split('/').some(part =>
        !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail('path', 'Unsafe path in the export manifest');
      const relative = name.slice('profile/'.length);
      const allowedStore = name.startsWith('profile/') && !NEVER.has(relative.toLowerCase()) &&
        (STORE_FILES.includes(relative) || relative === 'settings.json' || STORE_DIRS.some(dir => relative.startsWith(dir + '/')));
      if ((section === 'database' && name !== 'database.dump') ||
          (section === 'media' && !name.startsWith('media/')) ||
          (section === 'store' && !allowedStore)) fail('path', 'File is outside its export section: ' + name);
      const identity = process.platform === 'win32' ? name.toLowerCase() : name;
      if (seen.has(identity)) fail('path', 'Duplicate path in the export manifest: ' + name);
      seen.add(identity);
    };
    check(manifest.database, 'database');
    for (const entry of manifest.media) check(entry, 'media');
    for (const entry of manifest.store) check(entry, 'store');
}
function verifyExport(destinationDir) {
    let manifest; try { manifest = JSON.parse(fs.readFileSync(path.join(destinationDir, 'manifest.json'), 'utf8')); } catch (error) { fail('manifest', 'This folder is not a Barkdown profile export: it has no readable manifest', error); }
    if (manifest?.version !== 1 || manifest.kind !== KIND || !manifest.database?.path || !Array.isArray(manifest.media) || !Array.isArray(manifest.store)) fail('manifest', 'Unsupported export manifest');
    manifestPaths(manifest);
    const listed = [manifest.database, ...manifest.media, ...manifest.store];
    for (const entry of listed) {
      const file = path.join(destinationDir, entry.path);
      if (!fs.existsSync(file)) fail('missing', 'Missing from the export: ' + entry.path);
      if (fs.statSync(file).size !== entry.bytes || sha(file) !== entry.sha256) fail('changed', 'Changed since the export: ' + entry.path);
    }
    const known = new Set([...listed.map(e => e.path), 'manifest.json']);
    // A file manager leaves its own files in a folder a person merely opened; they are never imported.
    const extra = walk(destinationDir).filter(rel => !known.has(rel) && !HOST_FILES.test(rel.split('/').pop()));
    if (extra.length) fail('extra', 'Files the manifest does not list: ' + extra.slice(0, 5).join(', '));
    return { manifest, files: listed.length };
}
// Published Papers, and the notes that exist only as drafts (a note written in the app is a draft
// until it is published). The app lists both; the manifest counts both.
async function defaultCount(target) {
  const page = async query => {
    const response = await fetch(`${target.server}/v1/data/query/${encodeURIComponent(target.dataset)}/paper?${query}`, { headers: { authorization: 'Bearer ' + target.token }, signal: AbortSignal.timeout(20000) });
    const data = await response.json(); const value = data?.result ?? data;
    if (!response.ok || !Number.isSafeInteger(value?.total)) fail('count', 'The library could not be counted for the export');
    return value;
  };
  const papers = (await page('limit=1&offset=0&count=true&perspective=published')).total;
  let drafts = 0;
  for (let offset = 0; ; offset += 200) {
    const value = await page(`limit=200&offset=${offset}&count=true&perspective=drafts&order=_createdAt:asc&fields=title`);
    const rows = value.documents || value.items || value.results || [];
    drafts += rows.filter(d => d?._draft === true || String(d?._id || '').startsWith('drafts.')).length;
    if (!rows.length || offset + rows.length >= value.total) break;
    if (offset > 100000) fail('count', 'The library is larger than the export can count');
  }
  return { papers, drafts };
}
module.exports = { createProfileExport, verifyExport, KIND };
