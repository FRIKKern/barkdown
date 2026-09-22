import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry'), { createProfileService } = require('../main/profile-service'), { createGoalProvider } = require('../main/goal-provider');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-context-reservation-')), registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Fixture' });
  let unblock, options, dispatches = 0, releases = 0;
  const agent = { async start(value) { dispatches++; options = value; return { runId: 'fixture-run' }; }, async waitForRunFinish() {
    options.send({ type: 'done', profileId: profile.id, chatId: 'worker', runId: 'fixture-run', provider: 'api', sequence: 1, session: 'CAPTURED-A-SESSION' });
    await options.onFinish(); return { runId: 'fixture-run', profileId: profile.id, chatId: 'worker', status: 'succeeded' };
  }, cancel() {} };
  const profiles = createProfileService({ registry, settingsFor: () => ({ provider: 'api', barkpark: { local: { enabled: true } } }), runtimePool: { acquire: () => new Promise(resolve => { unblock = () => resolve({ connection: { enabled: false }, release: async () => { releases++; } }); }) }, agent });
  const owner = profiles.view(); profiles.save(owner, { version: 1, chats: { main: { id: 'main', title: 'Goal', folder: 'C:/captured-A', provider: 'api', messages: [], draft: 'coordinator draft' } }, order: ['main'] });
  const goal = { id: crypto.randomUUID(), profileId: profile.id, chatId: 'main' };
  profiles.workspaces.stageWorkerChats(goal, [{ chatId: 'worker', title: 'Worker', folder: 'C:/captured-A', provider: 'api' }]);
  let ws = profiles.load(owner); ws.chats.worker.draft = 'human worker draft'; profiles.save(owner, ws);
  const request = { profileId: profile.id, chatId: 'worker', attemptId: crypto.randomUUID(), prompt: 'bounded fixture', images: [], provider: 'api', goalId: goal.id, taskId: 'task-1', coordinatorChatId: 'main', context: { folder: 'C:/captured-A', provider: 'api', model: null, effort: null, session: null }, deadline: Date.now() + 60000 };
  return { profiles, owner, request, agent, unblock: () => unblock(), ready: () => Boolean(unblock), dispatches: () => dispatches, releases: () => releases };
}
for (const mode of ['ordinary-followup', 'goal-worker']) for (const change of ['folder', 'away-and-back', 'model', 'draft-only']) test(`${mode}: ${change} during runtime acquisition`, async () => {
  const f = fixture(), { profiles, owner, request } = f;
  const pending = mode === 'ordinary-followup' ? profiles.start(owner, { chatId: 'worker', prompt: request.prompt, provider: 'api', attemptId: request.attemptId })
    : createGoalProvider({ agent: f.agent, resolve: profiles.resolve, transcripts: profiles.workspaces }).execute(request, { signal: new AbortController().signal, progress() {} });
  assert(f.ready());
  let ws = profiles.load(owner); ws.chats.worker.draft = 'newer human draft';
  if (change === 'folder' || change === 'away-and-back') ws.chats.worker.folder = 'C:/new-B';
  if (change === 'model') ws.chats.worker.model = 'new-model';
  profiles.save(owner, ws);
  if (change === 'away-and-back') { ws = profiles.load(owner); ws.chats.worker.folder = 'C:/captured-A'; profiles.save(owner, ws); }
  f.unblock();
  if (change !== 'draft-only') await assert.rejects(pending, error => error.code === 'BARKDOWN_SEND_NOT_STARTED' && /context changed/i.test(error.message));
  else { const result = await pending; if (mode === 'ordinary-followup') await profiles.wait(owner, result.runId); }
  await new Promise(resolve => setImmediate(resolve));
  ws = profiles.load(owner); assert.equal(ws.chats.worker.draft, 'newer human draft'); assert.equal(f.releases(), 1);
  if (change !== 'draft-only') { assert.equal(f.dispatches(), 0); assert.equal(Object.keys(ws.ownership.attempts).length, 0); assert.equal(ws.chats.worker.messages.length, 0); assert.equal(ws.chats.worker.sessions?.api, undefined); }
  else { assert.equal(f.dispatches(), 1); assert.equal(ws.chats.worker.sessions.api, 'CAPTURED-A-SESSION'); }
  assert.equal(ws.chats.worker.folder, change === 'folder' ? 'C:/new-B' : 'C:/captured-A');
});
test('reservation rechecks a resolved snapshot after later context mutation', async () => {
  const f = fixture(); const pending = f.profiles.resolve(f.request.profileId, 'worker'); f.unblock(); const resolved = await pending;
  const ws = f.profiles.load(f.owner); ws.chats.worker.folder = 'C:/new-B'; f.profiles.save(f.owner, ws);
  try { assert.throws(() => f.profiles.workspaces.begin(f.request, resolved), error => error.code === 'BARKDOWN_SEND_NOT_STARTED'); }
  finally { await resolved.release(); }
  assert.equal(Object.keys(f.profiles.load(f.owner).ownership.attempts).length, 0);
});
