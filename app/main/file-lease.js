// Exclusive process lease with serialized stale-owner recovery. A second stale
// reader must never rename the new owner's lock after the first reader recovers.
const fs = require('node:fs');
const crypto = require('node:crypto');

function acquireFileLease(file, { busy = 'Storage is owned by another writer', checkpoint = () => {} } = {}) {
  const recovery = file + '.recovery';
  let fd;
  const open = () => fs.openSync(file, 'wx', 0o600);
  try { fd = open(); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let guard;
    try { guard = fs.openSync(recovery, 'wx', 0o600); }
    catch (failure) { if (failure.code === 'EEXIST') throw new Error('Lease recovery is already owned; inspect retained recovery lease if its process stopped'); throw failure; }
    try {
      fs.writeFileSync(guard, JSON.stringify({ pid: process.pid })); fs.fsyncSync(guard);
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (failure) {
        if (failure.code === 'ENOENT') { fd = open(); }
        else throw new Error('Storage lease is unreadable; inspect it before recovery');
      }
      if (fd === undefined) {
        if (!Number.isSafeInteger(owner?.pid) || owner.pid <= 0) throw new Error('Storage lease has no valid owner');
        try { process.kill(owner.pid, 0); throw new Error(busy); } catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
        checkpoint('stale-owner-read');
        fs.renameSync(file, file + '.abandoned-' + crypto.randomUUID());
        fd = open();
      }
    } finally { fs.closeSync(guard); fs.unlinkSync(recovery); }
  }
  const lease = crypto.randomUUID();
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, lease })); fs.fsyncSync(fd); }
  catch (error) { fs.closeSync(fd); throw error; }
  let released = false, closed = false;
  return Object.freeze({ lease,
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
