// Profile-owned references to verified migration backups. These are readers only:
// no document store, Paper adapter, proposal acceptance or restore action is exposed.
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./store');
const { validateProfileId } = require('./profile-registry');
const { validateBackup } = require('./migration-restore');
const { readRetainedDocument } = require('./migration-evidence');
const { hash, fail } = require('./migration-journal');
const { atomicWrite } = require('./atomic-write');
const { acquireFileLease } = require('./file-lease');
const FILE = 'original-history.json';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function createOriginalHistory({ store, profileId }) {
  validateProfileId(profileId);
  function registry() {
    let value;
    try { value = JSON.parse(fs.readFileSync(store.filePath(FILE), 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') value = { version: 1, profileId, sources: [] };
      else fail('history_registry', 'Original history references are unreadable; no references were replaced.');
    }
    if (value?.version !== 1 || value.profileId !== profileId || !Array.isArray(value.sources) ||
      value.sources.some(s => !s || !digest(s.id) || !digest(s.sourceHash) || !digest(s.manifestHash) ||
        typeof s.backupDir !== 'string' || !path.isAbsolute(s.backupDir)) ||
      new Set(value.sources.map(s => s.id)).size !== value.sources.length) {
      fail('history_registry', 'Original history references are invalid; no references were replaced.');
    }
    return value;
  }
  function options(source) { return { profileId, backupDir: source.backupDir, expectedSourceHash: source.sourceHash }; }
  function inspect(source) {
    const backup = validateBackup(options(source));
    if (backup.manifestHash !== source.manifestHash) fail('history_changed', 'This backup changed since it was opened. Choose the original backup again.');
    const documents = backup.files.filter(f => /^documents\/[\w-]{1,128}\.json$/.test(f.path)).map(file => {
      let doc;
      try { doc = JSON.parse(backup.content(file)); } catch { fail('evidence_json', 'An original document is unreadable.'); }
      const id = file.path.slice(10, -5);
      if (!doc || doc.id !== id || typeof doc.title !== 'string') fail('evidence_document', 'An original document has an invalid identity.');
      return { id, title: doc.title, revision: doc.rev };
    });
    return { id: source.id, profileId, sourceHash: source.sourceHash, manifestHash: source.manifestHash,
      name: path.basename(source.backupDir), path: source.backupDir, documents, readOnly: true };
  }
  function source(id) {
    const value = registry().sources.find(s => s.id === id);
    if (!value) fail('history_owner', 'This original history does not belong to the current profile.');
    return value;
  }
  function add(backupDir) {
    if (typeof backupDir !== 'string' || !path.isAbsolute(backupDir)) fail('history_path', 'Choose a migration backup folder.');
    const backupStore = createStore(backupDir, { create: false });
    const bytes = fs.readFileSync(backupStore.filePath('manifest.json'));
    let manifest;
    try { manifest = JSON.parse(bytes); } catch { fail('backup_commit', 'The backup manifest is unreadable.'); }
    const item = { backupDir: path.resolve(backupDir), sourceHash: manifest.sourceHash, manifestHash: require('node:crypto').createHash('sha256').update(bytes).digest('hex') };
    item.id = hash({ profileId, ...item });
    const result = inspect(item); // Reject foreign/partial/changed backups before persisting a reference.
    const lease = acquireFileLease(store.filePath('original-history.lock'), { completeOwner: true });
    try {
      const value = registry();
      if (!value.sources.some(s => s.id === item.id)) atomicWrite(store.filePath(FILE),
        JSON.stringify({ ...value, sources: [...value.sources, item] }, null, 2),
        { assertOwned: () => { lease.assertOwned(); store.filePath(FILE); } });
    } finally { lease.release(); }
    return result;
  }
  function list() {
    return registry().sources.map(s => {
      try { return inspect(s); }
      catch (error) { return { id: s.id, profileId, name: path.basename(s.backupDir), path: s.backupDir,
        sourceHash: s.sourceHash, manifestHash: s.manifestHash, readOnly: true, unavailable: error.message, documents: [] }; }
    });
  }
  function read({ sourceId, documentId } = {}) {
    const s = source(sourceId);
    inspect(s);
    const result = readRetainedDocument({ ...options(s), documentId });
    if (result.manifestHash !== s.manifestHash) fail('history_changed', 'The backup changed while reading.');
    return { ...result, sourceId: s.id };
  }
  return Object.freeze({ add, list, read });
}

module.exports = { createOriginalHistory };
