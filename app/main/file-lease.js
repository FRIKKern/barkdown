// Exclusive process lease with serialized stale-owner recovery. A second stale
// reader must never rename the new owner's lock after the first reader recovers.
const fs = require('node:fs');
const crypto = require('node:crypto');

function acquireFileLease(file, { busy = 'Storage is owned by another writer', checkpoint = () => {}, completeOwner = false, recoveryDepth = 0 } = {}) {
  const recovery = file + '.recovery';
  const lease = crypto.randomUUID();
  let fd;
  const open = () => {
    if (!completeOwner) return fs.openSync(file, 'wx', 0o600);
    // Only the opt-in per-write lease uses complete-owner publication. Hardlink
    // creation is exclusive: unsupported filesystems fail, never fall back to
    // publishing an empty authoritative lock. Private crash remnants are inert.
    const prepared = `${file}.owner-${crypto.randomUUID()}.tmp`;
    const ownerFd = fs.openSync(prepared, 'wx', 0o600);
    try {
      fs.writeFileSync(ownerFd, JSON.stringify({ pid: process.pid, lease })); fs.fsyncSync(ownerFd);
      fs.linkSync(prepared, file);
      try { fs.unlinkSync(prepared); } catch { /* Retain private evidence if unlink is unavailable. */ }
      return ownerFd;
    } catch (error) {
      fs.closeSync(ownerFd);
      // Losing exclusive publication does not leave another active owner.
      if (error.code === 'EEXIST') { try { fs.unlinkSync(prepared); } catch { /* Inert private evidence. */ } }
      throw error;
    }
  };
  try { fd = open(); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let guard, guardLease;
    try {
      if (completeOwner) {
        if (recoveryDepth >= 8) throw new Error('Storage lease recovery depth exceeded; inspect retained leases');
        guardLease = acquireFileLease(recovery, { busy, completeOwner: true, recoveryDepth: recoveryDepth + 1 });
      } else guard = fs.openSync(recovery, 'wx', 0o600);
    }
    catch (failure) { if (failure.code === 'EEXIST') throw new Error('Lease recovery is already owned; inspect retained recovery lease if its process stopped'); throw failure; }
    try {
      if (!completeOwner) { fs.writeFileSync(guard, JSON.stringify({ pid: process.pid })); fs.fsyncSync(guard); }
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (failure) {
        if (failure.code === 'ENOENT') { fd = open(); }
        else throw new Error('Storage lease is unreadable; inspect it before recovery');
      }
      if (fd === undefined) {
        if (!Number.isSafeInteger(owner?.pid) || owner.pid <= 0) throw new Error('Storage lease has no valid owner');
        if (completeOwner && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(owner.lease)) throw new Error('Storage lease has no valid owner token; inspect it before recovery');
        try { process.kill(owner.pid, 0); throw new Error(busy); } catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
        checkpoint('stale-owner-read');
        fs.renameSync(file, file + '.abandoned-' + crypto.randomUUID());
        fd = open();
      }
    } finally {
      if (guardLease) guardLease.release();
      else { fs.closeSync(guard); fs.unlinkSync(recovery); }
    }
  }
  try { if (!completeOwner) { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, lease })); fs.fsyncSync(fd); } }
  catch (error) { fs.closeSync(fd); throw error; }
  let released = false, closed = false;
  function assertOwned() {
    if (released || closed) throw new Error('Storage lease is closed');
    let owner;
    try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { throw new Error('Storage lease changed or disappeared'); }
    if (owner.lease !== lease || owner.pid !== process.pid) throw new Error('Storage lease changed; refusing another owner');
  }
  return Object.freeze({ lease,
    assertOwned,
    release() {
      if (released) return;
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch { throw new Error('Storage lease changed or disappeared; refusing to release another owner'); }
      if (owner.lease !== lease || owner.pid !== process.pid) throw new Error('Storage lease changed; refusing to release another owner');
      if (!closed) { fs.closeSync(fd); closed = true; }
      fs.unlinkSync(file); released = true;
    },
  });
}

module.exports = { acquireFileLease };
