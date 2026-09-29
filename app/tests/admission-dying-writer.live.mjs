// A writer that dies inside the runtime while a hold drains (carried from C083). One large
// write is admitted and still running when the hold begins; its connection is cut. Asked of
// the real runtime: does the drain end in recovery, what does the instance view say, does
// explicit recovery reopen it, and what is left of the write. Run through the isolated harness
// with BARKDOWN_SHOTS_WRITE_ADMISSION=1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUpstreamAdmission } = require('../main/upstream-admission');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-dying-writer');
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['One machine, one disposable runtime, one run. The writer is one large mutate request whose connection is cut from the client; a writer killed by the operating system or a failing disk is not produced here.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const connection = { server, token, dataset: 'production' }, port = Number(new URL(server).port);
const admission = createUpstreamAdmission();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function http(method, route, body) {
  const response = await fetch(server + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000) });
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data };
}
const run = crypto.randomBytes(3).toString('hex');
const batch = (name, n) => ({ mutations: Array.from({ length: n }, (_, i) => ({ createOrReplace: { _id: `${name}-${run}-${i}`, _type: 'tag', title: `${name} ${i}` } })) });
const present = async (name, n) => { let found = 0; for (const i of [0, Math.floor(n / 2), n - 1]) { const r = await http('GET', `/v1/data/doc/production/tag/${name}-${run}-${i}?perspective=raw`); if (r.status === 200) found++; } return found; };
try {
  // How long one large write takes here, so the cut lands while it runs.
  let size = 400, took = 0;
  for (;;) {
    const started = Date.now(), answer = await http('POST', '/v1/data/mutate/production', batch('measure' + size, size));
    assert.ok(answer.status < 300, JSON.stringify(answer.data).slice(0, 400));
    took = Date.now() - started;
    if (took >= 1500 || size >= 12000) break;
    size *= 2;
  }
  report.checks.push({ name: 'A large write is slow enough to be in flight', mutations: size, tookMs: took }); persist();
  assert.ok(took >= 600, 'the write must run long enough to cut it');

  const body = JSON.stringify(batch('dying', size));
  const socket = net.connect(port, '127.0.0.1');
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  socket.on('error', () => {});
  socket.write(`POST /v1/data/mutate/production HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAuthorization: Bearer ${token}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n` + body);
  // Wait until the runtime says a writer is admitted.
  let seen; const waitFrom = Date.now();
  for (;;) { seen = await admission.instance(connection); if (seen.writers >= 1) break; if (Date.now() - waitFrom > took) throw new Error('The write was never seen admitted: ' + JSON.stringify(seen)); await sleep(10); }
  const begun = await admission.hold(connection, 'dying-writer-' + run);
  assert.equal(begun.phase, 'closing', 'the hold waits for the admitted writer');
  const duringDrain = await admission.instance(connection);
  socket.destroy();
  const cutAt = Date.now();
  let after;
  for (;;) { after = await admission.instance(connection); if (after.phase !== 'closing') break; if (Date.now() - cutAt > took * 4 + 10000) break; await sleep(50); }
  report.checks.push({ name: 'The connection of the admitted writer is cut while the hold drains', admittedView: seen, duringDrain, afterCut: after, settledMs: Date.now() - cutAt }); persist();

  if (after.phase === 'held') {
    // The runtime finished the write although its client was gone: there was no death to recover from.
    const found = await present('dying', size);
    await admission.reopen(connection, begun.capability);
    report.checks.push({ name: 'The writer outlived its connection and settled; the hold was reached and reopened', sampledPresent: found });
    report.finding = 'A cut connection does not kill an admitted writer on this runtime; the drain completes.';
  } else {
    assert.equal(after.phase, 'recovery_required', JSON.stringify(after));
    await assert.rejects(admission.awaitHeld(connection, begun.capability, { timeoutMs: 5000 }), { code: 'upstream_drain_failed' });
    const refused = await http('POST', '/v1/data/mutate/production', batch('refused', 1));
    assert.equal(refused.status, 503, 'a runtime in recovery refuses writers');
    const found = await present('dying', size);
    assert.ok(found === 0 || found === 3, `the cut write is whole or absent, never partial (sampled ${found} of 3)`);
    const recovered = await admission.recover(connection, { generation: after.generation, pending: after.pending });
    assert.equal(recovered.phase, 'open');
    const again = await http('POST', '/v1/data/mutate/production', batch('after', 1));
    assert.ok(again.status < 300, 'writers are admitted again after recovery');
    report.checks.push({ name: 'The drain ends in recovery; writers are refused; the cut write is whole or absent; explicit recovery with the generation and pending count read reopens the runtime', sampledPresent: found, recovered });
    report.finding = 'A cut connection kills the admitted writer; the hold ends in recovery_required and needs explicit recovery.';
  }
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
