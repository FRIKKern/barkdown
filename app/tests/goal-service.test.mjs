import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService, registerGoalIpc } = require('../main/goal-service');
const agent = require('../main/agent');
const runs = require('../main/providers/runs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const snapshot = label => ({ version: 1, chats: { main: { id: 'main', title: label, provider: 'api', folder: null, draft: label + ' draft', messages: [], tabs: [] } }, order: ['main'], current: 'main' });
const plan = { objective: 'Prove three independent results', durationMinutes: 60, assignments: [1,2,3].map(i => ({ title: `Worker ${i}`, prompt: `Return result ${i}` })) };
function setup(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goal-service-'));
  const registry = createProfileRegistry(root), a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
  registry.selectProfile(a.id);
  const profiles = createProfileService({ registry, settingsFor: () => ({ apiKey: 'fixture-key', forceOnline: true }), ...options.profile });
  const owner = () => ({ ...profiles.view(), chatId: 'main' });
  profiles.save(owner(), snapshot('A'));
  const changed = [], events = [];
  const service = createGoalService({ registry, profiles, agent, heartbeatMs: 0, sendEvent: event => changed.push(event), sendProviderEvent: event => events.push(event), ...options.goal });
  t.after(() => service.close());
  return { root, registry, a, b, profiles, owner, service, changed, events };
}

test('real provider loops persist three full workers through profile switch, stale save, reload and review', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release()); const f = setup(t);
  let launched = 0;
  agent.setClientFactory(() => ({ messages: { stream(params) {
    launched++; const handlers = {}, n = /Return result (\d)/.exec(params.messages.at(-1).content)[1];
    return { on(name, fn) { handlers[name] = fn; return this; }, async finalMessage() { handlers.text('Started '); await gate; handlers.text(`Observed ${n}`); return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: `Observed ${n}` }] }; } };
  } } }));
  const ownerA = f.owner(), old = f.profiles.load(ownerA), goal = f.service.create(ownerA, plan);
  assert.equal(f.profiles.load(ownerA).order.length, 4);
  assert.ok(goal.tasks.every(task => f.profiles.load(ownerA).chats[task.chatId].side));
  await f.service.command(ownerA, goal.id, 'start'); await flush(); assert.equal(launched, 3);
  assert.ok(f.events.length > 0);
  for (const event of f.events) {
    const attempt = f.profiles.load(ownerA).ownership.attempts[event.attemptId];
    assert.equal(event.assistantId, attempt.assistantId); assert.equal(event.chatId, attempt.chatId);
  }
  const eventCount = f.events.length;
  await f.profiles.select(ownerA, f.b.id); const ownerB = f.owner(); f.profiles.save(ownerB, snapshot('B'));
  release(); for (let i = 0; i < 5; i++) await flush();
  assert.equal(f.events.length, eventCount, 'A background events must not reach B');
  assert.equal(f.profiles.load(ownerB).order.length, 1); assert.equal(f.profiles.load(ownerB).chats.main.draft, 'B draft');
  await assert.rejects(f.service.command(ownerA, goal.id, 'cancel'), /Stale/);
  await f.profiles.select(ownerB, f.a.id); const fresh = f.owner();
  assert.throws(() => f.profiles.save(fresh, old), /stale profile view/);
  f.profiles.save(fresh, { ...old, generation: fresh.generation });
  const ws = f.profiles.load(fresh);
  assert.equal(ws.order.length, 4); assert.equal(ws.chats.main.draft, 'A draft');
  for (const task of goal.tasks) {
    const chat = ws.chats[task.chatId];
    assert.equal(chat.messages.length, 2); assert.match(chat.messages[1].text, /Observed/); assert.equal(chat.runId, null);
    assert.equal(Object.values(ws.ownership.attempts).find(a => a.chatId === chat.id).driverFinished, true);
    await f.service.command(fresh, goal.id, 'reviewTask', { taskId: task.id, accepted: true, note: 'Verified persisted reply', evidence: [chat.messages[1].id] });
  }
  assert.equal((await f.service.command(fresh, goal.id, 'complete', { note: 'Checked all three', evidence: ['persisted workspace'] })).status, 'completed');
  await f.service.close();
  const reopened = createGoalService({ registry: f.registry, profiles: f.profiles, heartbeatMs: 0 }); t.after(() => reopened.close());
  assert.equal(reopened.list(fresh)[0].status, 'completed'); assert.equal(launched, 3);
});

