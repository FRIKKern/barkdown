import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<body><div id="bw-toasts"></div><main><textarea></textarea></main></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
let write, read;
window.barkdown = { state: { save: value => write(value), load: () => read() } };
const { state, save, serialise, pauseWorkspaceSaves } = await import('../renderer/src/state.js');
const { installQuitSettlement } = await import('../renderer/src/quit-settlement.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function reset() {
  Object.assign(state, { loaded: true, profileId: 'A', generation: 'one', chats: { main: { id: 'main', draft: 'current draft', messages: [], tabs: [], closedTargets: [] } }, order: ['main'], favorites: [], pages: null, current: 'main', mode: 'chat', directTab: null });
  pauseWorkspaceSaves(false); write = async () => true; read = async () => structuredClone(serialise());
}

await test('quit waits for an in-flight save, then acknowledges the latest owned view', async () => {
  reset(); const gate = deferred(), writes = []; write = value => { writes.push(value); return writes.length === 1 ? gate.promise : Promise.resolve(true); };
  save(); save.flush(); await tick(); state.chats.main.draft = 'newer draft';
  let finished = false; const pending = save.settle().then(value => { finished = true; return value; });
  await tick(); assert.equal(finished, false); assert.equal(writes.length, 1);
  gate.resolve(true); const receipt = await pending;
  assert.equal(writes.at(-1).chats.main.draft, 'newer draft'); assert.equal(receipt.assertCurrent(), true);
  state.chats.main.draft += ' later'; assert.equal(receipt.assertCurrent(), false);
});
await test('refused current workspace save refuses quit', async () => {
  reset(); write = async () => { throw new Error('disk refused'); };
  await assert.rejects(save.settle(), /disk refused/);
});
await test('late mutation or owner change invalidates a save receipt', async () => {
  for (const field of ['draft', 'owner']) {
    reset(); const gate = deferred(); write = () => gate.promise;
    const pending = save.settle(); await tick();
    if (field === 'draft') state.chats.main.draft += ' changed'; else state.generation = 'two';
    gate.resolve(true); await assert.rejects(pending, /workspace changed/);
  }
});
await test('paused preparation verifies actual durable view without writing', async () => {
  reset(); pauseWorkspaceSaves(true); let writes = 0; write = async () => { writes++; throw new Error('closed admission'); };
  const persisted = structuredClone(serialise()); delete persisted.chats.main.closedTargets;
  persisted.chats.main.messages.push({ text: 'provider-owned result' });
  read = async () => persisted;
  const receipt = await save.settle(); assert.equal(receipt.assertCurrent(), true); assert.equal(writes, 0);
  state.chats.main.draft += ' changed'; await assert.rejects(save.settle(), /paused workspace differs/);
  state.chats.main.draft = persisted.chats.main.draft; persisted.generation = 'foreign';
  await assert.rejects(save.settle(), /paused workspace differs/);
  write = async () => true; pauseWorkspaceSaves(false); save.flush(); await tick();
});
await test('cancelled quit does not enqueue a fresh write after an old save finishes', async () => {
  reset(); const gate = deferred(); let writes = 0, current = true;
  write = () => { writes++; return gate.promise; }; save(); save.flush(); await tick();
  const pending = save.settle({ isCurrent: () => current }); current = false; gate.resolve(true);
  await assert.rejects(pending, /cancelled/); assert.equal(writes, 1);
});
await test('chat composition refuses before inert removes focus', async () => {
  reset(); const root = document.querySelector('main'), input = root.querySelector('textarea');
  let settle, release; const answers = [];
  installQuitSettlement({ api: { app: { onSettle: fn => settle = fn, onSettleRelease: fn => release = fn,
    settled: async (_, result) => answers.push(result) } }, root, state, controllers: new Map(), savePositions() {}, save });
  input.dispatchEvent(new dom.window.CompositionEvent('compositionstart', { bubbles: true }));
  await settle('ime'); assert.match(answers[0][0].error, /Finish composing/); assert.notEqual(root.inert, true); release('ime');
  input.dispatchEvent(new dom.window.CompositionEvent('compositionend', { bubbles: true }));
  await settle('done'); assert.deepEqual(answers[1], []); release('done');
});
dom.window.close();
