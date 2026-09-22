// Opt-in authenticated coordinator proof; only synthetic retained files are in scope.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createGoalWorkerAgent } = require('../main/goal-worker-agent');
if (process.env.BARKDOWN_RUN_GOAL_LIVE !== '1') throw new Error('Set BARKDOWN_RUN_GOAL_LIVE=1 for authenticated disposable coordinator execution');
const repo = path.resolve(import.meta.dirname, '../..');
const source = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'app'], { cwd: repo, encoding: 'utf8' }).trim()) };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-coordinator-owned-')), folder = path.join(root, 'inputs'); fs.mkdirSync(folder);
const tokens = [1, 2, 3].map(n => `BARKDOWN_COORDINATED_INPUT_${n}_OBSERVED`);
tokens.forEach((token, index) => fs.writeFileSync(path.join(folder, `input-${index + 1}.txt`), token + '\n'));
const registry = createProfileRegistry(path.join(root, 'registry')), profile = registry.createProfile({ name: 'Synthetic coordinator proof' }); registry.selectProfile(profile.id);
const profiles = createProfileService({ registry, settingsFor: () => ({ provider: 'codex' }) });
const owner = { ...profiles.view(), chatId: 'coordinator' };
profiles.save(owner, { version: 1, chats: { coordinator: { id: 'coordinator', title: 'Three synthetic reads', provider: 'codex', effort: 'low', folder, messages: [], draft: 'Preserve the human draft', tabs: [] } }, order: ['coordinator'], current: 'coordinator' });
const runtime = createGoalWorkerAgent();
const service = createGoalService({ registry, profiles, agent: runtime, verifyTermination: ({ request, runId }) => runtime.verifyTermination({ request: { ...request, storeDir: registry.storeFor(request.profileId).storeDir }, runId }) });
let peakRunning = 0, peakWorkers = 0, lastState = '';
try {
  const initial = service.create(owner, { mode: 'coordinated', durationMinutes: 10, objective: 'Read input-1.txt, input-2.txt and input-3.txt in this conversation’s working folder and report each exact token. These are three independent read-only tasks: assign exactly one file to each of three workers with no dependencies. Workers must read their assigned file and cite the filename and exact observed token. The coordinator must independently inspect the three files to verify each worker result, then summarize all three exact tokens with evidence. Do not edit any file, launch services, access other folders, create additional agents, or perform any other work.' });
  console.log(JSON.stringify({ phase: 'starting', root, profileId: profile.id, goalId: initial.id, source }));
  await service.command(owner, initial.id, 'start');
  let goal;
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    goal = service.list(owner)[0];
    peakRunning = Math.max(peakRunning, goal.tasks.filter(task => task.status === 'running').length);
    peakWorkers = Math.max(peakWorkers, goal.tasks.filter(task => task.role === 'worker' && task.status === 'running').length);
    const state = JSON.stringify({ phase: goal.status, tasks: goal.tasks.map(task => ({ id: task.id, role: task.role, status: task.status })) });
    if (state !== lastState) { console.log(state); lastState = state; }
    if (['completed', 'paused', 'cancelled', 'expired'].includes(goal.status)) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(goal.status, 'completed', JSON.stringify({ status: goal.status, reason: goal.reason, tasks: goal.tasks.map(task => ({ id: task.id, status: task.status, reason: task.attempts.at(-1)?.reason, result: task.attempts.at(-1)?.result })) }));
  assert.ok(peakRunning <= 3); assert.equal(peakWorkers, 3);
  const ws = profiles.load(owner), workers = goal.tasks.filter(task => task.role === 'worker');
  assert.equal(workers.length, 3); assert.equal(ws.chats.coordinator.draft, 'Preserve the human draft');
  for (const token of tokens) assert.ok(workers.some(task => ws.chats[task.chatId].messages.at(-1).text.includes(token)), 'Missing exact token ' + token);
  for (const worker of workers) {
    assert.equal(ws.chats[worker.chatId].parent, 'coordinator'); assert.equal(worker.review.actor, 'coordinator');
    assert.ok(worker.review.evidence.length); assert.ok(ws.chats[worker.chatId].messages.at(-1).tools?.length > 0, 'Worker did not record an actual tool read');
  }
  assert.ok(Object.values(ws.ownership.attempts).every(attempt => attempt.driverFinished));
  const receipts = fs.readdirSync(path.join(registry.storeFor(profile.id).storeDir, 'goal-processes')).filter(file => file.endsWith('.receipt.json')).map(file => JSON.parse(fs.readFileSync(path.join(registry.storeFor(profile.id).storeDir, 'goal-processes', file))));
  assert.ok(receipts.length >= 8); assert.ok(receipts.every(receipt => receipt.phase === 'stopped' && receipt.activeProcesses === 0));
  const proof = { ok: true, source, root, provider: 'codex', transport: 'authenticated', goalId: goal.id, profileId: profile.id, peakRunning, peakWorkers, stoppedReceipts: receipts.length, exactTokenComparisons: 3, completed: goal.status, summary: goal.review.note, reviews: workers.map(task => ({ id: task.id, title: task.title, attemptId: task.attempts.at(-1).id, review: task.review })) };
  fs.writeFileSync(path.join(root, 'proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
} finally { await service.close(); }
