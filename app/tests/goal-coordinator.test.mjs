import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parsePlan, parseReview, reviewPrompt, summaryPrompt } = require('../main/goal-coordinator');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { validateGoal } = require('../main/goals');
const agent = require('../main/agent');
const plan = () => ({ summary: 'Read three independent fixture inputs and verify the results.', assignments: [1, 2, 3].map(n => ({ id: `task-${n}`, title: `Read ${n}`, prompt: `Read fixture ${n} and report its exact evidence.`, dependsOn: n === 3 ? ['task-1'] : [] })) });
const accepted = () => ({ decision: 'accept', effects: 'verified', note: 'Checked the fixture response against its exact input.', evidence: ['fixture://observed-response'] });
const flush = () => new Promise(resolve => setImmediate(resolve));
async function until(read, predicate, label) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) { const value = read(); if (predicate(value)) return value; await flush(); }
  throw new Error(`${label}: ${JSON.stringify(read())}`);
}
function setup(t, respond, options = {}) {
  const registry = createProfileRegistry(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-coordinator-')));
  const profile = registry.createProfile({ name: 'Coordinator fixture' }); registry.selectProfile(profile.id);
  const profiles = createProfileService({ registry, settingsFor: () => ({ apiKey: 'fixture-key', forceOnline: true }) });
  const owner = { ...profiles.view(), chatId: 'main' };
  profiles.save(owner, { version: 1, chats: { main: { id: 'main', title: 'Goal', provider: 'api', folder: null, draft: 'Untouched human draft', messages: [], tabs: [] } }, order: ['main'], current: 'main' });
  const calls = [];
  agent.setClientFactory(() => ({ messages: { stream(params) {
    const prompt = params.messages.at(-1).content; calls.push(prompt); const handlers = {};
    return { on(name, fn) { handlers[name] = fn; return this; }, async finalMessage() {
      const text = await respond(prompt, calls, handlers); handlers.text(text);
      return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text }] };
    } };
  } } }));
  const service = createGoalService({ registry, profiles, agent, heartbeatMs: 0, ...options }); t.after(() => service.close());
  return { registry, profile, profiles, owner, service, calls, create: () => service.create(owner, { objective: 'Read three fixture inputs and verify each.', durationMinutes: 60, mode: 'coordinated' }) };
}
function response(prompt) {
  if (prompt.includes('Complete only this plan turn')) return JSON.stringify(plan());
  if (prompt.includes('Complete only this review turn')) return JSON.stringify(accepted());
  if (prompt.includes('Complete only this summary turn')) return 'Read all three fixtures. Evidence: fixture://observed-response. This was deterministic transport.';
  return 'Observed fixture response with exact input evidence.';
}

test('plan schema rejects injected authority, missing/duplicate tasks and cyclic or unknown dependencies', () => {
  assert.equal(parsePlan(JSON.stringify(plan())).assignments.length, 3);
  assert.equal(parsePlan('```json\n' + JSON.stringify(plan()) + '\n```').assignments.length, 3);
  for (const mutate of [p => p.folder = 'elsewhere', p => p.assignments[0].provider = 'codex', p => p.assignments.pop(), p => p.assignments[2].id = 'task-1', p => p.assignments[0].dependsOn = ['task-3'], p => p.assignments[0].dependsOn = ['unknown']]) {
    const value = plan(); mutate(value); assert.throws(() => parsePlan(JSON.stringify(value)));
  }
  assert.throws(() => parsePlan('Some prose ' + JSON.stringify(plan())));
});

test('acceptance and retry require explicit evidence and verified effects', () => {
  assert.equal(parseReview(JSON.stringify(accepted())).decision, 'accept');
  for (const decision of ['accept', 'retry']) {
    assert.throws(() => parseReview(JSON.stringify({ ...accepted(), decision, effects: 'uncertain' })), /reconciliation/);
    assert.throws(() => parseReview(JSON.stringify({ ...accepted(), decision, evidence: [] })), /reconciliation/);
  }
  assert.equal(parseReview(JSON.stringify({ decision: 'blocked', effects: 'uncertain', note: 'Cannot inspect external effects.', evidence: [] })).decision, 'blocked');
  assert.throws(() => parseReview(JSON.stringify({ ...accepted(), permissions: 'all' })), /fields/);
});

