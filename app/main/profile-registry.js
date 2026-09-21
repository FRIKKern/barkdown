// Opt-in storage foundation. Deliberately not wired to app startup: adoption must
// run with the old workspace quiescent, and database/browser migration is separate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = 1;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_SETTINGS = new Set(['theme', 'sidebarWidth', 'chatWidth', 'windowBounds']);
const LEGACY_ENTRIES = new Set(['workspace.json', 'settings.json', 'barkpark.json', 'local-credentials.json', 'paper-proposals.json', 'documents', 'attachments', 'agent-edits']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
function validateProfileId(id) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Invalid profile ID');
  return id;
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function exists(file) { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
function noLinkedAncestors(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    if (exists(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links are not supported in profile storage');
    if (path.dirname(current) === current) break;
  }
}
function pathIdentity(file) {
  const canonical = fs.realpathSync.native(file);
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}
function validateLegacyJson(relative, bytes) {
  if (!relative.endsWith('.json')) return;
  let value;
  try { value = JSON.parse(bytes); } catch { throw new Error(`Malformed legacy JSON: ${relative}`); }
  if (!isObject(value)) throw new Error(`Invalid legacy object: ${relative}`);
  if (relative === 'workspace.json') {
    if (value.version !== 1 || !isObject(value.chats) || !Array.isArray(value.order)) throw new Error('Unsupported or invalid legacy workspace schema');
    for (const [id, chat] of Object.entries(value.chats)) {
      if (!isObject(chat) || chat.id !== id || !Array.isArray(chat.messages) || !Array.isArray(chat.tabs)) throw new Error('Invalid legacy conversation');
    }
  }
  if (relative.startsWith('documents/')) {
    if (value.id !== path.basename(relative, '.json') || !Number.isSafeInteger(value.rev) || value.rev < 1 || !isObject(value.content) || value.content.type !== 'doc' || !Array.isArray(value.content.content)) throw new Error(`Invalid legacy document: ${relative}`);
  }
}

// Reject traversal and symlink/reparse redirects at every existing component.
function beneath(root, name) {
  noLinkedAncestors(root);
  if (typeof name !== 'string' || !name || path.isAbsolute(name) || name.includes('\\') || name.includes(':') || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid storage path');
  let at = root;
  for (const part of name.split('/')) {
    at = path.join(at, part);
    if (exists(at) && fs.lstatSync(at).isSymbolicLink()) throw new Error('Symbolic links are not supported in profile storage');
  }
  return at;
}
function durableWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  // Node/Windows cannot reliably fsync directory handles. This proves process
  // interruption recovery, not hardware power-loss durability on every filesystem.
}
function write(file, value) { durableWrite(file, JSON.stringify(value, null, 2) + '\n'); }

function validateRegistry(value) {
  if (!isObject(value) || value.version !== VERSION || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.profiles) || !isObject(value.appSettings)) throw new Error('Invalid or unsupported profile registry');
  const ids = new Set();
  for (const p of value.profiles) {
    validateProfileId(p?.id);
    if (ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.root !== `profiles/${p.id}`) throw new Error('Invalid profile registry entry');
    if (p.creationKey !== undefined) validateProfileId(p.creationKey);
    ids.add(p.id);
  }
  if (value.selectedProfileId !== null && !ids.has(value.selectedProfileId)) throw new Error('Selected profile is missing');
  return value;
}

function createProfileRegistry(directory, { checkpoint = () => {} } = {}) {
  const root = path.resolve(directory);
  noLinkedAncestors(root);
  fs.mkdirSync(root, { recursive: true });
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Registry root cannot be a symbolic link');
  const at = name => beneath(root, name);
  const pointerPath = at('registry.json');
  const previousPath = at('registry.previous.json');
  const journalPath = at('adoption.json');

  function locked(fn) {
    const lock = at('registry.lock');
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = read(lock); } catch { throw new Error('Registry lock is unreadable; inspect it before recovery'); }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('Registry lock has no valid owner');
      try { process.kill(owner.pid, 0); throw new Error('Profile registry is in use'); } catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
      fs.renameSync(lock, at(`abandoned-lock-${crypto.randomUUID()}.json`));
      fd = fs.openSync(lock, 'wx', 0o600);
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid })); fs.fsyncSync(fd);
      return fn();
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  function fromPointer(pointer) {
    if (isObject(pointer) && pointer.version === VERSION && pointer.empty === true && Object.keys(pointer).length === 2) return null;
    if (!isObject(pointer) || pointer.version !== VERSION || !ID.test(pointer.generation) || !/^[a-f0-9]{64}$/.test(pointer.sha256)) throw new Error('Invalid registry pointer');
    const bytes = fs.readFileSync(at(`registry-generations/${pointer.generation}.json`));
    if (hash(bytes) !== pointer.sha256) throw new Error('Registry generation checksum mismatch');
    return validateRegistry(JSON.parse(bytes));
  }
  function load() {
    if (!exists(pointerPath)) {
      if (exists(previousPath)) throw new Error('Registry pointer missing; explicit recovery required');
      if (exists(journalPath) && journal().phase === 'committed') throw new Error('Committed registry pointer missing; explicit recovery required');
      if (!exists(journalPath) && exists(at('registry-generations')) && fs.readdirSync(at('registry-generations')).length) throw new Error('Registry pointer missing with retained generations; explicit recovery required');
      return null;
    }
    return clone(fromPointer(read(pointerPath)));
  }
  function commit(value) {
    const current = load();
    // Publish a recoverable empty origin before the first immutable generation.
    // A crash before initial publication must not leave an ambiguous orphan as
    // the only candidate for recovery.
    if (!exists(pointerPath)) write(pointerPath, { version: VERSION, empty: true });
    const next = validateRegistry({ ...value, version: VERSION, revision: (current?.revision || 0) + 1 });
    const generation = crypto.randomUUID();
    const bytes = Buffer.from(JSON.stringify(next, null, 2) + '\n');
    durableWrite(at(`registry-generations/${generation}.json`), bytes);
    checkpoint('generation-written');
    if (exists(pointerPath)) durableWrite(previousPath, fs.readFileSync(pointerPath));
    checkpoint('previous-pointer-written');
    write(pointerPath, { version: VERSION, generation, sha256: hash(bytes) });
    checkpoint('registry-committed');
    return clone(next);
  }
  function recoverPrevious() {
    return locked(() => {
      const previous = read(previousPath);
      const registry = fromPointer(previous);
      if (exists(pointerPath)) durableWrite(at(`recovery-evidence/${crypto.randomUUID()}.json`), fs.readFileSync(pointerPath));
      write(pointerPath, previous);
      return clone(registry);
    });
  }
  function entry(id) {
    validateProfileId(id);
    const profile = load()?.profiles.find(p => p.id === id);
    if (!profile) throw new Error('Unknown profile; no fallback is allowed');
    return profile;
  }
  function storeFor(id) {
    const profile = entry(id);
    const storeDir = at(profile.root);
    const ownedPath = name => {
      entry(id);
      const directory = at(profile.root);
      if (!exists(directory) || !fs.lstatSync(directory).isDirectory()) throw new Error('Profile directory is missing; recovery required');
      return beneath(directory, name);
    };
    return Object.freeze({ profileId: id, storeDir,
      readJson(name, fallback = null) {
        const file = ownedPath(name);
        try { return read(file); } catch (error) { if (error.code === 'ENOENT') return clone(fallback); throw error; }
      },
      writeJson(name, value) { const file = ownedPath(name); write(file, value); },
    });
  }
  function createProfile({ name, requestId = crypto.randomUUID() }) {
    return locked(() => {
      validateProfileId(requestId);
      if (exists(journalPath) && ['prepared', 'backed-up'].includes(journal().phase)) throw new Error('Finish or roll back the pending adoption before creating profiles');
      if (typeof name !== 'string' || !name.trim()) throw new Error('Profile name is required');
      const current = load() || { profiles: [], selectedProfileId: null, appSettings: {} };
      const existing = current.profiles.find(p => p.creationKey === requestId);
      if (existing) return clone(existing);
      const id = crypto.randomUUID();
      const profile = { id, name: name.trim(), root: `profiles/${id}`, creationKey: requestId };
      fs.mkdirSync(at(profile.root), { recursive: true });
      commit({ ...current, profiles: [...current.profiles, profile], selectedProfileId: current.selectedProfileId || id });
      return clone(profile);
    });
  }
  function selectProfile(id) {
    return locked(() => { entry(id); return commit({ ...load(), selectedProfileId: id }); });
  }

  function inventory(source) {
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Legacy root cannot be a symbolic link');
    if (exists(path.join(source, 'local-barkpark'))) throw new Error('Local database adoption requires a separate cold-runtime migration; shell adoption refused');
    const files = [];
    const walk = relative => {
      const file = beneath(source, relative), stat = fs.lstatSync(file);
      if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) walk(`${relative}/${name}`);
      else if (stat.isFile()) {
        if (relative.endsWith('.lock') || relative.endsWith('.tmp')) throw new Error('Legacy workspace has pending writes; close writers before adoption');
        const bytes = fs.readFileSync(file);
        validateLegacyJson(relative, bytes);
        files.push({ path: relative, size: bytes.length, sha256: hash(bytes) });
      } else throw new Error('Unsupported legacy storage entry');
    };
    for (const name of fs.readdirSync(source).sort()) {
      if (!LEGACY_ENTRIES.has(name)) throw new Error(`Unclassified legacy entry requires ownership review: ${name}`);
      walk(name);
    }
    return files;
  }
  function verifiedCopy(source, destination, files, transform = bytes => bytes) {
    for (const file of files) {
      const bytes = fs.readFileSync(beneath(source, file.path));
      if (bytes.length !== file.size || hash(bytes) !== file.sha256) throw new Error(`Adoption source changed: ${file.path}`);
      const output = transform(bytes, file.path);
      const target = beneath(destination, file.path);
      if (exists(target)) {
        if (hash(fs.readFileSync(target)) !== hash(output)) throw new Error(`Adoption destination differs: ${file.path}`);
      } else durableWrite(target, output);
      checkpoint('file-copied');
    }
  }
  function journal() {
    const j = read(journalPath);
    if (!isObject(j) || j.version !== VERSION || !['prepared', 'backed-up', 'committed', 'rolled-back'].includes(j.phase) || !Array.isArray(j.files) || typeof j.source !== 'string' || !path.isAbsolute(j.source)) throw new Error('Invalid adoption journal');
    validateProfileId(j.profileId); validateProfileId(j.backupId);
    if (typeof j.name !== 'string' || !j.name.trim()) throw new Error('Invalid adoption name');
    const seen = new Set();
    for (const f of j.files) {
      beneath(root, f.path);
      if (seen.has(f.path) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid adoption manifest');
      seen.add(f.path);
    }
    return j;
  }
  function adoptLegacy({ legacyDir, name = 'Default' }) {
    return locked(() => {
      const source = path.resolve(legacyDir);
      noLinkedAncestors(source);
      const sourceIdentity = pathIdentity(source), rootIdentity = pathIdentity(root);
      if (sourceIdentity === rootIdentity || sourceIdentity.startsWith(rootIdentity + path.sep) || rootIdentity.startsWith(sourceIdentity + path.sep)) throw new Error('Legacy and registry roots must be disjoint');
      let j;
      if (exists(journalPath)) {
        j = journal();
        if (j.source !== source) throw new Error('Adoption already belongs to another source');
        if (j.phase === 'rolled-back') throw new Error('Adoption was rolled back; inspect retained data before a new migration');
        if (load()?.profiles.some(p => p.id === j.profileId)) {
          j.phase = 'committed'; write(journalPath, j);
          return entry(j.profileId);
        }
        if (j.phase === 'committed') throw new Error('Committed adoption is missing from registry; explicit recovery required');
        if (load()) throw new Error('Registry changed during adoption; explicit recovery required');
      } else {
        if (load()) throw new Error('Default adoption must precede other profiles');
        if (typeof name !== 'string' || !name.trim()) throw new Error('Profile name is required');
        j = { version: VERSION, phase: 'prepared', source, name: name.trim(), profileId: crypto.randomUUID(), backupId: crypto.randomUUID(), files: inventory(source) };
        write(journalPath, j); checkpoint('adoption-prepared');
      }
      if (JSON.stringify(inventory(source)) !== JSON.stringify(j.files)) throw new Error('Legacy workspace changed; adoption stopped without changing source');
      const backup = at(`adoption-backups/${j.backupId}`);
      fs.mkdirSync(backup, { recursive: true });
      verifiedCopy(source, backup, j.files);
      write(beneath(backup, 'manifest.json'), { version: VERSION, files: j.files });
      j.phase = 'backed-up'; write(journalPath, j); checkpoint('adoption-backed-up');
      const profile = { id: j.profileId, name: j.name, root: `profiles/${j.profileId}` };
      const destination = at(profile.root);
      fs.mkdirSync(destination, { recursive: true });
      let appSettings = {};
      verifiedCopy(backup, destination, j.files, (bytes, relative) => {
        if (relative !== 'settings.json') return bytes;
        const settings = JSON.parse(bytes);
        if (!isObject(settings)) throw new Error('Invalid legacy settings');
        for (const key of APP_SETTINGS) if (Object.hasOwn(settings, key)) { appSettings[key] = settings[key]; delete settings[key]; }
        return Buffer.from(JSON.stringify(settings, null, 2) + '\n');
      });
      checkpoint('adoption-profile-copied');
      if (JSON.stringify(inventory(source)) !== JSON.stringify(j.files)) throw new Error('Legacy workspace changed before commit');
      commit({ profiles: [profile], selectedProfileId: profile.id, appSettings });
      j.phase = 'committed'; write(journalPath, j);
      return clone(profile);
    });
  }
  function rollbackAdoption() {
    return locked(() => {
      const j = journal();
      const current = load();
      if (current?.profiles.some(p => p.id === j.profileId)) {
        const profiles = current.profiles.filter(p => p.id !== j.profileId);
        commit({ ...current, profiles, selectedProfileId: current.selectedProfileId === j.profileId ? profiles[0]?.id || null : current.selectedProfileId });
      }
      j.phase = 'rolled-back'; write(journalPath, j);
      return { source: j.source, backupDir: at(`adoption-backups/${j.backupId}`), retainedProfileDir: at(`profiles/${j.profileId}`) };
    });
  }
  return Object.freeze({ load, createProfile, selectProfile, storeFor, adoptLegacy, rollbackAdoption, recoverPrevious });
}

module.exports = { createProfileRegistry, validateProfileId, validateRegistry };
