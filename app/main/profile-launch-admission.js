// Closing launches precedes draft retention and owned-process drain. This record
// never claims that existing runs stopped or that migration may select an engine.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { controller, writerForStore } = require('./writer-admission');
const { acquireFileLease } = require('./file-lease');
const { atomicWrite } = require('./atomic-write');
const filename = 'profile-launch-admission.json';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const token = value => value?.version === 1 && uuid(value.owner) && uuid(value.generation);
const same = (a, b) => token(a) && token(b) && a.owner === b.owner && a.generation === b.generation;
const fail = message => { throw Object.assign(new Error(message), { code: 'BARKDOWN_PROFILE_PREPARING' }); };

function createProfileLaunchAdmission({ registry }) {
  const bindings = new Map();
  function binding(profileId) {
    const owned = registry.storeFor(profileId);
    if (!bindings.has(profileId)) {
      const store = createStore(owned.storeDir, { create: false });
      const control = controller(store);
      bindings.set(profileId, { store, control, initial: control.capture(), seen: null });
    }
    const b = bindings.get(profileId);
    if (b.store.dir() !== owned.storeDir) fail('Profile preparation belongs to a different store.');
    return b;
  }
  function read(profileId) {
    const b = binding(profileId); let raw;
    try { raw = fs.readFileSync(b.store.filePath(filename)); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (b.seen) fail('Profile preparation evidence disappeared; launches remain stopped.');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch { fail('Profile preparation evidence is unreadable; launches remain stopped.'); }
    if (value?.version !== 1 || value.profileId !== profileId || value.storeOwner !== b.control.capture().owner ||
      !uuid(value.id) || !['launches-closed', 'launches-open'].includes(value.phase) ||
      value.previousId !== undefined && (!uuid(value.previousId) || value.previousId === value.id) ||
      b.seen && b.seen !== value.id && value.previousId !== b.seen ||
      value.phase === 'launches-open' && (!token(value.writerReopened) || value.writerReopened.owner !== value.storeOwner || !uuid(value.preparationId))) fail('Profile preparation ownership changed; launches remain stopped.');
    if (value.phase === 'launches-open') assertAbortReceipt(b, value);
    b.seen = value.id;
    return Object.freeze(value);
  }
  function assertAbortReceipt(b, value) {
    let receipt; try { receipt = JSON.parse(fs.readFileSync(b.store.filePath('profile-preparation.json'))); }
    catch { fail('The reconciled abort receipt is unavailable; launches remain stopped.'); }
    if (receipt?.version !== 1 || receipt.phase !== 'aborted' || receipt.id !== value.preparationId || receipt.profileId !== value.profileId || receipt.closureId !== value.id || !same(receipt.writerReopened, value.writerReopened)) fail('Launch reopening differs from its durable abort receipt.');
  }
  function assertOpen(profileId) {
    if (isClosed(profileId)) fail('This profile is preparing for migration. New agent turns are stopped.');
  }
  function requiresRestart(profileId) {
    const value = read(profileId);
    if (value?.phase !== 'launches-open') return false;
    const b = binding(profileId), current = b.control.inspect();
    if (current.phase !== 'open' || !same(current, value.writerReopened)) fail('Reopened launch authority differs from its writer.');
    return Boolean(b.reopenedHere || !same(b.initial, value.writerReopened));
  }
  function isClosed(profileId) {
    const value = read(profileId);
    return Boolean(value && (value.phase === 'launches-closed' || requiresRestart(profileId)));
  }
  function close(profileId) {
    const b = binding(profileId), existing = read(profileId);
    if (existing?.phase === 'launches-closed') return existing;
    if (requiresRestart(profileId)) fail('Restart before preparing this profile again.');
    const writer = writerForStore(b.store);
    return writer.run('migration:close-launches', () => {
      const file = b.store.filePath(filename), lease = acquireFileLease(file + '.lock', { completeOwner: true });
      try {
        const current = read(profileId); if (current?.phase === 'launches-closed') return current;
        const bytes = current ? fs.readFileSync(file) : null;
        if (current) {
          const history = b.store.filePath(`launch-admission-history/${current.id}.json`);
          fs.mkdirSync(path.dirname(history), { recursive: true });
          if (fs.existsSync(history)) { if (!fs.readFileSync(history).equals(bytes)) fail('Prior launch history differs; keep the retained evidence.'); }
          else atomicWrite(history, bytes, { expectedBytes: null, assertOwned: () => { lease.assertOwned(); b.store.filePath(`launch-admission-history/${current.id}.json`); } });
        }
        const value = { version: 1, profileId, storeOwner: writer.token.owner, id: crypto.randomUUID(), phase: 'launches-closed' };
        if (current) value.previousId = current.id;
        atomicWrite(file, JSON.stringify(value, null, 2) + '\n', { expectedBytes: bytes,
          assertOwned: () => { lease.assertOwned(); b.store.filePath(filename); } });
        return read(profileId);
      } finally { lease.release(); }
    });
  }
  function reopen(profileId, { closureId, preparationId, writerReopened }) {
    const b = binding(profileId), file = b.store.filePath(filename);
    const lease = acquireFileLease(file + '.lock', { completeOwner: true });
    try {
      const current = read(profileId), writer = b.control.inspect();
      if (!current || current.id !== closureId || !uuid(preparationId) || !same(writerReopened, writer) || writer.phase !== 'open' || writer.pending.length) fail('Launch reopening needs the exact reconciled writer and preparation.');
      if (current.phase === 'launches-open') {
        if (!same(current.writerReopened, writerReopened) || current.preparationId !== preparationId) fail('Launches were reopened by a different preparation.');
        b.reopenedHere = true; return current;
      }
      const value = { ...current, phase: 'launches-open', preparationId, writerReopened };
      assertAbortReceipt(b, value);
      atomicWrite(file, JSON.stringify(value, null, 2) + '\n', { expectedBytes: fs.readFileSync(file),
        assertOwned: () => { lease.assertOwned(); b.store.filePath(filename); } });
      b.reopenedHere = true; return read(profileId);
    } finally { lease.release(); }
  }
  return Object.freeze({ read, isClosed, requiresRestart, assertOpen, close, reopen });
}
module.exports = { createProfileLaunchAdmission };