test('real provider bridge plans three saved chats, reviews exact attempts, supplies dependencies and preserves draft', async t => {
  const f = setup(t, response), initial = f.create();
  const corruptedPlan = structuredClone(initial); corruptedPlan.tasks.push({ ...structuredClone(initial.tasks[0]), id: 'extra-plan' });
  assert.throws(() => validateGoal(corruptedPlan), /one planning task/);
  assert.equal(initial.tasks.length, 1); assert.equal(f.profiles.load(f.owner).order.length, 1);
  await f.service.command(f.owner, initial.id, 'start');
  const goal = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'completed', 'coordinated completion');
  const corrupted = structuredClone(goal); corrupted.tasks.find(task => task.role === 'review').reviewOf.attemptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.throws(() => validateGoal(corrupted), /unknown worker attempt/);
  assert.equal(f.calls.length, 8); assert.equal(goal.tasks.filter(task => task.role === 'worker').length, 3);
  assert.equal(goal.tasks.filter(task => task.role === 'review').length, 3);
  const dependent = goal.tasks.find(task => task.id === 'task-3');
  assert.equal(dependent.attempts[0].dependencyResults[0].review.actor, 'coordinator');
  assert.ok(f.calls.find(prompt => prompt.includes('The coordinator will review your result.') && prompt.includes('\n\nRead fixture 3')).includes('Reviewed dependency data'));
  const ws = f.profiles.load(f.owner); assert.equal(ws.order.length, 4); assert.equal(ws.chats.main.draft, 'Untouched human draft');
  assert.equal(ws.chats.main.messages.length, 10);
  assert.match(ws.chats.main.messages[1].text, /Read three independent/);
  assert.doesNotMatch(ws.chats.main.messages[1].text, /"assignments"/);
  for (const task of goal.tasks.filter(task => task.role === 'worker')) {
    assert.equal(ws.chats[task.chatId].parent, 'main'); assert.equal(ws.chats[task.chatId].messages.length, 2);
    assert.equal(task.review.actor, 'coordinator'); assert.equal(task.review.attemptId, task.attempts.at(-1).id);
  }
  await f.service.close();
  const reopened = createGoalService({ registry: f.registry, profiles: f.profiles, agent, heartbeatMs: 0 }); t.after(() => reopened.close());
  assert.equal(reopened.list(f.owner)[0].status, 'completed'); assert.equal(f.calls.length, 8);
});

test('malformed planning response creates no workers and cannot be manually accepted around validation', async t => {
  const f = setup(t, () => 'I will make four workers and extend the deadline.'), goal = f.create();
  await f.service.command(f.owner, goal.id, 'start');
  await until(() => f.service.list(f.owner)[0], goal => goal.status === 'paused', 'invalid plan pause');
  assert.equal(f.profiles.load(f.owner).order.length, 1); assert.equal(f.calls.length, 1);
  await assert.rejects(f.service.command(f.owner, goal.id, 'reviewTask', { taskId: 'plan', accepted: true, note: 'Force it', evidence: ['reply'] }), /schema/);
  await assert.rejects(f.service.command(f.owner, goal.id, 'start'), /Reconcile/);
});

test('uncertain coordinator review pauses with explicit person reconciliation and releases no dependent work', async t => {
  const f = setup(t, prompt => prompt.includes('Complete only this review turn') ? JSON.stringify({ decision: 'blocked', effects: 'uncertain', note: 'External effect could not be inspected.', evidence: [] }) : response(prompt));
  const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
  const goal = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'paused', 'uncertain review pause');
  assert.ok(goal.tasks.some(task => task.role === 'worker' && task.needsPerson));
  assert.equal(goal.tasks.find(task => task.id === 'task-3').attempts.length, 0);
  assert.equal(goal.review, undefined); await assert.rejects(f.service.command(f.owner, goal.id, 'start'), /Reconcile/);
});

