// Retry one prepared replacement, never a transaction or recovered orphan.
// Sync callers wait at most 100ms in total; filesystem calls themselves may block.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const waits = [10, 20, 30, 40];
const sleeper = new Int32Array(new SharedArrayBuffer(4));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const changed = label => Object.assign(new Error(`Atomic write ${label} changed; retained files require inspection`), { code: 'BARKDOWN_WRITE_AUTHORITY_CHANGED' });
const identity = stat => ['ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(stat[key])).join(':');

function snapshot(file) {
  let before;
  try { before = fs.lstatSync(file, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!before.isFile() || before.isSymbolicLink()) throw changed('file type');
  const fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    const digest = hash(fs.readFileSync(fd));
    const after = fs.fstatSync(fd, { bigint: true });
    if (identity(before) !== identity(opened) || identity(opened) !== identity(after)) throw changed('file during read');
    // Windows lstat reports dev=0 while fstat reports the volume serial.
    // Compare path/handle inode and metadata; retain handle volume in snapshots.
    return `${after.dev}:${identity(after)}:${digest}`;
  } finally { fs.closeSync(fd); }
}

function atomicWrite(file, bytes, { assertOwned, expectedBytes, tempPrefix = file } = {}) {
  if (typeof assertOwned !== 'function') throw new Error('Atomic write requires an owned writer lease');
  assertOwned();
  const target = snapshot(file);
  if (expectedBytes !== undefined && (expectedBytes === null ? target !== null : !target?.endsWith(':' + hash(expectedBytes)))) throw changed('expected target');
  const temp = `${tempPrefix}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const candidate = snapshot(temp);
  if (!candidate?.endsWith(':' + hash(bytes))) throw changed('prepared candidate');
  const started = performance.now();
  for (let attempt = 0; ; attempt++) {
    assertOwned();
    if (snapshot(file) !== target) throw changed('target');
    if (snapshot(temp) !== candidate) throw changed('candidate');
    // Lease checks surround reads too. Cooperating writers hold this lease;
    // these checks do not provide OS compare-and-swap against rogue writers.
    assertOwned();
    try { fs.renameSync(temp, file); return; }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EBUSY'].includes(error.code) || attempt >= waits.length || performance.now() - started + waits[attempt] > 120) throw error;
      Atomics.wait(sleeper, 0, 0, waits[attempt]);
    }
  }
}

module.exports = { atomicWrite };
