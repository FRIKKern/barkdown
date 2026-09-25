// A captured generation admits an entire local/remote mutation, including its
// receipt. Quiescence closes admission; it does not cancel an already-sent HTTP
// request or prove that a stopped child never committed one.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createStore } = require('./store');
const { acquireFileLease } = require('./file-lease');
const { atomicWrite } = require('./atomic-write');
const context = new AsyncLocalStorage();
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code: 'writer_' + code }); };
const same = (a, b) => a?.version === 1 && b?.version === 1 && a.owner === b.owner && a.generation === b.generation;
const validToken = value => value?.version === 1 && uuid(value.owner) && uuid(value.generation);
const bytes = file => { try { return fs.readFileSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; } };
const parsed = value => { try { return JSON.parse(value); } catch { fail('metadata', 'Writer ownership is unreadable; retained files require inspection.'); } };
const sleep = new Int32Array(new SharedArrayBuffer(4));

function controller(inputStore) {
  const store = createStore(inputStore.dir(), { create: false });
  const root = fs.realpathSync(store.dir()), stat = fs.statSync(root, { bigint: true });
  // Older Windows Node returns dev=0 where Electron returns the volume serial.
  // The canonical drive-qualified path and exact inode agree across both; Unix
  // also binds the device so a different mounted filesystem cannot share an ID.
  const rootHash = crypto.createHash('sha256').update(JSON.stringify([process.platform === 'win32' ? root.toLowerCase() : root,
    process.platform === 'win32' ? 'windows' : String(stat.dev), String(stat.ino)])).digest('hex');
  const initialUuid = label => {
    const h = crypto.createHash('sha256').update(label + rootHash).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  };
  const initial = () => ({ version: 1, owner: initialUuid('owner'), generation: initialUuid('generation'), phase: 'open', pending: [] });
  const identityFile = () => store.filePath('writer-identity.json');
  const stateFile = () => store.filePath('writer-state.json');
  function identity(raw) {
    const id = parsed(raw);
    if (id?.version !== 1 || !uuid(id.owner) || !digest(id.rootHash) || id.rootHash !== rootHash) fail('owner', 'Writer identity belongs to a different or changed store.');
    return id;
  }
  function load(allowInitial = false) {
    const rawIdentity = bytes(identityFile()), rawState = bytes(stateFile());
    // Capturing a run stays read-only. A never-written store has one stable
    // generation derived from its actual root identity; first admission commits
    // it. A partially present commitment is always an error, never initialization.
    if (allowInitial && !rawIdentity && !rawState) return { value: initial(), rawIdentity: null, rawState: null };
    if (!rawIdentity || !rawState) fail('metadata', 'Writer ownership is incomplete; no generation was reset.');
    const id = identity(rawIdentity), value = parsed(rawState);
    if (value?.version !== 1 || value.owner !== id.owner || !uuid(value.generation) ||
      !['open', 'quiescing'].includes(value.phase) || !Array.isArray(value.pending) ||
      value.pending.some(p => !p || !uuid(p.id) || !uuid(p.generation) || !Number.isSafeInteger(p.pid) || p.pid < 1 ||
        typeof p.operation !== 'string' || !/^[a-zA-Z0-9:._-]{1,100}$/.test(p.operation) || !['active', 'uncertain'].includes(p.status)) ||
      new Set(value.pending.map(p => p.id)).size !== value.pending.length) fail('metadata', 'Writer state is invalid; no operation was discarded.');
    return { value, rawIdentity, rawState };
  }
  function locked(action) {
    let lease;
    for (let attempt = 0; ; attempt++) {
      try { lease = acquireFileLease(store.filePath('writer-admission.lock'), { completeOwner: true, busy: 'Writer admission is busy' }); break; }
      catch (error) {
        if (error.message !== 'Writer admission is busy' || attempt >= 4) throw error;
        Atomics.wait(sleep, 0, 0, [5, 10, 20, 40][attempt]);
      }
    }
    try { return action(lease); } finally { lease.release(); }
  }
  function save(snapshot, value, lease) {
    if (!snapshot.rawIdentity) {
      const raw = Buffer.from(JSON.stringify({ version: 1, owner: value.owner, rootHash }, null, 2) + '\n');
      atomicWrite(identityFile(), raw, { expectedBytes: null, assertOwned: () => { lease.assertOwned(); store.filePath('writer-identity.json'); } });
      snapshot.rawIdentity = raw;
    }
    atomicWrite(stateFile(), Buffer.from(JSON.stringify(value, null, 2) + '\n'), {
      expectedBytes: snapshot.rawState,
      assertOwned: () => { lease.assertOwned(); if (!bytes(identityFile())?.equals(snapshot.rawIdentity)) fail('owner', 'Writer identity changed.'); },
    });
  }
  function capture(expected) {
    const inherited = context.getStore();
    if (inherited && (!inherited.active || inherited.rootHash !== rootHash)) fail('nested', 'A nested writer cannot change or outlive its captured owner.');
    if (inherited && expected === undefined) { assertAdmission(inherited); return inherited.token; }
    if (expected !== undefined && !validToken(expected)) fail('token', 'A valid captured writer generation is required.');
    const value = load(true).value;
    const token = Object.freeze({ version: 1, owner: value.owner, generation: value.generation });
    if (expected !== undefined && !same(token, expected)) fail('stale', 'This editor or run belongs to an earlier library generation. Writes are stopped; keep unsaved work open.');
    return token;
  }
  function begin(token, operation) {
    if (!/^[a-zA-Z0-9:._-]{1,100}$/.test(operation)) fail('operation', 'Invalid writer operation label.');
    return locked(lease => {
      const snapshot = load(true), value = snapshot.value;
      if (!same(token, value)) fail('stale', 'This editor or run belongs to an earlier library generation. Writes are stopped; keep unsaved work open.');
      if (value.phase !== 'open') fail('closed', 'The library is preparing to change engines; new writes are stopped.');
      if (value.pending.length >= 1000) fail('pending', 'Too many unresolved writes; inspect retained writer evidence before continuing.');
      const item = { id: crypto.randomUUID(), generation: token.generation, pid: process.pid, operation, status: 'active' };
      save(snapshot, { ...value, pending: [...value.pending, item] }, lease);
      return item;
    });
  }
  function finish(token, item, error) {
    locked(lease => {
      const snapshot = load(), value = snapshot.value;
      const pending = value.pending.find(p => p.id === item.id);
      if (value.owner !== token.owner || !pending || pending.generation !== token.generation || pending.pid !== process.pid || pending.status !== 'active') fail('owner', 'Writer completion no longer owns its admission.');
      // A thrown operation may have changed local files or committed remotely.
      // Retain uncertainty without storing document text or exception messages.
      save(snapshot, { ...value, pending: error ? value.pending.map(p => p.id === item.id ? { ...p, status: 'uncertain' } : p) : value.pending.filter(p => p.id !== item.id) }, lease);
    });
  }
  function run(token, operation, action) {
    const inherited = context.getStore();
    if (inherited) {
      if (!inherited.active || !same(inherited.token, token)) fail('nested', 'A nested writer cannot change or outlive its captured owner.');
      assertAdmission(inherited);
      return action();
    }
    const item = begin(token, operation), scope = { token, rootHash, id: item.id, active: true };
    function settle(error) {
      scope.active = false;
      try { finish(token, item, error); }
      catch (cleanup) { if (error) { (error.cleanupErrors ||= []).push(cleanup); } else throw cleanup; }
    }
    return context.run(scope, () => {
      let result;
      try { result = action(); } catch (error) { settle(error); throw error; }
      if (result && typeof result.then === 'function') return Promise.resolve(result).then(value => { settle(); return value; }, error => { settle(error); throw error; });
      settle(); return result;
    });
  }
  function assertAdmission(scope) {
    const { value } = load();
    const item = value.pending.find(p => p.id === scope.id);
    if (scope.rootHash !== rootHash || value.owner !== scope.token.owner || !item || item.generation !== scope.token.generation || item.pid !== process.pid || item.status !== 'active') fail('owner', 'The nested operation no longer owns its writer admission.');
  }
  function quiesce(token) {
    return locked(lease => {
      const snapshot = load(true), value = snapshot.value;
      if (!same(token, value) || value.phase !== 'open') fail('stale', 'Quiescence requires the current open writer generation.');
      const next = { ...value, generation: crypto.randomUUID(), phase: 'quiescing' };
      save(snapshot, next, lease);
      return Object.freeze({ version: 1, owner: next.owner, generation: next.generation });
    });
  }
  function assertQuiescent(token) {
    const { value } = load();
    if (!same(token, value) || value.phase !== 'quiescing') fail('stale', 'The quiescence generation changed.');
    if (value.pending.length) fail('pending', 'Active or uncertain writers remain. Process termination alone does not prove a write was absent.');
    return Object.freeze({ ...token, quiescent: true });
  }
  return Object.freeze({ capture, run, quiesce, assertQuiescent, inspect: () => structuredClone(load(true).value) });
}

