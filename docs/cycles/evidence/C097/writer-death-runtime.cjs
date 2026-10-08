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
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-C097-killed-runtime-'));
const main = path.join(repo, 'app/main');
const originalBoot = fs.readFileSync(path.join(main, 'local-barkpark-boot.exs'));
const probe = fs.readFileSync(path.join(__dirname, 'writer-death-runtime.exs'));
const boot = path.join(data, 'probe-boot.exs'); fs.writeFileSync(boot, Buffer.concat([originalBoot, Buffer.from('\n'), probe]));
const resources = require(path.join(main, 'external-resource'));
const originalResource = resources.externalResource;
resources.externalResource = name => name === 'local-barkpark-boot.exs' ? boot : originalResource(name);
const { SourceDriver } = require(path.join(main, 'local-barkpark-source'));
resources.externalResource = originalResource;
const { LocalBarkpark } = require(path.join(main, 'local-barkpark'));
const { createUpstreamAdmission } = require(path.join(main, 'upstream-admission'));
const report = { source: git(repo, ['rev-parse', 'HEAD']), upstream: pin, host: `${process.platform} ${os.release()} ${process.arch}`, startedAt: new Date().toISOString(), status: 'running', data, checks: [], files: {},
  limits: ['One internal Content.Mutations caller, 20 tag creates, one disposable Windows runtime. HTTP hold/refusal/recovery and full readback are real. Test-only existing process barrier and appended boot probe; no production endpoint or source changes. No media/blob, power-loss, real-library or HTTP-request-process death claim.'] };
for (const file of ['writer-death-runtime.cjs', 'writer-death-runtime.exs']) report.files[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
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
  const absent = async () => { let checked = 0; for (let i = 0; i < 20; i++) for (const id of [`c097-killed-${i}`, `drafts.c097-killed-${i}`]) { const response = await http('GET', `/v1/data/doc/production/tag/${id}?perspective=raw`); assert.equal(response.status, 404, id); checked++; } return checked; };
  const started = performance.now();
  try {
    await runtime.start(); report.buildFingerprint = driver.build?.fingerprint;
    fs.writeFileSync(path.join(data, 'probe-start'), 'start\n');
    await until(() => fs.existsSync(path.join(data, 'probe-barrier.json')), 'transaction barrier missing');
    const barrier = JSON.parse(fs.readFileSync(path.join(data, 'probe-barrier.json')));
    assert.equal(barrier.inside_transaction, true);
    const begun = await admission.hold(connection, 'kill-during-transaction'); assert.equal(begun.phase, 'closing');
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-refused'))).status, 503);
    fs.writeFileSync(path.join(data, 'probe-kill'), 'kill owned writer\n');
    await until(() => fs.existsSync(path.join(data, 'probe-killed.json')), 'writer death missing');
    const dead = await until(async () => { const seen = await admission.instance(connection); return seen.phase === 'recovery_required' && seen.writers === 0 ? seen : null; }, 'admission did not retain recovery');
    assert.equal(dead.pending, 1); assert.equal(dead.deadWriters, 1);
    await assert.rejects(admission.awaitHeld(connection, begun.capability), { code: 'upstream_drain_failed' });
    await assert.rejects(admission.reopen(connection, begun.capability));
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-refused'))).status, 503);
    const checked = await absent();
    report.checks.push({ name: 'Killed after first successful mutation inside transaction; recovery blocks writers; entire batch absent', barrier, dead, checkedDraftAndPublishedIds: checked }); save();
    await runtime.stop(); await runtime.start();
    const restarted = await admission.instance(connection); assert.equal(restarted.phase, 'recovery_required'); assert.equal(restarted.pending, 1); assert.ok(restarted.generation > dead.generation); assert.notEqual(restarted.boot, dead.boot);
    assert.equal((await http('POST', '/v1/data/mutate/production', mutation('c097-refused'))).status, 503);
    await assert.rejects(admission.recover(connection, { generation: dead.generation, pending: 1 }), { code: 'upstream_admission_closed' });
    await assert.rejects(admission.recover(connection, { generation: restarted.generation, pending: 0 }), { code: 'upstream_recovery_refused' });
    const afterRestart = await absent();
    const recovered = await admission.recover(connection, { generation: restarted.generation, pending: restarted.pending }); assert.equal(recovered.phase, 'open'); assert.equal(recovered.generation, restarted.generation + 1);
    const reopened = await admission.instance(connection); assert.equal(reopened.pending, 0); assert.equal(reopened.phase, 'open');
    const wrote = await http('POST', '/v1/data/mutate/production', mutation('c097-after-recovery')); assert.ok(wrote.status >= 200 && wrote.status < 300, JSON.stringify(wrote.body));
    const read = await http('GET', '/v1/data/doc/production/tag/drafts.c097-after-recovery?perspective=raw'); assert.equal(read.status, 200); assert.ok(JSON.stringify(read.body).includes('c097-after-recovery'));
    for (const id of ['c097-refused', 'drafts.c097-refused']) assert.equal((await http('GET', `/v1/data/doc/production/tag/${id}?perspective=raw`)).status, 404);
    report.checks.push({ name: 'Restart preserves exclusion; stale recovery refused; reconciled explicit recovery permits acknowledged HTTP write/readback', restarted, checkedDraftAndPublishedIds: afterRestart, recovered, reopened });
    assert.equal(git(source, ['rev-parse', 'HEAD']), pin); assert.equal(git(source, ['status', '--porcelain']), '');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = String(error.stack || error); process.exitCode = 1; }
  finally {
    try { await runtime.stop(); assert.equal(runtime.status().phase, 'stopped'); assert.equal(fs.existsSync(path.join(data, 'pgdata/postmaster.pid')), false); report.cleanup = 'owned runtime stopped'; }
    catch (error) { report.status = 'failed'; report.cleanupError = String(error); process.exitCode = 1; }
    report.elapsedMs = Math.round(performance.now() - started); save(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, elapsedMs: report.elapsedMs, error: report.error, output }));
  }
})().catch(error => { report.status = 'failed'; report.error = String(error.stack || error); save(); console.error(error); process.exitCode = 1; });
