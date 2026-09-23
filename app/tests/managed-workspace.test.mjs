import assert from 'node:assert/strict';
import { captureManagedView, mergeManagedView } from '../renderer/src/managed-workspace.js';
const chat = () => ({ id: 'a', folder: '/old', provider: 'codex', sessions: { codex: 'old-session' }, sessionSeen: { codex: 2 }, draft: 'Unsent draft', messages: [{ id: 'reply', runId: 'run', lastSequence: 1, text: 'First', streaming: true }] });
async function delayed(mutate) {
  const state = { chats: { a: chat() }, order: ['a'] }, before = captureManagedView(state);
  const response = structuredClone(state); response.chats.worker = { ...chat(), id: 'worker' };
  let release; const request = new Promise(resolve => { release = resolve; });
  const applied = request.then(data => mergeManagedView(state, data, before));
  mutate(state); release(response); await applied; return state;
}
const streaming = await delayed(state => { const reply = state.chats.a.messages[0]; reply.text += ' newer text'; reply.lastSequence = 2; });
assert.equal(streaming.chats.a.messages[0].text, 'First newer text');
assert.equal(streaming.chats.a.draft, 'Unsent draft'); assert(streaming.chats.worker);
const moved = await delayed(state => { Object.assign(state.chats.a, { folder: '/new', provider: 'claude', sessions: {}, sessionSeen: {} }); });
assert.equal(moved.chats.a.folder, '/new'); assert.deepEqual(moved.chats.a.sessions, {}); assert.deepEqual(moved.chats.a.sessionSeen, {});
const deleted = await delayed(state => { delete state.chats.a; state.order = []; });
assert.equal(deleted.chats.a, undefined); assert.deepEqual(deleted.order, ['worker']);
const submitted = await delayed(state => { state.chats.a.messages.push({ role: 'user', text: 'New question' }, { role: 'assistant', text: '', streaming: true }); });
assert.equal(submitted.chats.a.messages.length, 3);
console.log('PASS delayed managed snapshots preserve new stream output, context resets, deleted chats, unsent draft and new submission');
