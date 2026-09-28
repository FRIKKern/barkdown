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
