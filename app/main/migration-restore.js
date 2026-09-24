// Offline legacy-data recovery into an empty destination. Never changes the
// registry/authority, contacts Paper, restores credentials or overwrites a note.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { validateProfileId } = require('./profile-registry');
const { acquireFileLease } = require('./file-lease');
const { canonical, hash, fail, record, read } = require('./migration-journal');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = /^[a-f0-9]{64}$/;
const allowedRoot = /^(?:workspace\.json|paper-proposals\.json|(?:documents|attachments|agent-edits)\/[^]+)$/;

function safeName(name) {
  if (typeof name !== 'string' || !allowedRoot.test(name) || name.includes('\\') || name.includes(':') || name.split('/').some(p => !p || p === '.' || p === '..') || /\.(?:tmp|lock)$/.test(name)) fail('backup_path', 'Unowned or unsupported backup path');
}
function disjoint(a, b) {
  a = path.resolve(a); b = path.resolve(b);
  if (process.platform === 'win32') { a = a.toLowerCase(); b = b.toLowerCase(); }
  if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep)) fail('restore_scope', 'Backup and restored profile must be disjoint');
}
function walk(store, prefix = '') {
  const entries = [];
  function visit(relative) {
    const file = store.filePath(relative), stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      entries.push({ path: relative, directory: true });
      for (const name of fs.readdirSync(file).sort()) visit(relative + '/' + name);
    } else if (stat.isFile()) entries.push({ path: relative, bytes: stat.size });
    else fail('restore_path', 'Unsupported filesystem entry');
  }
  if (prefix) visit(prefix);
  else for (const name of fs.readdirSync(store.dir()).sort()) visit(name);
  return entries;
}

function validateBackup({ profileId, backupDir, expectedSourceHash }) {
  validateProfileId(profileId);
  if (!digest.test(expectedSourceHash || '')) fail('backup_identity', 'A caller-pinned source hash is required');
  const store = createStore(backupDir, { create: false });
  let bytes, manifest;
  try {
    bytes = fs.readFileSync(store.filePath('manifest.json'));
    if (!bytes.equals(fs.readFileSync(store.filePath('intent.json')))) fail('backup_commit', 'Preparation intent and committed manifest differ');
    manifest = JSON.parse(bytes);
  } catch (error) { if (error.code?.startsWith('backup_')) throw error; fail('backup_commit', 'Committed preparation manifest is missing or unreadable'); }
  if (manifest.version !== 1 || manifest.profileId !== profileId || manifest.sourceHash !== expectedSourceHash || manifest.authority !== 'legacy' || manifest.serverWrites !== false || !['prepared','blocked'].includes(manifest.status) || !Array.isArray(manifest.files)) fail('backup_identity', 'Backup owner or preparation identity differs');
  const names = new Set(); let total = 0;
  const files = manifest.files.map(file => {
    if (!file || typeof file !== 'object' || canonical(Object.keys(file).sort()) !== canonical(['bytes','path','sha256'])) fail('backup_manifest', 'Invalid file inventory');
    safeName(file.path);
    if (names.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 32*1024*1024 || !digest.test(file.sha256 || '')) fail('backup_manifest', 'Invalid or duplicate file inventory');
    names.add(file.path); total += file.bytes;
    return { path: file.path, bytes: file.bytes, sha256: file.sha256 };
  });
  if (total > 256*1024*1024 || !names.has('workspace.json') || sha(JSON.stringify({ profileId, files })) !== expectedSourceHash) fail('backup_identity', 'Backup inventory does not match the pinned source');
  const actual = walk(store, 'source').filter(f => !f.directory).map(f => f.path.slice(7));
  if (actual.length !== files.length || actual.some(name => !names.has(name))) fail('backup_inventory', 'Backup contains missing or unlisted files');
  function content(file) {
    const target = store.filePath('source/' + file.path), stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.size !== file.bytes) fail('backup_bytes', 'Backup file size/type differs: ' + file.path);
    const value = fs.readFileSync(target);
    if (value.length !== file.bytes || sha(value) !== file.sha256) fail('backup_bytes', 'Backup file hash differs: ' + file.path);
    return value;
  }
  files.forEach(content);
  return { store, manifestHash: sha(bytes), files, content };
}

