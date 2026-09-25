import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installProfilePreparation } from '../renderer/src/profile-preparation.js';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function fixture() {
  const dom = new JSDOM('<body><div id="app"><textarea></textarea></div></body>');
  globalThis.document = dom.window.document; globalThis.window = dom.window;
  const root = document.getElementById('app'); root.inert = false;
  const state = { loaded: true, profileId: 'a', generation: 'one', chats: { main: { draft: 'unsent', draftImages: ['image'], tabs: [] }, side: { draft: 'side unsent', parent: 'main', side: true } } };
  const controllers = new Map(), calls = []; let listener, dirty = 0;
  const api = { preparation: {
    onRequest: fn => listener = fn,
    saveView: async (id, snapshot) => calls.push({ id, snapshot: structuredClone(snapshot) }),
    retain: async () => { calls.push('retain'); return { key: 'retained' }; },
    prepare: async () => calls.push('prepare'), status: async () => ({ readOnly: false }),
  }, profiles: { status: async () => ({ profiles: [] }) } };
  const ui = installProfilePreparation({ api, root, state, controllers, serialise: () => state, savePositions: () => {}, dirtyCount: () => dirty });
  const request = (method, payload = { writerOpen: true }) => listener({ id: 'ticket', profileId: 'a', generation: 'one', method, payload });
  return { dom, root, state, controllers, calls, request, ui, dirty: n => dirty = n };
}
test('capture persists main/side drafts and images then detects late human navigation', async () => {
  const f = fixture(); let released = false;
  f.controllers.set('paper', { freezeRecovery: async ({ retain }) => { const receipt = await retain('cap', {}); return { draftKeys: [receipt.key], assertCurrent: () => true, release: () => released = true }; } });
  const receipt = await f.request('capture');
  assert.equal(f.root.inert, true);
  assert.deepEqual(f.calls[0].snapshot.chats, f.state.chats);
  assert.deepEqual(receipt.draftKeys, ['retained']);
  assert.equal(await f.request('assert', receipt), true);
  f.state.chats.side.draft += ' new';
  assert.equal(await f.request('assert', receipt), false);
  await f.request('release', receipt); assert.equal(released, true); assert.equal(f.root.inert, false);
  await assert.rejects(f.request('assert', receipt), /no longer available/);
});
test('composition, dirty project and dirty legacy buffers refuse before preparation', async () => {
  const f = fixture(), input = f.root.querySelector('textarea');
  input.dispatchEvent(new f.dom.window.CompositionEvent('compositionstart', { bubbles: true }));
  await assert.rejects(f.ui.prepare(), /Finish composing/); assert.equal(f.root.inert, false);
  input.dispatchEvent(new f.dom.window.CompositionEvent('compositionend', { bubbles: true }));
  f.dirty(1); await assert.rejects(f.request('capture'), /project file/);
  f.dirty(0); f.controllers.set('legacy', { isDirty: () => true });
  await assert.rejects(f.request('capture'), /unsaved editors/); assert.deepEqual(f.calls, []);
});
test('a refused sibling waits for and releases every late Paper freeze', async () => {
  const f = fixture(), gate = deferred(); let released = false, settled = false;
  f.controllers.set('bad', { freezeRecovery: async () => { throw new Error('disk refusal'); } });
  f.controllers.set('late', { freezeRecovery: async () => { await gate.promise; return { draftKeys: [], assertCurrent: () => true, release: () => released = true }; } });
  const outcome = f.request('capture').then(() => assert.fail(), error => { settled = true; assert.match(error.message, /disk refusal/); });
  await new Promise(r => setImmediate(r)); assert.equal(settled, false); assert.equal(f.root.inert, true);
  gate.resolve(); await outcome; assert.equal(released, true); assert.equal(f.root.inert, false);
});
test('restart with closed writers freezes clean Paper without a new recovery write', async () => {
  const f = fixture(); f.root.inert = true;
  f.controllers.set('paper', { isDirty: () => false, freezeRecovery: async ({ retain }) => {
    assert.equal(retain, null); return { draftKeys: [], assertCurrent: () => true, release() {} };
  } });
  const receipt = await f.request('capture', { writerOpen: false });
  assert.deepEqual(f.calls, []); assert.equal(await f.request('assert', receipt), true);
  await f.request('release', receipt); assert.equal(f.root.inert, true, 'prior restart lock stays held');
  f.controllers.set('dirty', { isDirty: () => true, freezeRecovery() { assert.fail(); } });
  await assert.rejects(f.request('capture', { writerOpen: false }), /unsaved editors/);
});
test('controller replacement invalidates a captured window even with identical navigation', async () => {
  const f = fixture(); f.controllers.set('legacy', { isDirty: () => false });
  const receipt = await f.request('capture'); f.controllers.set('legacy', { isDirty: () => false });
  assert.equal(await f.request('assert', receipt), false);
});
