import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createProfileLaunchAdmission } = require('../main/profile-launch-admission');
const { createGoalService } = require('../main/goal-service');
const { GoalAdmission } = require('../main/goal-admission');
const runs = require('../main/providers/runs');
const snapshot = { version: 1, chats: { same: { id: 'same', title: 'Same', provider: 'api', folder: null, messages: [], tabs: [] } }, order: ['same'], current: 'same' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-launch-admission-'));
  const registry = createProfileRegistry(root), a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
  registry.selectProfile(a.id);
  const profiles = createProfileService({ registry, ...options });
  profiles.save(profiles.view(), snapshot);
  return { root, registry, a, b, profiles };
}

test('closure is durable, idempotent and profile-owned; reads never create a record', () => {
  const f = setup(), gate = f.profiles.launchAdmission, aPath = path.join(f.registry.storeFor(f.a.id).storeDir, 'profile-launch-admission.json');
  assert.equal(gate.isClosed(f.a.id), false); assert.equal(fs.existsSync(aPath), false);
  const closed = gate.close(f.a.id), bytes = fs.readFileSync(aPath);
  assert.deepEqual(gate.close(f.a.id), closed); assert.deepEqual(fs.readFileSync(aPath), bytes);
  const restarted = createProfileLaunchAdmission({ registry: f.registry });
  assert.equal(restarted.isClosed(f.a.id), true); assert.throws(() => restarted.assertOpen(f.a.id), { code: 'BARKDOWN_PROFILE_PREPARING' });
  assert.equal(restarted.isClosed(f.b.id), false);
  fs.writeFileSync(path.join(f.registry.storeFor(f.b.id).storeDir, 'profile-launch-admission.json'), bytes);
  assert.throws(() => restarted.assertOpen(f.b.id), /ownership changed/);
  fs.renameSync(aPath, aPath + '.retained');
  assert.throws(() => gate.assertOpen(f.a.id), /disappeared/);
});

test('malformed preparation refuses instead of resetting or silently opening', () => {
  const f = setup(), file = path.join(f.registry.storeFor(f.a.id).storeDir, 'profile-launch-admission.json');
  for (const bytes of ['{', 'null', '{}']) {
    fs.writeFileSync(file, bytes);
    assert.throws(() => f.profiles.launchAdmission.assertOpen(f.a.id));
    assert.throws(() => f.profiles.launchAdmission.close(f.a.id));
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  }
});

for (const boundary of ['runtime', 'authentication']) test(`closure during delayed ${boundary} refuses dispatch and releases its runtime`, async () => {
  const entered = deferred(), gate = deferred(); let acquired = 0, released = 0, dispatched = 0;
  const f = setup({ agent: { async start() { dispatched++; throw Error('Unexpected dispatch'); } },
    settingsFor: () => ({ provider: 'api', barkpark: { local: { enabled: true, source: 'fixture' } } }),
    runtimePool: { async acquire() { acquired++; if (boundary === 'runtime') { entered.resolve(); await gate.promise; } return { connection: { enabled: false }, release: async () => { released++; } }; } },
    assertAuthentication: async () => { if (boundary === 'authentication') { entered.resolve(); await gate.promise; } } });
  const owner = f.profiles.view(), pending = f.profiles.start(owner, { chatId: 'same', prompt: 'Wait' });
  const refusal = assert.rejects(pending, { code: 'BARKDOWN_PROFILE_PREPARING' });
  await entered.promise;
  f.profiles.launchAdmission.close(f.a.id);
  assert.equal(released, 0, 'launch closure is not a lease-drain claim');
  gate.resolve(); await refusal;
  assert.equal(released, 1); assert.equal(dispatched, 0);
  await assert.rejects(f.profiles.start(owner, { chatId: 'same', prompt: 'New turn' }), { code: 'BARKDOWN_PROFILE_PREPARING' });
  assert.equal(acquired, 1, 'new turn refuses before runtime acquisition');
  assert.equal(f.profiles.workspaces.load(f.a.id).chats.same.messages.length, 0);
  const restarted = createProfileService({ registry: f.registry });
  await assert.rejects(restarted.start(restarted.view(), { chatId: 'same', prompt: 'After restart' }), { code: 'BARKDOWN_PROFILE_PREPARING' });
});

