// Switch rehearsal, first half (C083): hold a managed runtime through the trusted
// endpoint, prove an admin write is refused while held, reopen, prove it is admitted,
// then restart while held and prove the restart stays blocked with the old capability
// refused. Needs a built upstream checkout that carries the coordinator and the
// endpoint (BARKDOWN_TEST_BP_SOURCE). Private ports and data; nothing shared is touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const { createUpstreamAdmission } = require('../main/upstream-admission');
const { request } = require('../main/barkpark');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-hold-'));
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const instanceId = 'rehearsal-' + crypto.randomBytes(4).toString('hex');
const driver = new SourceDriver({ source, port: 4551, pgPort: 5551, writeAdmission: { instanceId } }, data, secrets);
const runtime = new LocalBarkpark(driver, { interval: 1000, retries: 1 });
runtime.on('status', s => console.log(s.phase, s.error || ''));
const connection = { server: driver.server, token: secrets.token };
const admission = createUpstreamAdmission();
const schema = { name: 'rehearsal_note', title: 'Rehearsal note', visibility: 'public', fields: [] };
const write = () => request(connection, 'POST', '/v1/schemas/production', schema);
const refused = async () => { try { await write(); return null; } catch (error) { return error; } };
console.log('Isolated runtime data:', data, 'instance', instanceId);
try {
  await runtime.start();
  assert.equal(runtime.status().phase, 'ready');
  assert.ok(fs.existsSync(path.join(data, 'write-admission.dets')), 'journal provisioned beside the runtime');
  const held = await admission.hold(connection, 'rehearsal');
  assert.equal(held.phase, 'held'); assert.ok(held.capability); assert.equal(held.operation, 'rehearsal');
  console.log('held', { generation: held.generation, boot: held.boot });
  const first = await refused();
  assert.equal(first?.status, 503, 'admin write refused while held'); assert.equal(first?.code, 'storage_unavailable');
  assert.equal((await admission.status(connection, held.capability)).phase, 'held');
  const reopened = await admission.reopen(connection, held.capability);
  assert.equal(reopened.phase, 'open'); assert.equal(reopened.generation, held.generation + 1);
  await assert.rejects(admission.status(connection, held.capability), { code: 'upstream_hold_unknown' });
  assert.equal(await refused(), null, 'admin write admitted after reopen');
  console.log('PASS hold refuses an admin write, reopen admits it, the old capability refuses.');
  const again = await admission.hold(connection, 'rehearsal-2');
  assert.equal(again.phase, 'held');
  await runtime.stop();
  await runtime.start();
  assert.equal(runtime.status().phase, 'ready');
  const afterRestart = await refused();
  assert.equal(afterRestart?.status, 503, 'restart while held stays blocked'); assert.equal(afterRestart?.code, 'storage_unavailable');
  assert.match(String(afterRestart?.message || ''), /switched|admitted/);
  await assert.rejects(admission.status(connection, again.capability), { code: 'upstream_hold_unknown' });
  await assert.rejects(admission.hold(connection, 'rehearsal-3'), { code: 'upstream_admission_closed' });
  console.log('PASS restart while held stays blocked: writes refused, old capability unknown, a new hold refused (explicit recovery required).');
} finally { await runtime.stop(); }
