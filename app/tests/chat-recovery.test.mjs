import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { captureChatContext } = require('../main/chat-context');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-recovery-unit-'));
const registry = createProfileRegistry(root), a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
registry.selectProfile(a.id);
let verified = false, dispatches = 0, checked;
const agent = { verifyTermination: async input => { checked = input; return verified; }, start: async () => { dispatches++; throw new Error('No dispatch expected'); } };
const service = createProfileService({ registry, agent }), owner = service.view(), repo = service.workspaces;
const snapshot = label => ({ version: 1, chats: { same: { id: 'same', messages: [], events: [], tabs: [], draft: label + ' draft', draftImages: [{ id: 'retained' }], folder: root, provider: 'api' } }, order: ['same'], current: 'same' });
repo.saveView(a.id, snapshot('A')); repo.saveView(b.id, snapshot('B'));
const request = { profileId: a.id, chatId: 'same', attemptId: crypto.randomUUID(), prompt: 'Original prompt', images: [], provider: 'api' };
repo.begin(request, { scope: { profileId: a.id, context: { folder: root } }, chatContext: captureChatContext(repo.load(a.id).chats.same) });
repo.event(request, { profileId: a.id, chatId: 'same', runId: 'previous-run', sequence: 1, type: 'text_delta', text: 'Partial evidence' });
repo.event(request, { profileId: a.id, chatId: 'same', runId: 'previous-run', sequence: 2, type: 'approval', approvalId: 'old', request: { kind: 'command', command: 'fixture' } });
const recovered = service.load(owner), chat = recovered.chats.same;
assert.equal(chat.messages.at(-1).text, 'Partial evidence'); assert.equal(chat.messages.at(-1).streaming, false);
assert.equal(chat.messages.at(-1).approvals[0].status, 'interrupted'); assert.equal(chat.runId, null);
assert.equal(chat.draft, 'A draft'); assert.equal(chat.folder, root); assert.deepEqual(chat.draftImages, [{ id: 'retained' }]);
assert.equal(recovered.ownership.attempts[request.attemptId].capturedContext.folder, root);
const file = path.join(registry.storeFor(a.id).storeDir, 'workspace.json'), bytes = fs.readFileSync(file);
service.load(owner); assert.deepEqual(fs.readFileSync(file), bytes, 'repeat recovery does not rewrite');
await assert.rejects(service.start(owner, { chatId: 'same', prompt: 'No replay' }), /unfinished/);
assert.equal(dispatches, 0);
await assert.rejects(service.recover(owner, { chatId: 'same', attemptId: request.attemptId, action: 'verify' }), /not verified stopped/);
assert.equal(service.load(owner).ownership.attempts[request.attemptId].driverFinished, false);
assert.equal(checked.request.storeDir, registry.storeFor(a.id).storeDir);
assert.equal(checked.request.profileId, a.id); assert.equal(checked.runId, 'previous-run');
verified = true;
await service.recover(owner, { chatId: 'same', attemptId: request.attemptId, action: 'verify' });
assert.equal(service.load(owner).chats.same.interruption.shutdownVerified, true);
await assert.rejects(service.recover(owner, { chatId: 'same', attemptId: request.attemptId, action: 'review', note: '' }), /Record what/);
assert.equal(service.load(owner).ownership.attempts[request.attemptId].driverFinished, false);
const other = await service.select(owner, b.id);
await assert.rejects(service.recover(other, { chatId: 'same', attemptId: request.attemptId, action: 'review', note: 'Reviewed' }), /unavailable/);
assert.equal(service.load(other).chats.same.draft, 'B draft');
const back = await service.select(other, a.id);
await service.recover(back, { chatId: 'same', attemptId: request.attemptId, action: 'review', note: 'Checked changed files' });
const released = service.load(back);
assert.equal(released.ownership.attempts[request.attemptId].driverFinished, true); assert.equal(released.chats.same.interruption, null);
assert.equal(released.chats.same.draft, 'A draft'); assert.equal(released.chats.same.messages.length, 2); assert.equal(dispatches, 0);
assert.deepEqual(released.chats.same.sessions, {}); assert.deepEqual(released.chats.same.apiHistory, []);
const old = { ...request, attemptId: crypto.randomUUID() }; repo.begin(old, { scope: { profileId: a.id }, chatContext: captureChatContext(repo.load(a.id).chats.same) });
const legacy = repo.load(a.id); delete legacy.ownership.attempts[old.attemptId].request; registry.storeFor(a.id).writeJson('workspace.json', legacy);
service.load(back);
await assert.rejects(service.recover(back, { chatId: 'same', attemptId: old.attemptId, action: 'verify' }), /older attempt/);
assert.equal(service.load(back).ownership.attempts[old.attemptId].driverFinished, false);
console.log(JSON.stringify({ passed: ['partial evidence and draft/context preservation', 'idempotent recovery', 'blocked dispatch', 'verified termination identity', 'explicit effects review', 'foreign-profile refusal', 'no automatic replay', 'legacy receipt refusal'], root }));

