import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { admissionEnv, createUpstreamAdmission, route } = require('../main/upstream-admission');

test('admissionEnv names the journal beside the runtime and initialises only a missing one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-admission-'));
  const first = admissionEnv(dir, 'profile-1');
  assert.equal(first.BARKPARK_WRITE_ADMISSION_INSTANCE, 'profile-1');
  assert.equal(first.BARKPARK_WRITE_ADMISSION_JOURNAL, path.join(dir, 'write-admission.dets'));
  assert.equal(first.BARKPARK_WRITE_ADMISSION_INITIALIZE, '1');
  fs.writeFileSync(first.BARKPARK_WRITE_ADMISSION_JOURNAL, '');
  assert.equal('BARKPARK_WRITE_ADMISSION_INITIALIZE' in admissionEnv(dir, 'profile-1'), false);
  assert.throws(() => admissionEnv(dir, 'Not Valid'), { code: 'upstream_instance' });
  assert.throws(() => admissionEnv('relative', 'ok'), { code: 'upstream_journal' });
});

function fixture() {
  const state = { hold: null, generation: 3, boot: 'boot-a', calls: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      state.calls.push([req.method, req.url, req.headers.authorization]);
      const send = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
      const error = (status, code, message) => send(status, { error: { code, message } });
      if (state.disabled) return error(503, 'feature_not_configured', 'write admission is not enabled on this instance');
      if (req.headers.authorization !== 'Bearer admin') return error(403, 'forbidden', 'access denied');
      const view = () => ({ capability: state.hold.capability, operation: state.hold.operation, phase: state.phase, generation: state.generation, boot: state.boot });
      if (req.method === 'POST' && req.url === route) {
        const { operation } = JSON.parse(body || '{}');
        if (!operation) return error(400, 'invalid_operation', 'operation is required');
        if (state.hold && state.hold.operation !== operation) return error(409, 'admission_closed', 'another operation holds this instance');
        if (!state.hold) { state.hold = { capability: 'cap-' + operation, operation }; state.phase = state.pending ? 'closing' : 'held'; }
        return send(state.phase === 'held' ? 200 : 202, view());
      }
      const base = route.slice(0, -'/hold'.length);
      if (req.method === 'GET' && req.url === base) return send(200, { phase: state.phase || 'open', generation: state.generation, boot: state.boot, pending: state.pendingRoots || 0, operation: state.hold?.operation ?? null, held: state.hold?.operation ?? null });
      if (req.method === 'POST' && req.url === base + '/recover') {
        const { generation, pending } = JSON.parse(body || '{}');
        if (!Number.isInteger(generation) || !Number.isInteger(pending)) return error(400, 'invalid_recovery', 'both integers');
        if (state.phase !== 'recovery_required') return error(409, 'recovery_refused', 'not in recovery');
        if (generation !== state.generation) return error(409, 'admission_closed', 'stale generation');
        if (pending !== (state.pendingRoots || 0)) return error(409, 'recovery_refused', 'pending moved');
        state.phase = 'open'; state.hold = null; state.generation++; state.pendingRoots = 0;
        return send(200, { phase: 'open', generation: state.generation, boot: state.boot });
      }
      const capability = req.url.startsWith(route + '/') ? req.url.slice(route.length + 1) : null;
      if (!state.hold || capability !== state.hold.capability) return error(404, 'not_found', 'no current hold answers to that capability');
      if (req.method === 'GET') { if (state.pending && --state.pending === 0) state.phase = 'held'; return send(200, view()); }
      if (req.method === 'DELETE') { state.hold = null; state.generation++; return send(200, { phase: 'open', generation: state.generation, boot: state.boot }); }
      error(405, 'method_not_allowed', 'no');
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ state, server, connection: { server: `http://127.0.0.1:${server.address().port}`, token: 'admin' } })));
}

