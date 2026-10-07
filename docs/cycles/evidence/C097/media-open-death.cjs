// Real private SourceDriver, with only its boot resource redirected to append
// the fault probe. All content/admission/storage implementations stay unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const source = path.resolve(repo, '../barkpark-windows-return');
const output = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'New output folder required'); fs.mkdirSync(output);
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const pin = git(source, ['rev-parse', 'HEAD']);
assert.equal(pin, '944a57a1e0b2a210d44e5215c13519a378d6efb8');
assert.equal(git(source, ['status', '--porcelain']), '');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-C097-open-death-'));
const main = path.join(repo, 'app/main');
const originalBoot = fs.readFileSync(path.join(main, 'local-barkpark-boot.exs'));
const probe = fs.readFileSync(path.join(__dirname, 'media-open-death.exs'));
const boot = path.join(data, 'probe-boot.exs'); fs.writeFileSync(boot, Buffer.concat([originalBoot, Buffer.from('\n'), probe]));
const resources = require(path.join(main, 'external-resource'));
const originalResource = resources.externalResource;
resources.externalResource = name => name === 'local-barkpark-boot.exs' ? boot : originalResource(name);
const { SourceDriver } = require(path.join(main, 'local-barkpark-source'));
resources.externalResource = originalResource;
const { LocalBarkpark } = require(path.join(main, 'local-barkpark'));
const { createUpstreamAdmission, reopenUnowned, holdReconciled } = require(path.join(main, 'upstream-admission'));
const report = { source: git(repo, ['rev-parse', 'HEAD']), upstream: pin, host: `${process.platform} ${os.release()} ${process.arch}`, startedAt: new Date().toISOString(), status: 'running', data, checks: [], files: {},
  limits: ['Disposable PostgreSQL BEFORE INSERT trigger/advisory lock instruments the failure boundary. Pinned runtime code is unchanged. The writer dies before any hold. Orphan retained, no recovery acknowledgement or reopening. Demonstrates the distinct open-admission journal boundary; not a repaired upload or full reconciliation.'] };
