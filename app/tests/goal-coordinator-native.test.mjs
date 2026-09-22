import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCoordinatorFixture } from './fixtures/coordinator-http.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, predicate, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) { const value = read(); if (predicate(value)) return value; await delay(40); }
  throw new Error(`${label}: ${JSON.stringify(read())}`);
}
for (const role of ['review', 'summary']) test(`native host death during coordinator ${role} requires shutdown and explicit retry without replaying workers`, { skip: process.platform !== 'win32', timeout: 120000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `bd-coordinator-native-${role}-`));
  const transport = await createCoordinatorFixture({ allowRetries: true, holdRoles: [role] });
  let releaseAll = false;
  const release = setInterval(() => { for (const [key, gate] of transport.gates) if (releaseAll || !key.startsWith(role)) gate.release(); }, 20);
  const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/coordinator-native-host.cjs', import.meta.url)), root], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ANTHROPIC_BASE_URL: transport.url, ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', BARKDOWN_GOAL_DIAGNOSTICS: '1' },
  });
  let stderr = ''; child.stderr.on('data', data => { stderr += data; }); const exited = once(child, 'exit');
  let service;
  const originalUrl = process.env.ANTHROPIC_BASE_URL;
  t.after(async () => { releaseAll = true; if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exited; if (service) await service.close(); clearInterval(release); await transport.close(); if (originalUrl === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = originalUrl; });
  await until(() => fs.existsSync(path.join(root, 'owner.json')), Boolean, 'host initialized');
  const { profileId, goalId } = JSON.parse(fs.readFileSync(path.join(root, 'owner.json')));
  const registry = createProfileRegistry(path.join(root, 'registry'));
  const store = registry.storeFor(profileId);
  await until(() => transport.requests, requests => requests.some(request => request.role === role), `held ${role} HTTP response`);
  const interrupted = await until(() => store.readJson('workspace.json').ownership.attempts, attempts => Object.values(attempts).some(attempt => attempt.role === role && (role === 'review' ? attempt.coordinatorResponse : store.readJson('workspace.json').chats.main.messages.some(message => message.id === attempt.assistantId && message.text))), 'partial response persisted');
  const heldAttemptId = Object.entries(interrupted).find(([, attempt]) => attempt.role === role && !attempt.driverFinished)[0];
  child.kill('SIGKILL'); await exited;
  assert.doesNotMatch(stderr, /Goal scheduler halted:/);
  process.env.ANTHROPIC_BASE_URL = transport.url;
  const profiles = createProfileService({ registry, settingsFor: () => ({ apiKey: 'synthetic-native-key', forceOnline: true }) });
  const owner = { ...profiles.view(), chatId: 'main' };
  service = createGoalService({ registry, profiles, heartbeatMs: 0 });
  const recovered = service.list(owner)[0]; assert.equal(recovered.status, 'paused');
  const task = recovered.tasks.find(task => task.attempts.at(-1)?.id === heldAttemptId);
  assert.equal(task.role, role); assert.equal(task.status, 'interrupted'); assert.equal(recovered.review, undefined);
  const requestCount = transport.requests.length; await delay(200); service.tick(); assert.equal(transport.requests.length, requestCount, 'restart did not replay');
  const review = { taskId: task.id, accepted: false, retry: true, note: 'Inspected retained partial coordinator turn; retry only this read-only control step.', evidence: ['retained transcript', 'native job shutdown proof'] };
  await assert.rejects(service.command(owner, goalId, 'start'), /Reconcile/);
  await assert.rejects(service.command(owner, goalId, 'reviewTask', review), /termination|still has a run/);
  await assert.rejects(service.command(owner, goalId, 'reviewTask', { ...review, accepted: true, retry: false }), /schema/);
  let verified = false;
  for (let i = 0; i < 30 && !verified; i++) {
    try { await service.command(owner, goalId, 'reconcileTermination', { taskId: task.id }); verified = true; }
    catch (error) { if (!/not been established/.test(error.message)) throw error; await delay(100); }
  }
  assert.equal(verified, true);
  await service.command(owner, goalId, 'reviewTask', review); releaseAll = true;
  await service.command(owner, goalId, 'start');
  const completed = await until(() => { service.tick(); return service.list(owner)[0]; }, goal => goal.status === 'completed', 'explicit resumed completion');
  const retried = completed.tasks.find(item => item.id === task.id);
  assert.equal(retried.attempts.length, 2); assert.equal(retried.attempts[0].id, heldAttemptId);
  assert.notEqual(retried.attempts[1].id, heldAttemptId); assert.ok(Number.isFinite(retried.attempts[0].stoppedAt));
  assert.equal(transport.requests.length, 9);
  for (const worker of completed.tasks.filter(item => item.role === 'worker')) assert.equal(worker.attempts.length, 1, 'completed worker never replayed');
  const ws = profiles.load(owner); assert.equal(ws.chats.main.draft, 'Human draft survives native coordinator death');
  assert.equal(ws.chats.main.messages.length, 12); assert.ok(ws.chats.main.messages.every(message => !message.streaming));
  assert.ok(Object.values(ws.ownership.attempts).every(attempt => attempt.driverFinished));
  fs.writeFileSync(path.join(root, 'proof.json'), JSON.stringify({ role, root, result: 'pass', heldAttemptId, requests: transport.requests.length, workerAttempts: 3, retainedDraft: true, oldAttemptReconciled: true }, null, 2));
  console.log(`Native ${role} proof retained: ${root}`);
});