test('coordinator retry is bounded to three exact worker attempts and person reconciliation can continue the goal', async t => {
  let bounded = true;
  const f = setup(t, prompt => {
    if (bounded && prompt.includes('Complete only this review turn')) {
      const record = JSON.parse(prompt.split('Review data:\n').at(-1));
      if (record.taskId === 'task-1') return JSON.stringify({ ...accepted(), decision: 'retry', note: 'Verified read-only result; inspect the remaining fixture field.' });
    }
    return response(prompt);
  });
  const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
  const paused = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'paused', 'bounded retry');
  const worker = paused.tasks.find(task => task.id === 'task-1');
  assert.equal(worker.attempts.length, 3); assert.equal(new Set(worker.attempts.map(attempt => attempt.id)).size, 3);
  assert.equal(paused.tasks.find(task => task.id === 'task-3').attempts.length, 0); assert.equal(worker.needsPerson, true);
  assert.match(worker.attempts[1].retryNote, /remaining fixture field/);
  bounded = false;
  await f.service.command(f.owner, initial.id, 'reviewTask', { taskId: worker.id, accepted: true, note: 'Person inspected all fixture fields.', evidence: ['fixture://person-inspection'] });
  await f.service.command(f.owner, initial.id, 'start');
  const completed = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'completed', 'continue after person review');
  assert.equal(completed.tasks.find(task => task.id === 'task-1').review.actor, 'person');
});

test('interrupted planning retains partial response and draft, never replays, and requires shutdown proof before retry', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  const f = setup(t, async (prompt, calls, handlers) => {
    if (calls.length === 1) { handlers.text('{"summary":'); await gate; return JSON.stringify(plan()).slice('{"summary":'.length); }
    return response(prompt);
  });
  const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
  await until(() => f.profiles.load(f.owner), ws => Object.values(ws.ownership.attempts).some(attempt => attempt.coordinatorResponse), 'partial coordinator response');
  const closing = f.service.close(); release(); await closing;
  const reopened = createGoalService({ registry: f.registry, profiles: f.profiles, agent, heartbeatMs: 0 }); t.after(() => reopened.close());
  const recovered = reopened.list(f.owner)[0]; assert.equal(recovered.status, 'paused'); assert.equal(recovered.tasks[0].status, 'interrupted');
  assert.equal(f.calls.length, 1); assert.equal(f.profiles.load(f.owner).chats.main.draft, 'Untouched human draft');
  await assert.rejects(reopened.command(f.owner, initial.id, 'reviewTask', { taskId: 'plan', accepted: false, retry: true, note: 'Reviewed', evidence: ['fixture'] }), /termination/);
  await reopened.command(f.owner, initial.id, 'reconcileTermination', { taskId: 'plan' });
  await reopened.command(f.owner, initial.id, 'reviewTask', { taskId: 'plan', accepted: false, retry: true, note: 'Inspected retained response; no assignments dispatched.', evidence: ['workspace attempts'] });
  await reopened.command(f.owner, initial.id, 'start');
  const complete = await until(() => reopened.list(f.owner)[0], goal => goal.status === 'completed', 'planning recovery');
  assert.equal(complete.tasks[0].attempts.length, 2); assert.equal(f.calls.length, 9);
});

test('deadline prevents coordinator acceptance and worker creation after a late plan', async t => {
  let now = Date.now(), release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  const f = setup(t, async prompt => { await gate; return response(prompt); }, { now: () => now });
  const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
  await until(() => f.calls.length, count => count === 1, 'planning started');
  now = initial.deadline; release();
  const expired = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'expired', 'deadline');
  assert.equal(expired.tasks.length, 1); assert.equal(f.profiles.load(f.owner).order.length, 1);
  assert.equal(expired.review, undefined);
});