for (const file of ['media-open-death.cjs', 'media-open-death.exs']) report.files[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); save();
const free = () => new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, timeout = 30000) { const deadline = Date.now() + timeout; for (;;) { const error = path.join(data, 'probe-error.txt'); if (fs.existsSync(error)) throw Error(fs.readFileSync(error, 'utf8')); const answer = await fn(); if (answer) return answer; if (Date.now() >= deadline) throw Error(label); await sleep(25); } }
(async () => {
  const port = await free(); let pgPort = await free(); while (pgPort === port) pgPort = await free();
  const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
  const driver = new SourceDriver({ source, port, pgPort, writeAdmission: { instanceId: 'c097-kill-' + crypto.randomBytes(6).toString('hex') } }, data, secrets);
  const runtime = new LocalBarkpark(driver);
  const admission = createUpstreamAdmission(), connection = { server: driver.server, token: secrets.token, dataset: 'production' };
  const http = async (method, route, body) => { const response = await fetch(driver.server + route, { method, headers: { authorization: 'Bearer ' + secrets.token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) }); return { status: response.status, body: await response.json() }; };
  const mutation = id => ({ mutations: [{ createOrReplace: { _id: id, _type: 'tag', title: id } }] });
  const readProbe = name => JSON.parse(fs.readFileSync(path.join(data, name)));
  const payloads = { orphan: Buffer.from('Unacknowledged orphan bytes\n'.repeat(257)), control: Buffer.from('Acknowledged control bytes\n'.repeat(263)) };
  const checkMedia = (snap, expected) => { assert.deepEqual(snap, expected); assert.equal(snap.orphan.row_count, 0); for (const [key, bytes] of Object.entries(payloads)) { assert.equal(snap[key].sha256, crypto.createHash('sha256').update(bytes).digest('hex')); assert.equal(snap[key].stored_bytes, bytes.length); } assert.notEqual(snap.orphan.sha256, snap.control.sha256); };
  const started = performance.now();
  try {
    await runtime.start(); report.buildFingerprint = driver.build?.fingerprint;
    fs.writeFileSync(path.join(data, 'probe-start'), 'start\n');
    await until(() => fs.existsSync(path.join(data, 'probe-barrier.json')), 'transaction barrier missing');
    const barrier = JSON.parse(fs.readFileSync(path.join(data, 'probe-barrier.json')));
    assert.equal(barrier.waiting_lock_count, 1);
    const expectedMedia = { orphan: barrier.orphan, control: readProbe('probe-control.json') };
    checkMedia(expectedMedia, expectedMedia);
    assert.notEqual(expectedMedia.orphan.path, expectedMedia.control.path);
    const beforeDeath = await admission.instance(connection);
    assert.equal(beforeDeath.phase, 'open'); assert.equal(beforeDeath.pending, 1); assert.equal(beforeDeath.writers, 1);
    fs.writeFileSync(path.join(data, 'probe-kill'), 'kill owned writer while admission is open\n');
    await until(() => fs.existsSync(path.join(data, 'probe-killed.json')), 'writer death missing');
    const afterDeath = await until(async () => { const seen = await admission.instance(connection); return seen.phase === 'open' && seen.writers === 0 && seen.pending === 0 ? seen : null; }, 'open writer death did not settle as source predicts');
    assert.equal(afterDeath.deadWriters, 0);
    await until(() => fs.existsSync(path.join(data, 'probe-after-kill.json')), 'after-kill readback missing');
    const afterKill = readProbe('probe-after-kill.json'); checkMedia(afterKill, expectedMedia);
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-open-after-death'))).status, 200);
    report.checks.push({ name: 'Death before hold drops pending root and accepts a later write while rowless original remains', beforeDeath, afterDeath, expectedMedia, afterKill }); save();
    await runtime.stop(); await runtime.start();
    const restarted = await admission.instance(connection); assert.equal(restarted.phase, 'open'); assert.equal(restarted.pending, 0); assert.equal(restarted.writers, 0); assert.equal(restarted.deadWriters, 0); assert.notEqual(restarted.boot, afterDeath.boot);
    await until(() => fs.existsSync(path.join(data, 'probe-restarted.json')), 'restart media readback missing');
    const afterRestart = readProbe('probe-restarted.json'); checkMedia(afterRestart, expectedMedia);
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-open-after-restart'))).status, 200);
    const held = await holdReconciled(admission, connection, 'inspect-open-death', { log: () => {} });
    assert.equal(held.phase, 'held');
    const heldState = await admission.instance(connection); assert.equal(heldState.pending, 0); assert.equal(heldState.writers, 0); assert.equal(heldState.phase, 'held');
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-held-refusal'))).status, 503);
    report.checks.push({ name: 'Restart stays open with orphan intact; a later hold succeeds with empty journal', restarted, mediaReadback: afterRestart, heldState });
    report.finding = 'Writer death before hold discards the pending root despite a rowless original. Restart stays open; later hold succeeds. Empty admission is not media reconciliation. No recovery acknowledgement, reopening or orphan deletion performed.';
    assert.equal(git(source, ['rev-parse', 'HEAD']), pin); assert.equal(git(source, ['status', '--porcelain']), '');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = String(error.stack || error); process.exitCode = 1; }
  finally {
    try { await runtime.stop(); assert.equal(runtime.status().phase, 'stopped'); assert.equal(fs.existsSync(path.join(data, 'pgdata/postmaster.pid')), false); report.cleanup = 'owned runtime stopped'; }
    catch (error) { report.status = 'failed'; report.cleanupError = String(error); process.exitCode = 1; }
    report.elapsedMs = Math.round(performance.now() - started); save(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, elapsedMs: report.elapsedMs, error: report.error, output }));
  }
})().catch(error => { report.status = 'failed'; report.error = String(error.stack || error); save(); console.error(error); process.exitCode = 1; });
