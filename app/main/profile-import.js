// Import of a profile export into a new profile (P3): the export is verified, a new profile
// and a fresh private database are created, the dump and the media are restored before the
// runtime's first boot, and the profile's files are copied with navigation re-owned for the
// importing library. The exported profile and the export folder are never changed; an
// interrupted import leaves a journal that names the phase it stopped in.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyExport } = require('./profile-export');
const { createPaperEvidenceOwner } = require('./paper-evidence-owner');
const { createStore } = require('./store');
const { carried } = require('./media-origins');
const { importIdentity, transformContent, verbatim } = require('./profile-import-content');
const fail = (code, message, cause) => { throw Object.assign(new Error(message), { code: 'import_' + code, cause }); };
const JOURNAL = 'profile-import.json';
// Retained originals and rollback evidence are copied verbatim. Other JSON uses
// format-specific ownership transforms; human text and snapshot bytes are data.
function createProfileImport({ registry, runtimePool, source, upstreamRef = () => null, precedes = () => false, now = () => new Date().toISOString(), checkpoint = () => {} }) {
  if (!registry?.createProfile || typeof runtimePool?.restore !== 'function') throw new TypeError('Registry and a runtime pool that can restore are required');
  async function importProfile(exportDir, { name } = {}) {
    if (typeof exportDir !== 'string' || !path.isAbsolute(exportDir)) fail('source', 'Choose the export folder');
    const { manifest } = verifyExport(exportDir);
    const identity = importIdentity(manifest);
    // Validate and retain the JSON bytes before restore creates any destination.
    // A second pass substitutes only structural owner fields with the new IDs.
    const content = new Map();
    for (const entry of manifest.store) {
      const relative = entry.path.slice('profile/'.length);
      if (verbatim(relative) || !relative.endsWith('.json')) continue;
      const bytes = fs.readFileSync(path.join(exportDir, entry.path), 'utf8');
      transformContent(relative, bytes, identity, identity);
      content.set(entry.path, bytes);
    }
    const local = upstreamRef();
    // The same version, or an earlier one this runtime descends from: its first boot brings the restored
    // database forward. A later or unrelated version is refused; this runtime cannot read ahead.
    const same = Boolean(manifest.upstream) && manifest.upstream === local;
    if (!same && !(/^[0-9a-f]{40}$/.test(String(manifest.upstream)) && /^[0-9a-f]{40}$/.test(String(local)) && precedes(manifest.upstream, local))) fail('upstream', `This export was taken at Barkpark ${String(manifest.upstream).slice(0, 9)}; this Barkdown runs ${String(local).slice(0, 9)}. Import needs the same version or an earlier one that this one descends from`);
    const profile = registry.createProfile({ name: (typeof name === 'string' && name.trim()) || manifest.profile.name + ' (imported)' });
    const store = registry.storeFor(profile.id), storeDir = store.storeDir, bound = createStore(storeDir, { create: false });
    // A new profile is seeded with defaults; the import may replace exactly those, nothing else.
    const seeded = new Set(fs.readdirSync(storeDir, { recursive: true }).map(f => String(f).split(path.sep).join('/')));
    const journal = value => { bound.writeJson(JOURNAL, value); checkpoint('after-' + value.phase, { profileId: profile.id }); return value; };
    let record = journal({ version: 1, phase: 'restoring', profileId: profile.id, importedAtUpstream: local, exportedProfile: manifest.profile, exportedAt: manifest.exportedAt, exportDir, upstream: manifest.upstream, manifestSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(exportDir, 'manifest.json'))).digest('hex'), startedAt: now() });
    // From here a failure leaves a profile that is not a library: the error names it so the caller can discard it.
    try {
    // The database and the media, into a private cluster that has never booted.
    const restored = await runtimePool.restore(profile.id, { source, dumpFile: path.join(exportDir, manifest.database.path), mediaDir: path.join(exportDir, 'media') });
    record = journal({ ...record, phase: 'restored', restoredAt: now(), mediaOrigins: carried(manifest, restored.connection.server) });
    // Navigation belongs to the importing library: its own key, its own connection.
    const owner = createPaperEvidenceOwner(bound).identify(restored.connection, { create: true });
    const oldOwner = manifest.navigation?.owner || null;
    const copied = [];
    for (const entry of manifest.store) {
      const transformed = content.has(entry.path) ? transformContent(entry.path.slice('profile/'.length), content.get(entry.path), identity, { profileId: profile.id, owner }) : null;
      const relative = transformed?.file || entry.path.slice('profile/'.length), target = path.join(storeDir, relative), from = path.join(exportDir, entry.path);
      if (relative === JOURNAL || (fs.existsSync(target) && !seeded.has(relative))) fail('collision', 'The new profile already holds ' + relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (fs.existsSync(target)) fs.rmSync(target);
      if (relative === 'settings.json') {
        const settings = transformed.value;
        settings.barkpark = { ...(settings.barkpark || {}), enabled: true, viaCli: false, server: '', local: { enabled: true, source } };
        fs.writeFileSync(target, JSON.stringify(settings, null, 2) + '\n', { flag: 'wx' });
      } else if (transformed) fs.writeFileSync(target, JSON.stringify(transformed.value, null, 2) + '\n', { flag: 'wx' });
      else fs.copyFileSync(from, target, fs.constants.COPYFILE_EXCL);
      copied.push(relative);
    }
    record = journal({ ...record, phase: 'imported', importedAt: now(), navigation: { from: oldOwner, to: owner }, files: copied.length, media: manifest.media.length });
    } catch (error) { throw Object.assign(error, { profileId: profile.id }); }
    return { profileId: profile.id, storeDir, record, manifest };
  }
  function inspect(profileId) {
    // Only a missing journal means an ordinary profile. Unreadable evidence
    // must keep a potentially half-restored import out of profile selection.
    let value;
    try {
      const store = createStore(registry.storeFor(profileId).storeDir, { create: false });
      let bytes;
      try { bytes = fs.readFileSync(store.filePath(JOURNAL), 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') return { status: 'none' }; throw error; }
      value = JSON.parse(bytes);
    } catch { return { status: 'blocked' }; }
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || value.profileId !== profileId || !['restoring', 'restored', 'imported'].includes(value.phase)) return { status: 'blocked' };
    return { status: value.phase, mediaOrigins: Array.isArray(value.mediaOrigins) ? value.mediaOrigins : [], exportedProfile: value.exportedProfile, exportedAt: value.exportedAt, exportDir: typeof value.exportDir === 'string' ? value.exportDir : null };
  }
  return Object.freeze({ importProfile, inspect });
}
module.exports = { createProfileImport };