test('capacity-release notifications cannot admit a closed profile but other profiles can acquire', async () => {
  const f = setup(), gate = f.profiles.launchAdmission, admission = new GoalAdmission(1, { canAcquire: id => !gate.isClosed(id) });
  const release = admission.acquire({ profileId: f.a.id, chatId: 'one', attemptId: 'one' });
  let successor;
  admission.subscribe(() => { successor = admission.acquire({ profileId: f.a.id, chatId: 'two', attemptId: 'two' }); });
  gate.close(f.a.id); release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(successor, null); assert.deepEqual(admission.snapshot(), []);
  const other = admission.acquire({ profileId: f.b.id, chatId: 'two', attemptId: 'two' });
  assert.equal(typeof other, 'function'); other();
});

test('goal create/start and every service tick stay closed across restart while other profiles work', async t => {
  const f = setup(), calls = [];
  const service = createGoalService({ registry: f.registry, profiles: f.profiles, agent: { start() { calls.push('launched'); throw Error('Unexpected launch'); } }, heartbeatMs: 0 });
  t.after(() => service.close());
  const owner = { ...f.profiles.view(), chatId: 'same' }, plan = { objective: 'Launch test', durationMinutes: 60, assignments: [1, 2, 3].map(i => ({ title: 'Worker ' + i, prompt: 'Wait ' + i })) };
  const goal = service.create(owner, plan);
  f.profiles.launchAdmission.close(f.a.id);
  assert.throws(() => service.create(owner, plan), { code: 'BARKDOWN_PROFILE_PREPARING' });
  await assert.rejects(service.command(owner, goal.id, 'start'), { code: 'BARKDOWN_PROFILE_PREPARING' });
  service.tick(); assert.equal(service.list(owner)[0].status, 'planned');
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(calls, []);
  await f.profiles.select(owner, f.b.id); const other = { ...f.profiles.view(), chatId: 'same' }; f.profiles.save(other, snapshot);
  assert.equal(service.create(other, plan).status, 'planned');
  const scope = await f.profiles.resolve(f.b.id, 'same'); await scope.release();
  await service.close();
  const restarted = createGoalService({ registry: f.registry, profiles: f.profiles, agent: {}, heartbeatMs: 0 }); t.after(() => restarted.close());
  await f.profiles.select(other, f.a.id); const fresh = { ...f.profiles.view(), chatId: 'same' };
  assert.equal(restarted.list(fresh)[0].status, 'planned');
  await assert.rejects(restarted.command(fresh, goal.id, 'start'), { code: 'BARKDOWN_PROFILE_PREPARING' });
});

