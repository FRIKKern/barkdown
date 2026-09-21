import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createProfileIpcGate } = createRequire(import.meta.url)('../main/profile-ipc');
let selected = 'A', generation = 1, release;
const service = {
  validate(owner) { if (owner.profileId !== selected || owner.generation !== generation) throw new Error('stale owner'); },
  async select(owner, profileId) { this.validate(owner); selected = profileId; generation++; return { profileId, generation }; }
};
const gate = createProfileIpcGate(service), owner = { profileId: 'A', generation: 1 }, order = [];
const pending = gate.request(owner, async () => { await new Promise(resolve => { release = resolve; }); order.push(selected); });
await Promise.resolve();
const switching = gate.select(owner, 'B', () => { order.push('rebound B'); });
await assert.rejects(gate.request(owner, () => {}), /in progress/);
assert.equal(selected, 'A'); release(); await pending;
const b = await switching;
assert.deepEqual(order, ['A', 'rebound B']);
await assert.rejects(gate.request(owner, () => {}), /stale/);
assert.equal(await gate.request(b, () => selected), 'B');
await assert.rejects(gate.select(b, 'A', () => { throw new Error('fixture cache failed'); }), /cache failed/);
await assert.rejects(gate.request({ profileId: 'A', generation: 3 }, () => {}), /restart to recover/);
console.log('PASS profile IPC drains existing handlers, rejects stale work and fails closed on activation failure');
