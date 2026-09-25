const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

// Exclusive, fsynced publication. Existing journal records are checked, never
// replaced. Directory fsync/power-loss durability remains outside this slice.
function record(store, name, value) {
  const target = store.filePath(name), text = canonical(value) + '\n';
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = store.filePath(name + '.' + crypto.randomUUID() + '.tmp');
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.linkSync(temp, store.filePath(name)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    finally { fs.unlinkSync(temp); }
  }
  if (fs.readFileSync(store.filePath(name), 'utf8') !== text) fail('journal_changed', 'Staging record differs: ' + name);
  return value;
}
function read(store, name) {
  const file = store.filePath(name);
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a journal object');
    return value;
  }
  catch { fail('journal_corrupt', 'Unreadable staging record: ' + name); }
}


function verifyRecord(store, name, value) {
  const actual = read(store, name);
  if (!actual || canonical(actual) !== canonical(value)) fail('journal_changed', 'Missing or changed staging record: ' + name);
  return value;
}
module.exports = { canonical, hash, fail, record, read, verifyRecord };
