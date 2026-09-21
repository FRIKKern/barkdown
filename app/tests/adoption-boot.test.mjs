import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { prepareAdoptionBoot } = require('../main/adoption-boot');
function fixture(status, extra = {}) {
  let state = { status, finalRoot: '/verified/profiles', actions: status === 'activating' ? ['activate'] : [], ...extra };
  const calls = [];
  return { calls, adoption: {
    inspect: () => ({ ...state }),
    prepare: async () => { calls.push('prepare'); state.status = 'staged'; state.actions = ['activate']; },
    recover: async ({ action }) => { calls.push(action); state = { ...state, status: action === 'rollback' ? 'rolled-back' : 'active', profileId: 'verified-id' }; },
  } };
}
test('ordinary legacy/profile boot only permits empty creation when no adoption exists', async () => {
  const f = fixture('none');
  const choose = () => { throw new Error('No recovery prompt expected'); };
  assert.equal((await prepareAdoptionBoot({ ...f, choose })).mode, 'legacy');
  assert.equal((await prepareAdoptionBoot({ ...f, choose, profiles: true })).createEmpty, true);
  assert.deepEqual(f.calls, []);
});
test('explicit adoption confirms prerequisite, prepares then activates and never seeds', async () => {
  const f = fixture('none');
  const result = await prepareAdoptionBoot({ ...f, requested: true, choose: s => { assert.deepEqual(s.actions, ['prepare', 'quit']); return 'prepare'; } });
  assert.deepEqual(f.calls, ['prepare', 'activate']);
  assert.deepEqual(result, { mode: 'profiles', root: '/verified/profiles', createEmpty: false });
});
test('active receipt chooses verified registry without flags; rollback cannot create empty profile', async () => {
  const choose = () => { throw new Error('Unexpected choice'); };
  assert.equal((await prepareAdoptionBoot({ ...fixture('active', { profileId: 'verified-id' }), choose })).mode, 'profiles');
  assert.deepEqual(await prepareAdoptionBoot({ ...fixture('rolled-back'), choose, profiles: true }), { mode: 'legacy', createEmpty: false });
});
test('interrupted activation requires explicit choice and post-recovery inspection', async () => {
  const f = fixture('activating');
  const result = await prepareAdoptionBoot({ ...f, profiles: true, choose: s => { assert.deepEqual(s.actions, ['activate', 'quit']); return 'activate'; } });
  assert.equal(result.mode, 'profiles'); assert.equal(result.createEmpty, false); assert.deepEqual(f.calls, ['activate']);
});
test('blocked and unknown state never route to writers; cancelled adoption remains untouched', async () => {
  const blocked = fixture('blocked');
  assert.equal((await prepareAdoptionBoot({ ...blocked, profiles: true, choose: s => { assert.deepEqual(s.actions, ['quit']); return 'quit'; } })).mode, 'quit');
  assert.deepEqual(blocked.calls, []);
  await assert.rejects(prepareAdoptionBoot({ ...fixture('foreign'), choose: () => 'quit' }), /Invalid/);
  const none = fixture('none');
  assert.equal((await prepareAdoptionBoot({ ...none, requested: true, choose: () => 'quit' })).mode, 'quit');
  assert.deepEqual(none.calls, []);
});
test('failed preparation, invalid recovery choice and incomplete active verification fail closed', async () => {
  const f = fixture('none'); f.adoption.prepare = () => { throw new Error('disk interruption'); };
  await assert.rejects(prepareAdoptionBoot({ ...f, requested: true, choose: () => 'prepare' }), /disk interruption/);
  await assert.rejects(prepareAdoptionBoot({ ...fixture('blocked'), choose: () => 'activate' }), /Unavailable/);
  await assert.rejects(prepareAdoptionBoot({ ...fixture('active'), choose: () => 'quit' }), /identity/);
});
test('active rollback is explicit, confirmed and re-inspected before legacy boot', async () => {
  const f = fixture('active', { profileId: 'verified-id', actions: ['rollback'] });
  const result = await prepareAdoptionBoot({ ...f, rollback: true, choose: () => 'rollback' });
  assert.deepEqual(result, { mode: 'legacy', createEmpty: false });
  assert.deepEqual(f.calls, ['rollback']);
  await assert.rejects(prepareAdoptionBoot({ ...fixture('none'), rollback: true, choose: () => 'rollback' }), /No adoption/);
});
