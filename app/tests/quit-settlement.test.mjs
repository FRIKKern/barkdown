import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installQuitSettlement } from '../renderer/src/quit-settlement.js';
const { createQuitSettlement } = createRequire(import.meta.url)('../main/quit-settlement');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('main refuses unsafe and malformed replies, times out, and permits retry', async () => {
  const sent = [], window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (...args) => sent.push(args) } };
  const main = createQuitSettlement({ getWindow: () => window, timeoutMs: 10, log() {} });
  for (const result of [null, {}, [null], [{ saved: false, kept: false }], [{ saved: 'yes' }]]) {
    const p = main.settle(); const refused = assert.rejects(p); main.reply(sent.at(-1)[1], result); await refused;
    assert.equal(sent.at(-1)[0], 'app:settle-release');
  }
  await assert.rejects(main.settle(), /in time/); assert.equal(sent.at(-1)[0], 'app:settle-release');
  const p = main.settle(), id = sent.at(-1)[1]; assert.equal(main.reply('stale', []), false);
  main.reply(id, [{ saved: true }, { saved: false, kept: true }]); assert.equal((await p).length, 2);
  assert.equal(main.reply(id, []), false); main.release();
});
test('main does not mistake a destroyed renderer for verified content', async () => {
  const main = createQuitSettlement({ getWindow: () => ({ isDestroyed: () => false, webContents: { isDestroyed: () => true } }) });
  await assert.rejects(main.settle(), /cannot verify/);
});
function rendererFixture(controllers, priorInert = false) {
  let settle, release; const answers = [], body = { inert: false }, root = { inert: priorInert, ownerDocument: { body } }, state = { loaded: true, profileId: 'A', generation: 'one' };
  const save = { settle: async () => ({ assertCurrent: () => true }) };
  installQuitSettlement({ api: { app: { onSettle: f => settle = f, onSettleRelease: f => release = f, settled: async (...args) => answers.push(args) } }, root, state, controllers, savePositions() {}, save });
  return { settle, release, answers, root, body, state, save };
}
test('renderer holds all controllers until main releases, including a prior freeze', async () => {
  for (const prior of [false, true]) {
    let resolve, locked = 0;
    const one = { lockForQuit: () => { locked++; return () => locked--; }, settle: async () => ({ saved: true, assertCurrent: () => true }) };
    const two = { ...one, settle: () => new Promise(r => resolve = r) };
    const f = rendererFixture(new Map([['one', one], ['two', two]]), prior);
    const work = f.settle('id'); await tick(); assert.equal(locked, 2); assert.equal(f.root.inert, true);
    assert.equal(f.body.inert, true, 'controls outside the workspace are frozen too');
    resolve({ saved: false, kept: true, assertCurrent: () => true }); await work;
    assert.equal(locked, 2); assert.equal(f.answers[0][1].length, 2);
    f.release('old'); assert.equal(locked, 2); f.release('id'); assert.equal(locked, 0); assert.equal(f.root.inert, prior);
    assert.equal(f.body.inert, false);
  }
});

test('workspace acknowledgement is required and Paper proofs are rechecked after it', async () => {
  let resolve, current = true;
  const f = rendererFixture(new Map([['paper', { settle: async () => ({ saved: true, assertCurrent: () => current }) }]]));
  f.save.settle = () => new Promise(r => resolve = r);
  const pending = f.settle('workspace'); await tick(); assert.equal(f.answers.length, 0);
  current = false; resolve({ assertCurrent: () => true }); await pending;
  assert.equal(f.answers[0][1][0].kept, false); assert.match(f.answers[0][1][0].error, /note changed/);
  f.release('workspace');
  f.save.settle = async () => { throw new Error('Workspace write refused'); };
  await f.settle('refused'); assert.match(f.answers[1][1][0].error, /write refused/); f.release('refused');
});

test('a workspace reply after cancellation cannot authorize a later quit', async () => {
  let resolve; const f = rendererFixture(new Map());
  f.save.settle = () => new Promise(r => resolve = r);
  const pending = f.settle('cancelled'); await tick(); f.release('cancelled');
  resolve({ assertCurrent: () => true }); await pending;
  assert.equal(f.answers.length, 0); assert.equal(f.root.inert, false);
});
test('renderer refuses a late change and discards an answer after timeout release', async () => {
  let resolve;
  const controller = { settle: () => new Promise(r => resolve = r) };
  const f = rendererFixture(new Map([['one', controller]]));
  const p = f.settle('first'); resolve({ saved: true, assertCurrent: () => false }); await p;
  assert.equal(f.answers[0][1][0].kept, false); f.release('first');
  const q = f.settle('second'); f.release('second'); resolve({ saved: true, assertCurrent: () => true }); await q;
  assert.equal(f.answers.length, 1); assert.equal(f.root.inert, false);
});
