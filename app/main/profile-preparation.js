// Durable ordering for migration preparation. This is not an engine selector.
// Foreground hooks are trusted host adapters: they must hold all human buffers
// frozen AND close new foreground/terminal writes until explicit reconciliation.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { controller } = require('./writer-admission');
const { createPaperDraftStore } = require('./paper-draft-store');
const { acquireFileLease } = require('./file-lease');
const { atomicWrite } = require('./atomic-write');
const filename = 'profile-preparation.json';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const token = v => v?.version === 1 && uuid(v.owner) && uuid(v.generation);
const same = (a, b) => token(a) && token(b) && a.owner === b.owner && a.generation === b.generation;
const fail = message => { throw Object.assign(new Error(message), { code: 'BARKDOWN_PREPARATION_INCOMPLETE' }); };
const raw = file => { try { return fs.readFileSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

function createProfilePreparation({ registry, profiles, goals, freezeForeground, drainForeground, drainTerminals, checkpoint = () => {} }) {
  for (const operation of [freezeForeground, drainForeground, drainTerminals, profiles?.drainOrdinary, goals?.drain]) {
    if (typeof operation !== 'function') throw new TypeError('Preparation requires foreground, terminal and agent drain adapters.');
  }
  const bindings = new Map(), flights = new Map(), held = new Map();
  function binding(profileId) {
    const root = registry.storeFor(profileId).storeDir;
    if (!bindings.has(profileId)) {
      const store = createStore(root, { create: false });
      bindings.set(profileId, { store, control: controller(store), drafts: createPaperDraftStore({ store, profileId }), seen: null });
    }
    const b = bindings.get(profileId);
    if (b.store.dir() !== root) fail('Preparation profile root changed.');
    return b;
  }
  function read(profileId) {
    const b = binding(profileId), bytes = raw(b.store.filePath(filename));
    if (!bytes) { if (b.seen) fail('Preparation evidence disappeared.'); return null; }
    let value; try { value = JSON.parse(bytes); } catch { fail('Preparation evidence is unreadable.'); }
    const closure = profiles.launchAdmission.read(profileId);
    if (value?.version !== 1 || !uuid(value.id) || value.profileId !== profileId || !token(value.writerBefore) ||
      value.writerBefore.owner !== b.control.capture().owner || closure?.id !== value.closureId ||
      !['collecting', 'draining', 'quiescing', 'prepared'].includes(value.phase) ||
      !Array.isArray(value.draftKeys) || value.draftKeys.some(k => !digest(k)) || new Set(value.draftKeys).size !== value.draftKeys.length ||
      b.seen && b.seen !== value.id || ['quiescing', 'prepared'].includes(value.phase) &&
        (!token(value.writerAfter) || value.writerAfter.owner !== value.writerBefore.owner || value.writerAfter.generation === value.writerBefore.generation)) {
      fail('Preparation ownership or phase is invalid.');
    }
    b.seen = value.id;
    return { value, bytes };
  }
  function inspect(profileId) {
    const record = read(profileId);
    return record ? structuredClone(record.value) : null;
  }
  function prepare(profileId) {
    if (flights.has(profileId)) return flights.get(profileId);
    const pending = run(profileId); flights.set(profileId, pending);
    pending.finally(() => flights.delete(profileId)).catch(() => {});
    return pending;
  }
  async function run(profileId) {
    const b = binding(profileId), file = b.store.filePath(filename);
    const lease = acquireFileLease(file + '.lock', { completeOwner: true, busy: 'This profile already has a preparation coordinator.' });
    let frozen = held.get(profileId), crossed = false, releaseToken = null;
    function assertOwned() { lease.assertOwned(); b.store.filePath(filename); }
    function transition(current, value) {
      assertOwned();
      atomicWrite(file, JSON.stringify(value, null, 2) + '\n', { expectedBytes: current?.bytes || null, assertOwned });
      const next = read(profileId);
      checkpoint('after-' + value.phase, structuredClone(value));
      return next;
    }
    async function assertFrozen() {
      assertOwned();
      if (!frozen || frozen.profileId !== profileId || !uuid(frozen.sessionId) || typeof frozen.release !== 'function' || typeof frozen.assertCurrent !== 'function' ||
        await frozen.assertCurrent() !== true) fail('Foreground buffers are not verified frozen. Keep their editors open.');
      assertOwned();
    }
    function verifyDrafts(keys) { for (const key of keys) b.drafts.read(key); }
    try {
      const closure = profiles.launchAdmission.close(profileId);
      let current = read(profileId);
      if (!current) {
        const before = b.control.inspect();
        if (before.phase !== 'open') fail('Writer admission was closed outside this preparation.');
        current = transition(null, { version: 1, id: crypto.randomUUID(), profileId, closureId: closure.id,
          writerBefore: b.control.capture(), phase: 'collecting', draftKeys: [] });
      }
      const state = b.control.inspect();
      crossed = state.phase === 'quiescing';
      if (crossed ? !same(state, current.value.writerAfter) : !same(state, current.value.writerBefore)) fail('Preparation no longer owns the writer generation.');
      if (!crossed) releaseToken = current.value.writerBefore;
      if (current.value.phase === 'prepared' && !crossed) fail('A prepared profile unexpectedly reopened its writers.');
      verifyDrafts(current.value.draftKeys);
      if (!frozen) {
        const candidate = await freezeForeground(profileId, Object.freeze({ preparationId: current.value.id, writerOpen: !crossed,
          retainedKeys: Object.freeze([...current.value.draftKeys]) }));
        if (!candidate || candidate.profileId !== profileId || !uuid(candidate.sessionId) || typeof candidate.release !== 'function') fail('Foreground freeze belongs to another owner or is incomplete.');
        frozen = candidate; held.set(profileId, frozen);
      }
      await assertFrozen();
      if (!Array.isArray(frozen.draftKeys) || frozen.draftKeys.some(k => !digest(k))) fail('Foreground recovery inventory is invalid.');
      const keys = [...new Set([...current.value.draftKeys, ...frozen.draftKeys])].sort();
      verifyDrafts(keys);
      if (crossed && keys.some(k => !current.value.draftKeys.includes(k))) fail('New human buffers appeared after writer closure.');
      if (!crossed) current = transition(current, { ...current.value, phase: 'draining', draftKeys: keys });

      // Start all drains together, but wait for every settlement even on error.
      // A rejected drain must not leave other owned cleanup detached.
      const settled = await Promise.allSettled([
        () => profiles.drainOrdinary(profileId), () => goals.drain(profileId),
        () => drainForeground(profileId), () => drainTerminals(profileId),
      ].map(operation => Promise.resolve().then(operation)));
      const rejected = settled.find(r => r.status === 'rejected');
      if (rejected) throw rejected.reason;
      for (const [index, scope] of ['ordinary', 'goals'].entries()) {
        const receipt = settled[index].value;
        if (receipt?.profileId !== profileId || receipt.closureId !== closure.id || receipt.scope !== scope) fail('An agent drain returned foreign preparation evidence.');
      }
      if (settled[2].value !== true || settled[3].value !== true) fail('Foreground or terminal shutdown is unverified.');
      await assertFrozen(); verifyDrafts(keys);
      if (!crossed) {
        // Journal the intended cut first. An interruption on either side can
        // match the exact old/new generation without guessing another owner's.
        const writerAfter = { version: 1, owner: current.value.writerBefore.owner, generation: crypto.randomUUID() };
        current = transition(current, { ...current.value, phase: 'quiescing', writerAfter });
        b.control.quiesce(current.value.writerBefore, { generation: writerAfter.generation });
        crossed = true;
        checkpoint('after-writer-closure', structuredClone(current.value));
      }
      b.control.assertQuiescent(current.value.writerAfter);
      await assertFrozen(); verifyDrafts(keys);
      // A pending or uncertain writer is never inferred finished from process
      // termination, an empty IPC queue, elapsed time or an earlier receipt.
      b.control.assertQuiescent(current.value.writerAfter);
      if (current.value.phase !== 'prepared') current = transition(current, { ...current.value, phase: 'prepared' });
      return Object.freeze(structuredClone(current.value));
    } catch (error) {
      // Before closure the person can continue editing and retry capture. After
      // closure retain the held freeze until an explicit reconciled transition.
      let mayRelease = false;
      try { const state = b.control.inspect(); mayRelease = state.phase === 'open' && same(state, releaseToken); } catch { /* Unknown authority retains the freeze. */ }
      if (mayRelease && frozen) {
        try { await frozen.release?.(); held.delete(profileId); }
        catch (cleanup) { (error.cleanupErrors ||= []).push(cleanup); }
      }
      throw error;
    } finally { lease.release(); }
  }
  return Object.freeze({ prepare, inspect });
}
module.exports = { createProfilePreparation };