test('Start captures current worker choices for planned and paused pending tasks; prior attempt context stays immutable', async t => {
  const dispatched = [];
  const runtime = { ...runs, async start(options) {
    const run = runs.createRun(options); dispatched.push({ options, run }); run.emit({ type: 'status' }); return { runId: run.id };
  } };
  const f = setup(t, { goal: { agent: runtime } }), owner = f.owner();
  t.after(async () => { for (const { run } of dispatched) await runs.finish(run); });
  const goal = f.service.create(owner, { ...plan, assignments: plan.assignments.map((a, i) => ({ ...a, dependsOn: i ? ['task-1'] : [] })) });
  let ws = f.profiles.load(owner);
  Object.assign(ws.chats[goal.tasks[0].chatId], { folder: f.root, provider: 'codex', model: 'chosen-first', effort: 'high' });
  f.profiles.save(owner, ws);
  await f.service.command(owner, goal.id, 'start'); await flush();
  assert.equal(dispatched.length, 1); assert.equal(dispatched[0].options.provider, 'codex'); assert.equal(dispatched[0].options.context.folder, f.root);
  assert.equal(dispatched[0].options.settings.codexModel, 'chosen-first');
  const originalContext = f.service.list(owner)[0].tasks[0].attempts[0].context;
  ws = f.profiles.load(owner); ws.chats[goal.tasks[0].chatId].folder = null; f.profiles.save(owner, ws);
  assert.equal(dispatched[0].options.context.folder, f.root);
  await f.service.command(owner, goal.id, 'pause'); await runs.finish(dispatched[0].run); for (let i=0;i<3;i++) await flush();
  await f.service.command(owner, goal.id, 'reviewTask', { taskId: 'task-1', accepted: true, note: 'Verified external work after stopped driver', evidence: ['fixture-run'] });
  ws = f.profiles.load(owner); Object.assign(ws.chats[goal.tasks[1].chatId], { folder: f.root, provider: 'claude', model: 'chosen-second', effort: 'low' }); f.profiles.save(owner, ws);
  await f.service.command(owner, goal.id, 'start'); await flush();
  assert.equal(dispatched.length, 3); assert.equal(dispatched[1].options.provider, 'claude'); assert.equal(dispatched[1].options.settings.claudeModel, 'chosen-second');
  assert.deepEqual(f.service.list(owner)[0].tasks[0].attempts[0].context, originalContext);
  for (const { run } of dispatched.slice(1)) { run.emit({ type: 'done' }); await runs.finish(run); }
  for(let i=0;i<3;i++) await flush();
});

test('goal IPC delegates to generation gate and rejects worker coordinators and foreign goal access', async t => {
  const f = setup(t), goal = f.service.create(f.owner(), plan), handlers = new Map();
  registerGoalIpc({ register: (name, fn) => handlers.set(name, fn), profiles: f.profiles, service: f.service });
  assert.equal(handlers.get('goals:list')('main')[0].id, goal.id);
  assert.throws(() => handlers.get('goals:list')(goal.tasks[0].chatId), /recursive goals/);
  assert.throws(() => f.service.create(f.owner(), { ...plan, assignments: [] }), /three/);
  const ws = f.profiles.load(f.owner()); ws.chats.other = { ...snapshot('other').chats.main, id: 'other' }; ws.order.push('other'); f.profiles.save(f.owner(), ws);
  await assert.rejects(f.service.command({ ...f.owner(), chatId: 'other' }, goal.id, 'start'), /another coordinator/);
  assert.equal(f.service.list(f.owner())[0].status, 'planned');
  const sideWs = f.profiles.load(f.owner()); Object.assign(sideWs.chats.other, { side: true, parent: 'main' }); f.profiles.save(f.owner(), sideWs);
  const sideGoal = f.service.create({ ...f.owner(), chatId: 'other' }, plan);
  assert.equal(sideGoal.chatId, 'other');
  assert.ok(sideGoal.tasks.every(task => f.profiles.load(f.owner()).chats[task.chatId].parent === 'other'));
});

test('recovered reservation cannot be reviewed or retried until trusted shutdown verification', async t => {
  let proven = false;
  const f = setup(t, { goal: { verifyTermination: async () => proven } });
  const owner = f.owner(), goal = f.service.create(owner, plan); await f.service.close();
  const store = f.registry.storeFor(f.a.id), journal = store.readJson('goals.json');
  const task = journal.goals[0].tasks[0];
  const attemptId = '11111111-1111-4111-8111-111111111111';
  task.status = 'running'; task.attempts = [{ id: attemptId, status: 'running', startedAt: Date.now() }]; journal.goals[0].status = 'active'; store.writeJson('goals.json', journal);
  const request = { profileId: f.a.id, chatId: task.chatId, coordinatorChatId: 'main', goalId: goal.id, taskId: task.id, attemptId, prompt: task.prompt, images: [], provider: 'api' };
  const resolved = await f.profiles.resolve(f.a.id, task.chatId); f.profiles.workspaces.begin(request, resolved); await resolved.release();
  const service = createGoalService({ registry: f.registry, profiles: f.profiles, heartbeatMs: 0, verifyTermination: async () => proven }); t.after(() => service.close());
  const review = { taskId: task.id, accepted: false, retry: true, note: 'Guess', evidence: ['unverified'] };
  assert.equal(service.list(owner)[0].tasks[0].status, 'interrupted');
  await assert.rejects(service.command(owner, goal.id, 'reviewTask', review), /termination/);
  await assert.rejects(service.command(owner, goal.id, 'reconcileTermination', { taskId: task.id, proof: true }), /not been established/);
  const second = service.create(owner, plan); await assert.rejects(service.command(owner, second.id, 'start'), /Reconcile/);
  proven = true; await service.command(owner, goal.id, 'reconcileTermination', { taskId: task.id });
  assert.equal(f.profiles.workspaces.load(f.a.id).ownership.attempts[attemptId].driverFinished, true);
  await service.command(owner, goal.id, 'reviewTask', review);
  assert.equal(service.list(owner).find(g => g.id === goal.id).tasks[0].status, 'pending');
  assert.equal(runs.runs.size, 0);
});
