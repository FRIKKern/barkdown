import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPreparationForeground } = require('../main/preparation-foreground');
const { createPreparationBridge } = require('../main/preparation-bridge');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const turn = () => new Promise(r => setImmediate(r));
function fixture() {
  let phase = 'open', owner = { profileId: 'a', generation: 'one' };
  const foreground = createPreparationForeground({ isClosed: id => id === 'a' && phase !== 'open' });
  const wc = new EventEmitter(), sent = [], writes = [];
  wc.isDestroyed = () => false; wc.send = (channel, request) => sent.push(request);
  const bridge = createPreparationBridge({ foreground, webContents: () => wc, writerState: () => ({ phase }),
    profiles: { view: () => ({ ...owner }), validate: captured => { assert.deepEqual(captured, owner); }, save: (captured, snapshot) => writes.push({ captured, snapshot }) },
    draftsFor: profileId => ({ retain: (token, draft) => writes.push({ profileId, token, draft }) }),
  });
  return { foreground, bridge, wc, sent, writes, phase: v => phase = v, owner: v => owner = v };
}
test('foreground cut drains admitted work, rejects new mutations and leaves B usable', async () => {
  const f = fixture(), gate = deferred(); let finished = false;
  const old = f.foreground.run('a', 'files:write', () => gate.promise);
  f.foreground.close('a');
  for (const channel of ['files:write', 'settings:set', 'state:save', 'term:start', 'term:input', 'unclassified:new']) {
    assert.throws(() => f.foreground.run('a', channel, () => assert.fail('admitted')), /preparing/);
  }
  assert.equal(await f.foreground.run('a', 'files:read', () => 'read'), 'read');
  // The library switch operates on the prepared profile by design (C083) and is not drained with foreground work.
  assert.equal(await f.foreground.run('a', 'migration:switch', () => 'switched'), 'switched');
  // So does installing an update: Settings › About prepares the profile, then asks to install (its copy comes from it).
  assert.equal(await f.foreground.run('a', 'updates:install', () => 'installing'), 'installing');
  assert.equal(await f.foreground.run('b', 'files:write', () => 'other'), 'other');
  const drain = f.foreground.drain('a').then(() => finished = true);
  await turn(); assert.equal(finished, false);
  gate.resolve(); await old; await drain; assert.equal(finished, true);
  f.foreground.release('a'); f.phase('quiescing');
  assert.throws(() => f.foreground.run('a', 'state:save', () => {}), /preparing/);
});
test('capture waits for existing IPC; only its live owner ticket can retain/save', async () => {
  const f = fixture(), gate = deferred();
  const old = f.foreground.run('a', 'state:save', () => gate.promise);
  const pending = f.bridge.freeze('a', { writerOpen: true });
  await turn(); assert.equal(f.sent.length, 0);
  gate.resolve(); await old; await turn();
  const request = f.sent[0]; assert.equal(request.method, 'capture');
  f.bridge.retain({ id: request.id, token: 'paper-capability', draft: { title: 'unsaved' } });
  f.bridge.saveView({ id: request.id, snapshot: { draft: 'unsent' } });
  assert.equal(f.writes[0].profileId, 'a'); assert.equal(f.writes[1].captured.generation, 'one');
  f.bridge.reply({ id: request.id, value: { profileId: 'a', sessionId: 'session', draftKeys: [] } });
  const held = await pending;
  assert.throws(() => f.bridge.retain({ id: request.id }), /stale/);
  const checking = held.assertCurrent(); await turn();
  assert.throws(() => f.bridge.saveView({ id: f.sent[1].id }), /stale/);
  f.bridge.reply({ id: f.sent[1].id, value: true }); assert.equal(await checking, true);
  f.phase('quiescing'); await assert.rejects(held.release(), /closed/);
  assert.equal(f.sent.length, 2, 'closed writer never sends a renderer thaw');
  assert.throws(() => f.foreground.run('a', 'state:save', () => {}), /preparing/);
});
test('foreign generations cannot use a ticket; window loss rejects and removes listeners', async () => {
  const f = fixture(), pending = f.bridge.freeze('a', { writerOpen: true });
  await turn(); f.owner({ profileId: 'b', generation: 'two' });
  assert.throws(() => f.bridge.saveView({ id: f.sent[0].id, snapshot: {} }));
  f.wc.emit('destroyed'); await assert.rejects(pending, /window changed/);
  assert.equal(f.wc.listenerCount('render-process-gone'), 0);
  assert.throws(() => f.bridge.reply({ id: f.sent[0].id, value: true }), /stale/);
});
test('successful release waits for renderer acknowledgement', async () => {
  const f = fixture(), pending = f.bridge.freeze('a', { writerOpen: true });
  await turn(); f.bridge.reply({ id: f.sent[0].id, value: { profileId: 'a', sessionId: 'held', draftKeys: [] } });
  const held = await pending, releasing = held.release(); await turn();
  assert.throws(() => f.foreground.run('a', 'state:save', () => {}), /preparing/);
  f.bridge.reply({ id: f.sent[1].id, value: true }); await releasing;
  assert.equal(await f.foreground.run('a', 'state:save', () => 'allowed'), 'allowed');
});
test('renderer refusal leaves open writers editable and preserves the original error', async () => {
  const f = fixture(), pending = f.bridge.freeze('a', { writerOpen: true });
  await turn(); f.bridge.reply({ id: f.sent[0].id, error: 'Finish composing text' });
  await assert.rejects(pending, /Finish composing/);
  assert.equal(await f.foreground.run('a', 'state:save', () => 'allowed'), 'allowed');
});
