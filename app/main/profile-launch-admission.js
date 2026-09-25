// Closing launches precedes draft retention and owned-process drain. This record
// never claims that existing runs stopped or that migration may select an engine.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { controller, writerForStore } = require('./writer-admission');
const { acquireFileLease } = require('./file-lease');
const { atomicWrite } = require('./atomic-write');
const filename = 'profile-launch-admission.json';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const fail = message => { throw Object.assign(new Error(message), { code: 'BARKDOWN_PROFILE_PREPARING' }); };

function createProfileLaunchAdmission({ registry }) {
  const bindings = new Map();
  function binding(profileId) {
    const owned = registry.storeFor(profileId);
    if (!bindings.has(profileId)) {
      const store = createStore(owned.storeDir, { create: false });
      bindings.set(profileId, { store, control: controller(store), seen: null });
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
      !uuid(value.id) || value.phase !== 'launches-closed' || b.seen && b.seen !== value.id) fail('Profile preparation ownership changed; launches remain stopped.');
    b.seen = value.id;
    return Object.freeze(value);
  }
  function assertOpen(profileId) {
    if (read(profileId)) fail('This profile is preparing for migration. New agent turns are stopped.');
  }
  function close(profileId) {
    const b = binding(profileId), existing = read(profileId);
    if (existing) return existing;
    const writer = writerForStore(b.store);
    return writer.run('migration:close-launches', () => {
      const file = b.store.filePath(filename), lease = acquireFileLease(file + '.lock', { completeOwner: true });
      try {
        const current = read(profileId); if (current) return current;
        const value = { version: 1, profileId, storeOwner: writer.token.owner, id: crypto.randomUUID(), phase: 'launches-closed' };
        atomicWrite(file, JSON.stringify(value, null, 2) + '\n', { expectedBytes: null,
          assertOwned: () => { lease.assertOwned(); b.store.filePath(filename); } });
        return read(profileId);
      } finally { lease.release(); }
    });
  }
  // Reopening requires a later explicit reconciled-abort contract, never restart.
  return Object.freeze({ read, isClosed: profileId => Boolean(read(profileId)), assertOpen, close });
}
module.exports = { createProfileLaunchAdmission };
