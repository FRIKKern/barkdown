// Real provider-adapter dependencies and disk repository, deterministic API transport.
// This is not authenticated model or Electron-profile-switch evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createWorkspaceRepository } = require('../main/workspace-repository');
const { createGoalProvider } = require('../main/goal-provider');
const agent = require('../main/agent');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goal-workspace-'));
const registry = createProfileRegistry(path.join(root, 'registry'));
const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
const workspaces = createWorkspaceRepository({ registry });
const view = label => ({ version: 1, chats: { main: { id: 'main', title: label, provider: 'api', model: 'fixture-model',
  folder: null, messages: [], draft: label + ' original draft', tabs: [] } }, order: ['main'], current: 'main' });
workspaces.saveView(a.id, view('A')); workspaces.saveView(b.id, view('B'));
const goal = { id: crypto.randomUUID(), profileId: a.id, chatId: 'main' };
workspaces.stageWorkerChats(goal, [1, 2, 3].map(n => ({ chatId: 'worker-' + n, title: 'Worker ' + n })));
const service = createProfileService({ registry, workspaces, settingsFor: () => ({ apiKey: 'fixture-key', forceOnline: true }) });
const adapter = createGoalProvider({ resolve: service.resolve, transcripts: workspaces });
let launchCount = 0, active = 0, maximum = 0, release, ready;
const gate = new Promise(resolve => { release = resolve; });
const allStarted = new Promise(resolve => { ready = resolve; });
agent.setClientFactory(() => ({ messages: { stream(params) {
  launchCount++; active++; maximum = Math.max(maximum, active);
  if (launchCount === 3) ready();
  // The real agent prefixes summaries of sibling chats; match this assignment,
  // not a sibling assignment quoted in that contextual prefix.
  const n = /Assignment number (\d)$/.exec(params.messages.at(-1).content)?.[1];
  assert.ok(n);
  const handlers = {};
  return { on(name, callback) { handlers[name] = callback; return this; }, async finalMessage() {
    await gate; const text = 'Observed worker ' + n; handlers.text(text); active--;
    return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text }] };
  } };
} } }));
const requests = [1, 2, 3].map(n => ({ profileId: a.id, goalId: goal.id, coordinatorChatId: 'main',
  chatId: 'worker-' + n, taskId: crypto.randomUUID(), attemptId: crypto.randomUUID(),
  prompt: 'Assignment number ' + n, deadline: Date.now() + 60000, images: [],
  context: { profileId: a.id, chatId: 'worker-' + n, folder: null, provider: 'api', model: 'fixture-model', effort: null, session: null } }));
const running = requests.map(request => adapter.execute(request, { signal: new AbortController().signal, progress() {} }));
await allStarted;
const ownerA = service.view();
const ownerB = await service.select(ownerA, b.id);
service.save(ownerB, view('B changed during A runs'));
release();
const results = await Promise.all(running);
assert.equal(maximum, 3); assert.ok(results.every(result => result.status === 'succeeded'));
const restored = createWorkspaceRepository({ registry: createProfileRegistry(path.join(root, 'registry')) });
const savedA = restored.load(a.id), savedB = restored.load(b.id);
assert.equal(savedA.chats.main.draft, 'A original draft');
assert.equal(savedB.chats.main.draft, 'B changed during A runs original draft');
assert.equal(Object.keys(savedB.chats).length, 1);
for (const [index, request] of requests.entries()) {
  const chat = savedA.chats[request.chatId];
  assert.equal(chat.parent, 'main'); assert.equal(chat.goalId, goal.id);
  assert.equal(chat.messages.length, 2); assert.equal(chat.messages[1].text, 'Observed worker ' + (index + 1));
  assert.equal(chat.runId, null);
  assert.equal(savedA.ownership.attempts[request.attemptId].driverFinished, true);
}
const replay = await adapter.execute(requests[0], { signal: new AbortController().signal, progress() {} });
assert.equal(replay.status, 'interrupted'); assert.equal(launchCount, 3);
assert.equal(restored.load(a.id).chats['worker-1'].messages.length, 2);
assert.throws(() => service.save(ownerA, view('stale A')), /Stale or foreign/);
console.log(JSON.stringify({ passed: ['three real provider loops use trusted resolver and durable sink',
  'A completion survives B selection and preserves both drafts', 'saved worker parents and finalized attempts survive repository restart',
  'duplicate adapter dispatch does not launch or append twice', 'old renderer generation cannot save'], root, transport: 'deterministic fixture' }));