function restoreMigrationBackup(options, { checkpoint = () => {} } = {}) {
  if (options.quiesced !== true) fail('restore_owner', 'Restore requires a closed, quiesced destination');
  const backup = validateBackup(options);
  const destination = path.resolve(options.destinationDir);
  if (path.basename(destination) !== options.profileId) fail('restore_owner', 'Destination basename must match the captured profile');
  disjoint(backup.store.dir(), destination);
  // Parent must already exist; this operation creates only its explicitly named profile.
  const parent = createStore(path.dirname(destination), { create: false });
  const targetPath = () => parent.filePath(options.profileId);
  const journalName = 'restore/' + hash(process.platform === 'win32' ? destination.toLowerCase() : destination);
  fs.mkdirSync(backup.store.filePath(journalName), { recursive: true });
  const journal = createStore(backup.store.filePath(journalName), { create: false });
  const lease = acquireFileLease(journal.filePath('owner.lock'), { completeOwner: true, busy: 'This backup restoration is already owned' });
  try {
    const plan = { version: 1, profileId: options.profileId, sourceHash: options.expectedSourceHash, manifestHash: backup.manifestHash, destination, files: backup.files };
    const oldPlan = read(journal, 'plan.json'), root = read(journal, 'root.json'), completed = read(journal, 'complete.json');
    if (!oldPlan) {
      if (fs.readdirSync(journal.dir()).some(n => n !== 'owner.lock' && !/^owner\.lock\.abandoned-[a-f0-9-]{36}$/.test(n) && !n.endsWith('.tmp'))) fail('restore_journal', 'Restore records survive without their plan');
      if (fs.existsSync(targetPath()) && (!fs.statSync(targetPath()).isDirectory() || fs.readdirSync(targetPath()).length)) fail('restore_exists', 'Destination already contains data; no file was overwritten');
    }
    record(journal, 'plan.json', plan);
    const planHash = hash(plan);
    function guard() { lease.assertOwned(); targetPath(); record(journal, 'plan.json', plan); }
    function emit(name) { guard(); checkpoint(name); guard(); }
    emit('restore-plan');
    if (root && !fs.existsSync(targetPath())) fail('restore_missing', 'Previously owned restored profile disappeared');
    if (!fs.existsSync(targetPath())) fs.mkdirSync(targetPath());
    if (!root && fs.readdirSync(targetPath()).length) fail('restore_exists', 'Data appeared before destination ownership was recorded');
    const stat = fs.statSync(targetPath());
    record(journal, 'root.json', { version: 1, planHash, dev: stat.dev, ino: stat.ino });
    const target = createStore(targetPath(), { create: false });
    const entries = backup.files.map(file => {
      const key = hash(file.path), intentName = key + '.intent.json', receiptName = key + '.receipt.json';
      const expected = { version: 1, planHash, ...file };
      const intent = read(journal, intentName), receipt = read(journal, receiptName);
      if (intent) record(journal, intentName, expected);
      if (receipt) { if (!intent) fail('restore_journal', 'Restored receipt has no intent'); record(journal, receiptName, expected); }
      return { file, expected, intentName, receiptName, intent, receipt, temp: file.path + '.restore-' + planHash.slice(0,16) + '.tmp' };
    });
    const result = { version: 1, planHash, profileId: options.profileId, sourceHash: options.expectedSourceHash, status: 'restored', authority: 'legacy', files: backup.files };
    if (completed) {
      if (entries.some(e => !e.receipt)) fail('restore_journal', 'Completed restore has missing receipts');
      record(journal, 'complete.json', result);
    }
    function inspectTarget(final = false) {
      for (const entry of entries) if (entry.receipt && !fs.existsSync(target.filePath(entry.file.path))) fail('restore_missing', 'Previously restored file disappeared');
      for (const item of walk(target)) {
        if (item.directory) { if (!entries.some(e => e.file.path.startsWith(item.path + '/'))) fail('restore_extra', 'Unlisted destination directory'); continue; }
        const entry = entries.find(e => e.file.path === item.path || (!final && e.temp === item.path));
        if (!entry || !entry.intent) fail('restore_extra', 'Destination has an unowned file');
        const value = fs.readFileSync(target.filePath(item.path));
        if (item.path === entry.temp) {
          const source = backup.content(entry.file);
          if (value.length > source.length || !value.equals(source.subarray(0,value.length))) fail('restore_partial', 'Owned temporary file differs from source; retained for review');
        } else if (value.length !== entry.file.bytes || sha(value) !== entry.file.sha256) fail('restore_changed', 'Restored content changed; no overwrite permitted');
      }
      if (final) for (const entry of entries) if (!fs.existsSync(target.filePath(entry.file.path))) fail('restore_missing', 'Restored file is missing');
    }
    inspectTarget(Boolean(completed));
    if (completed) return result;
    emit('restore-root');
    for (const entry of entries) {
      guard(); targetPath();
      const source = backup.content(entry.file), to = target.filePath(entry.file.path), temp = target.filePath(entry.temp);
      if (entry.receipt && !fs.existsSync(to)) fail('restore_missing', 'Previously restored file disappeared');
      record(journal, entry.intentName, entry.expected); entry.intent = entry.expected;
      emit('restore-intent:' + entry.file.path);
      if (!fs.existsSync(to)) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        const prior = fs.existsSync(temp) ? fs.readFileSync(temp) : Buffer.alloc(0);
        if (prior.length > source.length || !prior.equals(source.subarray(0,prior.length))) fail('restore_partial', 'Temporary copy differs; retain it for review');
        if (prior.length < source.length || !fs.existsSync(temp)) {
          const fd = fs.openSync(temp, fs.existsSync(temp) ? 'a' : 'wx', 0o600);
          try {
            const opened = fs.fstatSync(fd);
            if (opened.nlink !== 1 || opened.size !== prior.length) fail('restore_partial', 'Temporary copy ownership changed');
            for (let offset = prior.length; offset < source.length; offset += 65536) {
              guard(); target.filePath(entry.temp);
              fs.writeFileSync(fd, source.subarray(offset, Math.min(offset + 65536,source.length)));
              emit('restore-chunk:' + entry.file.path);
            }
            fs.fsyncSync(fd);
          } finally { fs.closeSync(fd); }
        }
        if (!fs.readFileSync(target.filePath(entry.temp)).equals(source)) fail('restore_partial', 'Temporary copy readback differs');
        emit('restore-temp:' + entry.file.path);
        try { fs.linkSync(target.filePath(entry.temp), target.filePath(entry.file.path)); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        emit('restore-published:' + entry.file.path);
      }
      if (!fs.readFileSync(target.filePath(entry.file.path)).equals(source)) fail('restore_changed', 'Published destination differs; no overwrite permitted');
      if (fs.existsSync(target.filePath(entry.temp))) {
        if (!fs.readFileSync(target.filePath(entry.temp)).equals(source)) fail('restore_partial', 'Retain unexpected temporary bytes');
        fs.unlinkSync(target.filePath(entry.temp));
      }
      record(journal, entry.receiptName, entry.expected); entry.receipt = entry.expected;
      emit('restore-receipt:' + entry.file.path);
    }
    emit('restore-before-complete');
    validateBackup(options); inspectTarget(true); guard();
    record(journal, 'complete.json', result);
    return result;
  } finally { lease.release(); }
}

module.exports = { validateBackup, restoreMigrationBackup };