// The foreground compatibility facade can follow profile roots, but never
// silently refresh a generation for an already-seen root. Bound run stores use
// eager capture so a delayed child cannot upgrade itself when first writing.
function writerForStore(store, { token, lazy = false } = {}) {
  const bindings = new Map();
  function binding() {
    const root = store.dir();
    if (!bindings.has(root)) { const control = controller(store); bindings.set(root, { control, token: control.capture(token) }); }
    return bindings.get(root);
  }
  if (!lazy) binding();
  return Object.freeze({ get token() { return binding().token; }, run(operation, action) { const b = binding(); return b.control.run(b.token, operation, action); } });
}

const controlFiles = Object.freeze(['writer-identity.json', 'writer-state.json']);
// Adoption already requires closed processes. Preserve these bytes in backups,
// but never transplant a folder's writer authority to the new profile root.
// Cold adoption inventories a snapshot: verify its controls against the actual
// original root, not against the snapshot directory's different identity.
function assertAdoptable(source, original = source) {
  const state = controller(createStore(original, { create: false })).inspect();
  if (state.phase !== 'open' || state.pending.length) fail('pending', 'Legacy writer activity or quiescence requires reconciliation before adoption.');
  const snapshot = createStore(source, { create: false }), origin = createStore(original, { create: false });
  for (const name of controlFiles) {
    const a = bytes(snapshot.filePath(name)), b = bytes(origin.filePath(name));
    if (a ? !b || !a.equals(b) : b !== null) fail('owner', 'Legacy snapshot writer evidence differs from its original.');
  }
}

module.exports = { controller, writerForStore, controlFiles, assertAdoptable };
