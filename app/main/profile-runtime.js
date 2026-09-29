// Trusted main-process runtime ownership. Selection and each running transport
// hold separate leases; a foreground switch cannot stop a background run.
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const crypto = require('node:crypto');
const { validateProfileId } = require('./profile-registry');
const { LocalBarkpark } = require('./local-barkpark');
const { SourceDriver } = require('./local-barkpark-source');
const { acquireFileLease } = require('./file-lease');

const portValid = port => Number.isInteger(port) && port >= 1024 && port <= 65535;
function validateDescriptor(value, profileId) {
  if (!value || value.version !== 1 || value.profileId !== validateProfileId(profileId) || typeof value.source !== 'string' || !path.isAbsolute(value.source) || !portValid(value.port) || !portValid(value.pgPort) || value.port === value.pgPort) throw new Error('Invalid or unsupported profile runtime descriptor');
  return Object.freeze({ version: 1, profileId, source: value.source, port: value.port, pgPort: value.pgPort });
}
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)); });
});
async function allocatePorts(used) {
  let port, pgPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    port = await freePort(); pgPort = await freePort();
    if (port !== pgPort && !used.has(port) && !used.has(pgPort)) return { port, pgPort };
  }
  throw new Error('Could not allocate distinct profile ports');
}

// A profile runtime is a managed instance (C083): it boots with write admission so the
// library switch can hold it. The instance id is the profile id, which is a lowercase UUID.
const managedDescriptor = descriptor => ({ ...descriptor, writeAdmission: { instanceId: 'profile-' + descriptor.profileId } });
function createProfileRuntimePool({ registry, readSecrets, createRuntime = ({ descriptor, dataDir, secrets }) => new LocalBarkpark(new SourceDriver(managedDescriptor(descriptor), dataDir, secrets)), allocate = allocatePorts }) {
  if (!registry?.storeFor || typeof readSecrets !== 'function') throw new Error('Runtime pool requires a registry and trusted credential reader');
  const entries = new Map();
  let foreground = null, closing = false, selection = Promise.resolve(), descriptors = Promise.resolve();

  async function descriptorFor(profileId, source) {
    const store = registry.storeFor(profileId);
    // Validate through the bound store before touching its derived lock path.
    store.readJson('runtime.json', null);
    // One registry-wide allocator lease prevents two processes from publishing
    // the same ports in different profiles. In-process preparations queue below.
    const lock = path.join(path.dirname(path.dirname(store.storeDir)), 'runtime-descriptors.lock');
    const ownership = acquireFileLease(lock, { busy: 'Runtime descriptor is owned by another writer' });
    try {
      const adoption = store.readJson('runtime-adoption.json', null);
      if (adoption && (adoption.version !== 1 || adoption.profileId !== profileId || adoption.phase !== 'committed')) throw new Error('Runtime adoption is incomplete or rolled back; inspect its retained receipt before starting');
      let descriptor = store.readJson('runtime.json', null);
      if (adoption && (!descriptor || JSON.stringify(descriptor) !== JSON.stringify(adoption.descriptor))) throw new Error('Runtime adoption descriptor is missing or changed; explicit recovery required');
      if (adoption) {
        for (const marker of ['pgdata/PG_VERSION', 'seeded']) {
          const file = path.join(store.storeDir, 'local-barkpark/runtime', marker);
          if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error('Adopted runtime data is missing; refusing to initialize or reseed it');
        }
      }
      if (descriptor) {
        descriptor = validateDescriptor(descriptor, profileId);
        if (source && path.resolve(source) !== descriptor.source) throw new Error('Profile runtime source changed; stop and explicitly reconfigure it first');
      }
      const used = new Set();
      for (const profile of registry.load().profiles) {
        if (profile.id === profileId) continue;
        const other = registry.storeFor(profile.id).readJson('runtime.json', null);
        if (other) { const validated = validateDescriptor(other, profile.id); used.add(validated.port); used.add(validated.pgPort); }
      }
      if (!descriptor) {
        if (typeof source !== 'string' || !path.isAbsolute(source)) throw new Error('A built source path is required for a new profile runtime');
        descriptor = validateDescriptor({ version: 1, profileId, source: path.resolve(source), ...await allocate(used) }, profileId);
        if (used.has(descriptor.port) || used.has(descriptor.pgPort)) throw new Error('Runtime ports belong to another profile');
        store.writeJson('runtime.json', descriptor);
      } else if (used.has(descriptor.port) || used.has(descriptor.pgPort)) throw new Error('Runtime ports collide with another profile; no runtime started');
      return { store, descriptor };
    } finally { ownership.release(); }
  }

  function startEntry(profileId, options) {
    const entry = { profileId, refs: new Map(), runtime: null, stopping: null, error: null };
    entries.set(profileId, entry);
    const prepared = descriptors.catch(() => {}).then(() => descriptorFor(profileId, options.source));
    descriptors = prepared;
    entry.ready = (async () => {
      const { store, descriptor } = await prepared;
      const secrets = await readSecrets(store);
      if (!secrets || typeof secrets.password !== 'string' || !secrets.password || typeof secrets.token !== 'string' || !secrets.token) throw new Error('Cannot unlock this profile runtime credentials');
      entry.store = store; entry.descriptor = descriptor;
      entry.connection = Object.freeze({ enabled: true, server: `http://127.0.0.1:${descriptor.port}`, token: secrets.token, dataset: 'production', viaCli: false });
      // Derive the data root; persisted/caller-provided absolute roots are never used.
      store.readJson('local-barkpark/runtime/.ownership-check.json', null);
      const dataDir = path.join(store.storeDir, 'local-barkpark', 'runtime');
      entry.runtime = createRuntime({ descriptor, dataDir, secrets: Object.freeze({ password: secrets.password, token: secrets.token }) });
      await entry.runtime.start();
      return entry;
    })().catch(error => { entry.error = error; throw error; });
    return entry;
  }
  async function drain(entry) {
    if (entry.refs.size) return;
    if (entry.stopping) return entry.stopping;
    entry.stopping = (async () => {
      await entry.ready.catch(() => {});
      await entry.runtime?.stop();
      if (entries.get(entry.profileId) === entry) entries.delete(entry.profileId);
    })();
    try { await entry.stopping; }
    catch (error) { entry.error = error; entry.stopping = null; throw error; }
  }
  async function acquire(profileId, { source, ownerId, writes = false } = {}) {
    if (closing) throw new Error('Profile runtime pool is shutting down');
    validateProfileId(profileId);
    if (typeof ownerId !== 'string' || !ownerId.trim() || typeof writes !== 'boolean') throw new Error('A runtime lease owner and explicit boolean writes policy are required');
    let entry = entries.get(profileId);
    if (entry?.stopping) { await entry.stopping; return acquire(profileId, { source, ownerId, writes }); }
    if (entry?.error) { if (entry.refs.size) throw entry.error; await drain(entry); entry = null; }
    if (!entry) entry = startEntry(profileId, { source });
    if ([...entry.refs.values()].includes(ownerId)) throw new Error('Runtime lease owner already acquired this profile');
    const leaseId = crypto.randomUUID(); entry.refs.set(leaseId, ownerId);
    try {
      await entry.ready;
      // Existing runtimes may be recovering after their initial start promise
      // resolved. A new lease must wait for current health, not stale readiness.
      await entry.runtime.ready?.();
      if (source && path.resolve(source) !== entry.descriptor.source) throw new Error('Cannot rebind a running profile source');
      if (closing) throw new Error('Profile runtime pool is shutting down');
    } catch (error) {
      entry.refs.delete(leaseId);
      try { await drain(entry); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Profile startup and cleanup failed'); }
      throw error;
    }
    let released = false, releasePromise = null;
    const release = () => {
      if (releasePromise) return releasePromise;
      if (!released) { released = true; entry.refs.delete(leaseId); }
      releasePromise = drain(entry).catch(error => { releasePromise = null; throw error; });
      return releasePromise;
    };
    // What an export needs from the owned runtime (P3): a logical dump and the media directory.
    const driver = entry.runtime?.driver;
    const data = driver?.dump ? Object.freeze({ dump: (file, signal) => driver.dump(file, signal), mediaDir: driver.mediaDir }) : null;
    return Object.freeze({ profileId, storeDir: entry.store.storeDir, connection: Object.freeze({ ...entry.connection, writes, managedProfileId: profileId }), data, release });
  }
  function select(profileId, options = {}) {
    const operation = selection.catch(() => {}).then(async () => {
      if (closing) throw new Error('Profile runtime pool is shutting down');
      if (foreground?.profileId === profileId && foreground.connection.writes === (options.writes ?? false)) {
        if (options.source) {
          const entry = entries.get(profileId);
          if (path.resolve(options.source) !== entry.descriptor.source) throw new Error('Cannot rebind a running profile source');
        }
        return Object.freeze({ profileId, storeDir: foreground.storeDir, connection: foreground.connection });
      }
      const next = await acquire(profileId, { ...options, ownerId: 'foreground:' + crypto.randomUUID() });
      try { registry.selectProfile(profileId); } catch (error) { await next.release(); throw error; }
      const previous = foreground; foreground = next;
      // B is authoritative now. A cleanup failure must not look like a rejected
      // selection (which could leave the renderer displaying A while routing B).
      let cleanupWarning = null;
      try { await previous?.release(); } catch (error) { cleanupWarning = error.message; }
      return Object.freeze({ profileId, storeDir: next.storeDir, connection: next.connection, cleanupWarning });
    });
    selection = operation;
    return operation;
  }
  function clearSelection() {
    const operation = selection.catch(() => {}).then(async () => {
      const previous = foreground; foreground = null;
      await previous?.release();
    });
    selection = operation;
    return operation;
  }
  function selectWithoutRuntime(profileId) {
    const operation = selection.catch(() => {}).then(async () => {
      if (closing) throw new Error('Profile runtime pool is shutting down');
      const store = registry.storeFor(profileId);
      registry.selectProfile(profileId);
      const previous = foreground; foreground = null;
      let cleanupWarning = null;
      try { await previous?.release(); } catch (error) { cleanupWarning = error.message; }
      return Object.freeze({ profileId, storeDir: store.storeDir, connection: null, cleanupWarning });
    });
    selection = operation;
    return operation;
  }
  async function shutdown() {
    closing = true;
    await selection.catch(() => {});
    await clearSelection();
    const outstanding = [...entries.values()].filter(entry => entry.refs.size);
    if (outstanding.length) throw new Error('Runtime shutdown is waiting for active run leases; cancel and await provider cleanup first');
    const results = await Promise.allSettled([...entries.values()].map(drain));
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
    if (errors.length) throw new AggregateError(errors, 'Some owned profile runtimes could not stop');
  }
  function status() {
    return [...entries.values()].map(entry => ({ profileId: entry.profileId, owners: [...entry.refs.values()], phase: entry.runtime?.status().phase || (entry.error ? 'failed' : 'starting'), error: entry.error?.message || null }));
  }
  return Object.freeze({ acquire, select, selectWithoutRuntime, clearSelection, shutdown, status });
}

module.exports = { managedDescriptor, createProfileRuntimePool, validateDescriptor };
