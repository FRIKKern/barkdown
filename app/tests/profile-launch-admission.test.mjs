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