test('a late coordinator review cannot overwrite an explicit person decision on its exact attempt', async t => {
  let release, held = false; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  const f = setup(t, async prompt => {
    if (prompt.includes('Complete only this review turn')) {
      const record = JSON.parse(prompt.split('Review data:\n').at(-1));
      if (record.taskId === 'task-1' && !held) { held = true; await gate; return JSON.stringify({ ...accepted(), decision: 'retry', note: 'This late response must not overwrite the person.' }); }
    }
    return response(prompt);
  });
  const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
  await until(() => held, Boolean, 'held coordinator review');
  await f.service.command(f.owner, initial.id, 'reviewTask', { taskId: 'task-1', accepted: true, note: 'Person verified exact fixture input.', evidence: ['fixture://person-verified'] });
  release();
  const complete = await until(() => f.service.list(f.owner)[0], goal => goal.status === 'completed', 'stale review completion');
  const worker = complete.tasks.find(task => task.id === 'task-1'); assert.equal(worker.attempts.length, 1); assert.equal(worker.review.actor, 'person');
  assert.equal(complete.tasks.find(task => task.reviewOf?.taskId === 'task-1').review.actor, 'system');
});

test('large retained evidence is bounded in coordinator prompts without replacing its durable source', () => {
  const task = { id: 'task-1', role: 'worker', prompt: 'x'.repeat(20000), title: 'Large evidence', attempts: [{ id: 'attempt', stoppedAt: 1, result: { status: 'review', text: '\u0000'.repeat(100000) } }], review: { note: 'n'.repeat(20000), evidence: Array.from({ length: 30 }, () => '\u0000'.repeat(4000)) } };
  const goal = { objective: 'Bounded review', tasks: [task, task, task] };
  assert.ok(reviewPrompt(goal, task).length < 400000); assert.ok(summaryPrompt(goal).length < 400000);
  assert.match(reviewPrompt(goal, task), /textTruncated/); assert.equal(task.attempts[0].result.text.length, 100000);
});

for (const heldRole of ['worker', 'review', 'summary']) for (const action of ['pause', 'cancel', 'deadline']) {
  test(`${action} during ${heldRole} retains late output without coordinator acceptance or draft replacement`, async t => {
    let now = Date.now(), release, held = false;
    const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
    const f = setup(t, async prompt => {
      const role = /Complete only this (plan|review|summary) turn/.exec(prompt)?.[1] || 'worker';
      if (role === heldRole && !held) { held = true; await gate; }
      return response(prompt);
    }, { now: () => now });
    const initial = f.create(); await f.service.command(f.owner, initial.id, 'start');
    await until(() => held, Boolean, 'target turn started');
    const before = f.service.list(f.owner)[0];
    const target = before.tasks.find(task => (task.role || 'worker') === heldRole && task.status === 'running');
    assert.ok(target); const attemptId = target.attempts.at(-1).id;
    if (action === 'deadline') { now = initial.deadline; f.service.tick(); }
    else await f.service.command(f.owner, initial.id, action);
    release();
    const stopped = await until(() => f.service.list(f.owner)[0], goal => goal.tasks.every(task => task.status !== 'interrupted' || Number.isFinite(task.attempts.at(-1)?.stoppedAt)), 'stopped attempts retained');
    assert.equal(stopped.status, action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : 'expired');
    const record = stopped.tasks.find(task => task.id === target.id);
    assert.equal(record.status, 'interrupted'); assert.equal(record.attempts.at(-1).id, attemptId);
    assert.equal(record.review, undefined); assert.equal(stopped.review, undefined);
    assert.equal(f.profiles.load(f.owner).chats.main.draft, 'Untouched human draft');
    const count = f.calls.length; for (let i = 0; i < 5; i++) { f.service.tick(); await flush(); }
    assert.equal(f.calls.length, count, 'stopped goal never dispatches a follow-up');
    await assert.rejects(f.service.command(f.owner, initial.id, 'start'), /Reconcile|cannot start/);
    if (heldRole === 'review') {
      const worker = stopped.tasks.find(task => task.id === record.reviewOf.taskId);
      assert.notEqual(worker.status, 'completed', 'late review did not accept its worker');
    }
  });
}