test('hold, status, reconcile, reopen and stale capability against a fake runtime', async t => {
  const { state, server, connection } = await fixture();
  t.after(() => server.close());
  const admission = createUpstreamAdmission();
  const held = await admission.hold(connection, 'switch-1');
  assert.deepEqual(held, { capability: 'cap-switch-1', operation: 'switch-1', phase: 'held', generation: 3, boot: 'boot-a' });
  assert.deepEqual(await admission.status(connection, held.capability), held);
  assert.equal((await admission.hold(connection, 'switch-1')).capability, held.capability);
  await assert.rejects(admission.hold(connection, 'switch-2'), { code: 'upstream_admission_closed' });
  const reopened = await admission.reopen(connection, held.capability);
  assert.equal(reopened.phase, 'open'); assert.equal(reopened.generation, 4);
  await assert.rejects(admission.status(connection, held.capability), { code: 'upstream_hold_unknown' });
  await assert.rejects(admission.reopen(connection, held.capability), { code: 'upstream_hold_unknown' });
  await assert.rejects(admission.hold(connection, ''), { code: 'upstream_operation' });
  await assert.rejects(admission.hold({ ...connection, token: 'junior' }, 'switch-3'), { code: 'upstream_forbidden' });
  state.disabled = true;
  await assert.rejects(admission.hold(connection, 'switch-3'), { code: 'upstream_admission_unavailable' });
  assert.ok(state.calls.every(([, , auth]) => auth?.startsWith('Bearer ')));
});

test('awaitHeld polls a closing hold to held and refuses a drain that ends elsewhere', async t => {
  const { state, server, connection } = await fixture();
  t.after(() => server.close());
  const admission = createUpstreamAdmission();
  state.pending = 2;
  const closing = await admission.hold(connection, 'switch-9');
  assert.equal(closing.phase, 'closing');
  const held = await admission.awaitHeld(connection, closing.capability, { intervalMs: 1 });
  assert.equal(held.phase, 'held');
  state.phase = 'recovery_required';
  await assert.rejects(admission.awaitHeld(connection, closing.capability, { intervalMs: 1 }), { code: 'upstream_drain_failed' });
  state.phase = 'closing';
  let clock = 0;
  await assert.rejects(admission.awaitHeld(connection, closing.capability, { intervalMs: 1, timeoutMs: 5, now: () => (clock += 10), sleep: async () => {} }), { code: 'upstream_drain_timeout' });
});

test('an unreachable runtime is reported as unreachable, not as a hold', async () => {
  const admission = createUpstreamAdmission();
  await assert.rejects(admission.hold({ server: 'http://127.0.0.1:9', token: 'admin' }, 'switch'), { code: 'upstream_unreachable' });
});

test('instance view and explicit recovery', async t => {
  const { state, server, connection } = await fixture();
  t.after(() => server.close());
  const admission = createUpstreamAdmission();
  assert.equal((await admission.instance(connection)).phase, 'open');
  await assert.rejects(admission.recover(connection, { generation: 3, pending: 0 }), { code: 'upstream_recovery_refused' });
  state.phase = 'recovery_required'; state.pendingRoots = 1;
  const view = await admission.instance(connection);
  assert.deepEqual(view, { phase: 'recovery_required', generation: 3, boot: 'boot-a', pending: 1, writers: null, deadWriters: null, operation: null, held: null });
  await assert.rejects(admission.recover(connection, { generation: 2, pending: 1 }), { code: 'upstream_admission_closed' });
  await assert.rejects(admission.recover(connection, { generation: 3, pending: 0 }), { code: 'upstream_recovery_refused' });
  await assert.rejects(admission.recover(connection, { generation: '3', pending: 1 }), { code: 'upstream_recovery' });
  const recovered = await admission.recover(connection, { generation: 3, pending: 1 });
  assert.equal(recovered.phase, 'open'); assert.equal(recovered.generation, 4);
  assert.equal((await admission.instance(connection)).pending, 0);
});