test('reviewing a finished worker cannot launch newly eligible dependent workers after closure', async t => {
  const started = deferred(), finish = deferred(); let launched = 0;
  const agent = { ...runs, async start(options) {
    launched++; const run = runs.createRun(options);
    run.emit({ type: 'status', model: 'fixture' }); started.resolve();
    finish.promise.then(async () => { run.emit({ type: 'text_delta', text: 'Verified result' }); run.emit({ type: 'done' }); await runs.finish(run); });
    return { runId: run.id };
  } };
  const f = setup(), service = createGoalService({ registry: f.registry, profiles: f.profiles, agent, heartbeatMs: 0 });
  t.after(async () => { finish.resolve(); await service.close(); });
  const owner = { ...f.profiles.view(), chatId: 'same' };
  const goal = service.create(owner, { objective: 'Dependents remain queued', durationMinutes: 60, assignments: [1, 2, 3].map(i => ({ title: 'Worker ' + i, prompt: 'Result ' + i, dependsOn: i === 1 ? [] : ['task-1'] })) });
  await service.command(owner, goal.id, 'start'); await started.promise;
  f.profiles.launchAdmission.close(f.a.id); finish.resolve();
  for (let i = 0; i < 100 && service.list(owner)[0].tasks[0].status !== 'review'; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(service.list(owner)[0].tasks[0].status, 'review');
  await service.command(owner, goal.id, 'reviewTask', { taskId: 'task-1', accepted: true, note: 'Observed fixture result', evidence: ['fixture-result'] });
  service.tick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(launched, 1); assert.deepEqual(service.list(owner)[0].tasks.map(task => task.status), ['completed', 'pending', 'pending']);
  await assert.rejects(service.command(owner, goal.id, 'reviewTask', { taskId: 'task-2', accepted: false, retry: true, note: 'Must refuse before retry' }), { code: 'BARKDOWN_PROFILE_PREPARING' });
});

test('ordinary dispatch rechecks closure after the authentication wrapper resolves', async () => {
  let f, dispatched = 0;
  f = setup({ agent: { async start() { dispatched++; throw Error('Unexpected provider dispatch'); } },
    assertAuthentication: async () => { queueMicrotask(() => queueMicrotask(() => f.profiles.launchAdmission.close(f.a.id))); } });
  await assert.rejects(f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Keep this unsent' }), { code: 'BARKDOWN_PROFILE_PREPARING' });
  assert.equal(dispatched, 0);
  assert.equal(f.profiles.workspaces.load(f.a.id).chats.same.messages.length, 0, 'Refuse before transcript reservation');
});

test('goal dispatch rechecks closure after the authentication wrapper resolves', async t => {
  let f, dispatched = 0;
  f = setup({ assertAuthentication: async () => { queueMicrotask(() => queueMicrotask(() => f.profiles.launchAdmission.close(f.a.id))); } });
  const service = createGoalService({ registry: f.registry, profiles: f.profiles, agent: { async start() { dispatched++; throw Error('Unexpected provider dispatch'); } }, heartbeatMs: 0 });
  t.after(() => service.close());
  const owner = { ...f.profiles.view(), chatId: 'same' };
  const goal = service.create(owner, { objective: 'Close before launch', durationMinutes: 60, assignments: [1, 2, 3].map(i => ({ title: 'Worker ' + i, prompt: 'Wait ' + i })) });
  await service.command(owner, goal.id, 'start');
  for (let i = 0; i < 100 && service.list(owner)[0].tasks.some(task => task.status === 'running'); i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(dispatched, 0);
  for (const task of goal.tasks) assert.equal(f.profiles.workspaces.load(f.a.id).chats[task.chatId].messages.length, 0);
});

const turn = () => new Promise(resolve => setImmediate(resolve));
test('ordinary drain waits for pending acquisition and its asynchronous release without blocking B', async () => {
  const acquiring = deferred(), acquisition = deferred(), releasing = deferred(), released = deferred();
  const f = setup({ settingsFor: () => ({ barkpark: { local: { enabled: true, source: 'fixture' } } }),
    runtimePool: { async acquire() { acquiring.resolve(); await acquisition.promise; return { connection: { enabled: false }, async release() { releasing.resolve(); await released.promise; } }; },
      async selectWithoutRuntime(id) { f.registry.selectProfile(id); return {}; }, async select(id) { f.registry.selectProfile(id); return {}; } } });
  const start = f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Pending' });
  const rejected = assert.rejects(start, { code: 'BARKDOWN_PROFILE_PREPARING' });
  await acquiring.promise;
  let drained = false;
  const drain = f.profiles.drainOrdinary(f.a.id).then(result => { drained = true; return result; });
  await turn(); assert.equal(drained, false);
  await f.profiles.select(f.profiles.view(), f.b.id); f.profiles.save(f.profiles.view(), snapshot);
  assert.equal(f.profiles.launchAdmission.isClosed(f.b.id), false);
  acquisition.resolve(); await releasing.promise; await turn(); assert.equal(drained, false);
  released.resolve(); await rejected;
  assert.deepEqual(await drain, { profileId: f.a.id, closureId: f.profiles.launchAdmission.read(f.a.id).id, scope: 'ordinary' });
});

test('ordinary drain cancels a late dispatch and waits for driver, lease and transcript completion', async () => {
  const dispatch = deferred(), returnStart = deferred(), releasing = deferred(), releaseDone = deferred();
  let run, checked = 0, releaseCount = 0;
  const agent = { ...runs, async start(options) {
    dispatch.resolve(); await returnStart.promise;
    run = runs.createRun(options); run.emit({ type: 'status', model: 'fixture' }); return { runId: run.id };
  }, async verifyTermination({ request, runId }) {
    checked++; assert.equal(request.profileId, run.scope.profileId); assert.equal(runId, run.id);
    assert.equal(releaseCount, 1); assert.equal(runs.runs.has(runId), false); return true;
  } };
  const f = setup({ agent, settingsFor: () => ({ barkpark: { local: { enabled: true, source: 'fixture' } } }),
    runtimePool: { async acquire() { return { connection: { enabled: false }, async release() { releaseCount++; releasing.resolve(); await releaseDone.promise; } }; } } });
  const owner = f.profiles.view(), start = f.profiles.start(owner, { chatId: 'same', prompt: 'Late dispatch' });
  await dispatch.promise;
  let drained = false; const drain = f.profiles.drainOrdinary(f.a.id).then(result => { drained = true; return result; });
  await turn(); assert.equal(drained, false);
  returnStart.resolve(); const result = await start;
  assert.equal(run.cancelled, true); await turn(); assert.equal(drained, false); assert.equal(checked, 0);
  run.emit({ type: 'text_delta', text: 'Retained partial answer' }); run.emit({ type: 'done', cancelled: true });
  const finish = runs.finish(run); await releasing.promise; await turn(); assert.equal(drained, false);
  releaseDone.resolve(); await finish; await drain;
  const ws = f.profiles.workspaces.load(f.a.id);
  assert.equal(ws.ownership.attempts[result.attemptId].driverFinished, true);
  assert.equal(ws.chats.same.messages.at(-1).text, 'Retained partial answer'); assert.equal(checked, 1);
});

test('a driver flag without native proof cannot pass ordinary drain on retry or restart', async () => {
  let run, verified = 0;
  const agent = { ...runs, async start(options) { run = runs.createRun(options); return { runId: run.id }; },
    async verifyTermination() { verified++; return false; } };
  const f = setup({ agent }), owner = f.profiles.view();
  const result = await f.profiles.start(owner, { chatId: 'same', prompt: 'No receipt' });
  run.emit({ type: 'done' }); await runs.finish(run); await f.profiles.wait(owner, result.runId);
  assert.equal(f.profiles.workspaces.load(f.a.id).ownership.attempts[result.attemptId].driverFinished, true);
  await assert.rejects(f.profiles.drainOrdinary(f.a.id), /shutdown is unverified/);
  await assert.rejects(f.profiles.drainOrdinary(f.a.id), /shutdown is unverified/);
  const restarted = createProfileService({ registry: f.registry, agent });
  await assert.rejects(restarted.drainOrdinary(f.a.id), /shutdown is unverified/);
  assert.equal(verified, 3); assert.equal(restarted.launchAdmission.isClosed(f.a.id), true);
});

test('runtime release failure remains a preparation fault after the pending start rejects', async () => {
  const entered = deferred(), gate = deferred(); let count = 0;
  const f = setup({ settingsFor: () => ({ barkpark: { local: { enabled: true, source: 'fixture' } } }),
    runtimePool: { async acquire() { entered.resolve(); await gate.promise; return { connection: { enabled: false }, async release() { count++; throw Error('fixture release failed'); } }; } } });
  const start = f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Pending' });
  const refused = assert.rejects(start, /fixture release failed/); await entered.promise;
  const drain = assert.rejects(f.profiles.drainOrdinary(f.a.id), /fixture release failed/);
  gate.resolve(); await refused; await drain;
  await assert.rejects(f.profiles.drainOrdinary(f.a.id), /fixture release failed/); assert.equal(count, 1);
});

test('restart drain verifies interrupted ownership but preserves the separate effects review', async () => {
  let run;
  const f = setup({ agent: { ...runs, async start(options) { run = runs.createRun(options); run.emit({ type: 'status' }); return { runId: run.id }; } } });
  const result = await f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Interrupted' });
  const restarted = createProfileService({ registry: f.registry, agent: { async verifyTermination({ request, runId }) {
    assert.equal(request.profileId, f.a.id); assert.equal(request.attemptId, result.attemptId); assert.equal(runId, result.runId); return true;
  } } });
  await assert.rejects(restarted.drainOrdinary(f.a.id), /transcripts require recovery/);
  assert.equal(restarted.workspaces.load(f.a.id).ownership.attempts[result.attemptId].driverFinished, false);
  runs.cancel(run.id); await runs.finish(run); await f.profiles.wait(f.profiles.view(), run.id);
});

for (const fault of ['foreign', 'cleanup']) test(`ordinary drain retains ${fault} completion failure after native verification`, async () => {
  let run;
  const f = setup({ agent: { ...runs,
    async start(options) { run = runs.createRun(options); run.emit({ type: 'status' }); return { runId: run.id }; },
    async waitForRunFinish(id) { const result = await runs.waitForRunFinish(id); return { ...result, ...(fault === 'foreign' ? { profileId: 'foreign' } : { status: 'cleanup-failed', cleanupFailed: true }) }; },
    async verifyTermination() { return true; },
  } });
  const owner = f.profiles.view(), result = await f.profiles.start(owner, { chatId: 'same', prompt: 'Fault' });
  const expected = fault === 'foreign' ? /Completion ownership mismatch/ : /cleanup is unconfirmed/;
  const failed = assert.rejects(f.profiles.wait(owner, result.runId), expected);
  run.emit({ type: 'done' }); await runs.finish(run); await failed;
  await assert.rejects(f.profiles.drainOrdinary(f.a.id), expected);
  assert.equal(f.profiles.workspaces.load(f.a.id).ownership.attempts[result.attemptId].driverFinished, false);
  await f.profiles.recover(owner, { chatId: 'same', attemptId: result.attemptId, action: 'review', note: 'Verified owned shutdown and reviewed retained fixture effects.' });
  assert.equal((await f.profiles.drainOrdinary(f.a.id)).scope, 'ordinary', 'Explicit recovery must retire the old in-process failure');
});

test('native ordinary preparation drains A child/grandchild and preserves the running B tree', { skip: process.platform !== 'win32', timeout: 30000 }, async t => {
  const trees = new Map(), readyA = deferred(), readyB = deferred(), started = [];
  const agent = require('../main/goal-worker-agent').createOwnedWorkerAgent({ script: require.resolve('./fixtures/profile-drain-worker.cjs') });
  const f = setup({ agent, sendEvent(event) {
    if (event.type === 'text_delta') { trees.set(event.profileId, JSON.parse(event.text)); (trees.size === 1 ? readyA : readyB).resolve(); }
  } });
  t.after(async () => { for (const run of started) { agent.cancel(run.runId); await agent.waitForRunFinish(run.runId).catch(() => {}); } });
  const a = await f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Owned A' }); started.push(a); await readyA.promise;
  await f.profiles.select(f.profiles.view(), f.b.id); f.profiles.save(f.profiles.view(), snapshot);
  const b = await f.profiles.start(f.profiles.view(), { chatId: 'same', prompt: 'Owned B' }); started.push(b); await readyB.promise;
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  assert.ok(Object.values(trees.get(f.a.id)).every(alive)); assert.ok(Object.values(trees.get(f.b.id)).every(alive));
  const result = await f.profiles.drainOrdinary(f.a.id);
  assert.equal(result.scope, 'ordinary'); assert.ok(Object.values(trees.get(f.a.id)).every(pid => !alive(pid)));
  assert.ok(Object.values(trees.get(f.b.id)).every(alive), 'A preparation must not stop the B job');
  const aFile = path.join(f.registry.storeFor(f.a.id).storeDir, 'drain-fixture-effects.txt');
  const bFile = path.join(f.registry.storeFor(f.b.id).storeDir, 'drain-fixture-effects.txt');
  const aBytes = fs.readFileSync(aFile), bBytes = fs.readFileSync(bFile);
  await new Promise(resolve => setTimeout(resolve, 175));
  assert.deepEqual(fs.readFileSync(aFile), aBytes); assert.ok(fs.statSync(bFile).size > bBytes.length);
  const attempt = f.profiles.workspaces.load(f.a.id).ownership.attempts[a.attemptId];
  assert.equal(attempt.driverFinished, true);
  const receiptFile = path.join(f.registry.storeFor(f.a.id).storeDir, 'goal-processes', `${a.attemptId}.receipt.json`);
  const receipt = JSON.parse(fs.readFileSync(receiptFile));
  assert.equal(receipt.phase, 'stopped'); assert.equal(receipt.activeProcesses, 0);
  const restarted = createProfileService({ registry: f.registry, agent });
  assert.deepEqual(await restarted.drainOrdinary(f.a.id), result);
  f.profiles.cancel(f.profiles.view(), b.runId); await f.profiles.wait(f.profiles.view(), b.runId);
  assert.ok(Object.values(trees.get(f.b.id)).every(pid => !alive(pid)));
  t.diagnostic(JSON.stringify({ fixture: f.root, aReceipt: receiptFile, aTree: trees.get(f.a.id), bTree: trees.get(f.b.id), retained: true }));
});
