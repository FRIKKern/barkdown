import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createAssistantOwner } = require('../main/assistant-owner');
const { createProfileIpcGate } = require('../main/profile-ipc');
const { createBrowserBridge } = require('../main/browser-tools');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  let selected = { profileId: 'A', generation: 'one' };
  const service = { view: () => ({ ...selected }), validate(owner) { assert.deepEqual(owner, selected); }, async select(owner, profileId) { this.validate(owner); selected = { profileId, generation: selected.generation + '+' }; return this.view(); } };
  const gate = createProfileIpcGate(service), ownership = createAssistantOwner({ service: () => service, gate: () => gate });
  return { service, gate, ownership, switch: id => gate.select(service.view(), id, async () => {}) };
}
async function request(spec, extra = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(spec.env.BARKDOWN_BROWSER_SOCKET); let data = '';
    const timer = setTimeout(() => { socket.destroy(); reject(Error('socket timeout')); }, 3000);
    socket.once('error', error => { clearTimeout(timer); reject(error); });
    socket.once('connect', () => socket.write(JSON.stringify({ id: 1, token: spec.env.BARKDOWN_BROWSER_TOKEN, chatId: spec.env.BARKDOWN_BROWSER_CHAT, tool: 'app', args: { command: 'note.list' }, ...extra }) + '\n'));
    socket.on('data', chunk => { data += chunk; if (data.includes('\n')) { clearTimeout(timer); socket.end(); resolve(JSON.parse(data.split('\n')[0])); } });
  });
}
test('actual socket capabilities bind profile, generation and chat; message fields cannot rebind them', async () => {
  const f = fixture(), calls = [];
  const bridge = createBrowserBridge({ call: (tool, args) => { calls.push({ tool, args }); return { profile: f.service.view().profileId, chat: args.chatId }; } }, { withOwner: f.ownership.run });
  try {
    const owner = f.ownership.capture(), a = bridge.serverSpec('same', owner); owner.profileId = 'B';
    const other = bridge.serverSpec('other', f.ownership.capture()); assert.notEqual(a.env.BARKDOWN_BROWSER_TOKEN, other.env.BARKDOWN_BROWSER_TOKEN);
    const spoof = await request(a, { chatId: 'other', args: { command: 'note.list', chatId: 'other', profileOwner: { profileId: 'B', generation: 'fake' } } });
    assert.deepEqual(spoof.result, { profile: 'A', chat: 'same' }); assert.deepEqual(calls[0].args.profileOwner, { profileId: 'A', generation: 'one' });
    assert.deepEqual((await request(other)).result, { profile: 'A', chat: 'other' });
    await f.switch('B');
    for (const tool of ['app', 'app_commands', 'tabs_context', 'javascript']) {
      const before = calls.length, answer = await request(a, { tool }); assert.equal(answer.ok, false); assert.equal(answer.code, 'profile_changed'); assert.equal(calls.length, before);
    }
    const b = bridge.serverSpec('same', f.ownership.capture()); assert.deepEqual((await request(b)).result, { profile: 'B', chat: 'same' });
    await f.switch('A'); assert.equal((await request(a)).code, 'profile_changed', 'Returning to A cannot revive its prior generation');
    assert.equal((await request(a, { token: 'invalid' })).error, 'refused');
  } finally { bridge.close(); }
});
test('selection waits for an admitted asynchronous command and refuses another while switching', async () => {
  const f = fixture(), held = deferred(), entered = deferred(), owner = f.ownership.capture();
  const operation = f.ownership.run(owner, async () => { entered.resolve(); await held.promise; return f.service.view().profileId; }, { tool: 'app', args: { command: 'note.list' } });
  await entered.promise; let selected = false; const switching = f.switch('B').then(() => { selected = true; });
  await assert.rejects(f.ownership.run(owner, () => assert.fail('must not dispatch'), { tool: 'tabs_context' }), { code: 'profile_changed' });
  assert.equal(selected, false); held.resolve(); await assert.rejects(operation, { code: 'profile_changed' }); await switching; assert.equal(f.service.view().profileId, 'B');
});
test('explicit profile switching can select without waiting on itself, including command case normalization', async () => {
  for (const command of ['profile.switch', 'PROFILE.SWITCH']) {
    const f = fixture(), owner = f.ownership.capture();
    await f.ownership.run(owner, () => f.switch('B'), { tool: 'app', args: { command } });
    assert.equal(f.service.view().profileId, 'B');
    await assert.rejects(f.ownership.run(owner, () => assert.fail('old command cannot select'), { tool: 'app', args: { command } }), { code: 'profile_changed' });
  }
});
test('background scope is never captured as the foreground profile and legacy remains explicit', async () => {
  const f = fixture(); await f.switch('B'); const owner = f.ownership.capture('A');
  assert.deepEqual(owner, { profileId: 'A', generation: null });
  await assert.rejects(f.ownership.run(owner, () => assert.fail()), { code: 'profile_changed' });
  await assert.rejects(f.ownership.run(null, () => assert.fail()), { code: 'profile_changed' });
  const legacy = createAssistantOwner({ service: () => null, gate: () => null });
  assert.equal(legacy.capture(), null); assert.equal(await legacy.run(null, () => 'legacy'), 'legacy');
  await assert.rejects(legacy.run(owner, () => assert.fail()), { code: 'profile_changed' });
});