// A journal can resume an interrupted empty hold, but cannot reconcile unrelated writer effects.
test('a reconciling hold recovers an empty runtime journal, then holds; any other refusal is passed on', async () => {
  const { holdReconciled } = require('../main/upstream-admission');
  const calls = [], runtime = { phase: 'recovery_required', generation: 4, pending: 0, writers: 0, deadWriters: 0 };
  const admission = {
    hold: async (_c, operation) => { calls.push(['hold', operation]); if (runtime.phase !== 'open') throw Object.assign(new Error('closed'), { code: 'upstream_admission_closed' }); runtime.phase = 'held'; return { phase: 'held', capability: 'cap-12345678', generation: 5 }; },
    awaitHeld: async () => assert.fail('already held'), instance: async () => ({ ...runtime }),
    recover: async (_c, proof) => { calls.push(['recover', proof]); runtime.phase = 'open'; return { phase: 'open' }; } };
  const logs = [];
  const held = await holdReconciled(admission, {}, 'select-p1', { log: line => logs.push(line) });
  assert.equal(held.phase, 'held');
  assert.deepEqual(calls, [['hold', 'select-p1'], ['recover', { generation: 4, pending: 0 }], ['hold', 'select-p1']]);
  assert.match(logs[0], /runtime recovered before select-p1: generation 4, 0 unsettled, 0 dead writers/);
  runtime.phase = 'held'; calls.length = 0;
  await assert.rejects(holdReconciled(admission, {}, 'other', { log: () => {} }), { code: 'upstream_admission_closed' }, 'a runtime held by another operation is not recovered');
  assert.deepEqual(calls, [['hold', 'other']]);
  await assert.rejects(holdReconciled({ hold: async () => { throw Object.assign(new Error('no'), { code: 'x' }); } }, {}, 'plain'), { code: 'x' });
});
test('at launch a runtime in recovery is reopened only when no operation is in flight', async () => {
  const { reopenUnowned } = require('../main/upstream-admission');
  const calls = [], runtime = { phase: 'recovery_required', generation: 7, pending: 0, writers: 0, deadWriters: 0 };
  const admission = { instance: async () => ({ ...runtime }), recover: async (_c, proof) => { calls.push(proof); runtime.phase = 'open'; return { phase: 'open' }; } };
  assert.deepEqual(await reopenUnowned(admission, {}, { inFlight: async () => 'the interrupted export', log: () => {} }), { phase: 'recovery_required', reopened: false, owner: 'the interrupted export' });
  assert.deepEqual(calls, []);
  const done = await reopenUnowned(admission, {}, { log: () => {} });
  assert.equal(done.reopened, true); assert.deepEqual(calls, [{ generation: 7, pending: 0 }]);
  assert.deepEqual(await reopenUnowned(admission, {}, { inFlight: async () => assert.fail('open needs no owner'), log: () => {} }), { phase: 'open', reopened: false });
  assert.deepEqual(await reopenUnowned({ instance: async () => { throw new Error('unmanaged'); } }, {}), { phase: 'unmanaged', reopened: false });
});

test('automatic launch and operation recovery never acknowledge uncertain or unverified writer effects', async () => {
  const { reopenUnowned, holdReconciled } = require('../main/upstream-admission');
  const empty = { phase: 'recovery_required', generation: 7, pending: 0, writers: 0, deadWriters: 0 };
  for (const counts of [{ pending: 1 }, { writers: 1 }, { deadWriters: 1 }, { pending: null }, { writers: undefined }, { deadWriters: undefined }, { pending: -1 }, { pending: '0' }]) {
    const seen = { ...empty, ...counts };
    const calls = [];
    const admission = {
      instance: async () => ({ ...seen }),
      hold: async () => { throw Object.assign(new Error('closed'), { code: 'upstream_admission_closed' }); },
      recover: async proof => { calls.push(proof); return { phase: 'open' }; }
    };
    const result = await reopenUnowned(admission, {}, { log: () => {} });
    assert.equal(result.reopened, false, JSON.stringify(counts));
    assert.equal(result.phase, 'recovery_required');
    assert.equal(result.reason, 'unreconciled_writes');
    await assert.rejects(holdReconciled(admission, {}, 'export', { log: () => {} }), { code: 'upstream_reconciliation_required' });
    assert.deepEqual(calls, [], 'neither path may acknowledge effects by copying their count');
  }
});