// A retained parent registry entry means ownership is unresolved, not that its
// transport remains usable. Surface recovery without waiting for an app restart.
const runs = require('../main/providers/runs');
const c = registry.createProfile({ name: 'Uncertain cleanup' }); registry.selectProfile(c.id); repo.saveView(c.id, snapshot('C'));
let heldRun, cleanupProof = false;
const uncertain = createProfileService({ registry, agent: {
  async start(options) { heldRun = runs.createRun(options); heldRun.emit({ type: 'text_delta', text: 'Partial before cleanup failure' }); return { runId: heldRun.id }; },
  waitForRunFinish: async () => { throw new Error('Native shutdown unconfirmed'); }, cancel: runs.cancel,
  async verifyTermination() { if (!cleanupProof) return false; await runs.finish(heldRun); return true; }
} });
const uncertainOwner = uncertain.view(), started = await uncertain.start(uncertainOwner, { chatId: 'same', prompt: 'Uncertain' });
await assert.rejects(uncertain.wait(uncertainOwner, started.runId), /unconfirmed/);
assert.ok(runs.runs.has(started.runId));
const pending = uncertain.load(uncertainOwner); assert.ok(pending.chats.same.interruption);
await assert.rejects(uncertain.recover(uncertainOwner, { chatId: 'same', attemptId: started.attemptId, action: 'verify' }), /not verified/);
cleanupProof = true;
await uncertain.recover(uncertainOwner, { chatId: 'same', attemptId: started.attemptId, action: 'verify' });
assert.equal(uncertain.load(uncertainOwner).ownership.attempts[started.attemptId].driverFinished, false);
await uncertain.recover(uncertainOwner, { chatId: 'same', attemptId: started.attemptId, action: 'review', note: 'Reviewed partial effects' });
assert.equal(uncertain.load(uncertainOwner).ownership.attempts[started.attemptId].driverFinished, true);
console.log('PASS retained registry uncertainty exposes recovery without restart and remains blocked until verified and reviewed');

globalThis.window = { barkdown: { state: { save: async () => true } } };
const { state } = await import('../renderer/src/state.js');
const { handleAgentEvent, sendMessage } = await import('../renderer/src/conversation.js');
const uiChat = { id: 'ui', runId: 'ui-run', draft: 'Keep unsent', messages: [{ id: 'reply', role: 'assistant', streaming: true, text: 'Done text', runId: 'ui-run' }] };
state.profileId = a.id; state.chats = { ui: uiChat };
const hooks = { render() {}, runChanged() {} };
handleAgentEvent({ type: 'done', profileId: a.id, chatId: 'ui', runId: 'ui-run', assistantId: 'reply', provider: 'api', sequence: 1 }, hooks);
assert.equal(uiChat.runId, 'ui-run', 'provider done retains cleanup gate');
assert.equal(await sendMessage(uiChat, 'Keep unsent', hooks), false); assert.equal(uiChat.messages.length, 1);
handleAgentEvent({ type: 'driver_state', profileId: b.id, chatId: 'ui', runId: 'ui-run', assistantId: 'reply', driverFinished: true }, hooks);
assert.equal(uiChat.runId, 'ui-run', 'foreign cleanup cannot clear gate');
handleAgentEvent({ type: 'driver_state', profileId: a.id, chatId: 'ui', runId: 'ui-run', assistantId: 'reply', driverFinished: false, interruption: { attemptId: 'uncertain' } }, hooks);
assert.equal(uiChat.runId, null); assert.ok(uiChat.interruption, 'uncertainty appears immediately');
handleAgentEvent({ type: 'driver_state', profileId: a.id, chatId: 'ui', runId: 'ui-run', assistantId: 'reply', driverFinished: true, interruption: null }, hooks);
assert.equal(uiChat.runId, null); assert.equal(uiChat.messages[0].driverFinished, true);
assert.equal(uiChat.draft, 'Keep unsent');
console.log('PASS managed renderer waits for trusted driver acknowledgement and surfaces uncertainty without clearing draft');

const fast = { id: 'fast', title: 'New chat', messages: [], draft: '', sessions: {} }; state.chats.fast = fast;
window.barkdown.agent = { async start() {
  handleAgentEvent({ type: 'driver_state', profileId: a.id, chatId: 'fast', runId: 'fast-run', driverFinished: false, interruption: { attemptId: 'early-failure' } }, hooks);
  return { runId: 'fast-run' };
} };
await sendMessage(fast, 'Fast launch failure fixture', hooks);
assert.ok(fast.interruption); assert.equal(fast.runId, null, 'early recovery notification must not be overwritten by late start acknowledgement');
