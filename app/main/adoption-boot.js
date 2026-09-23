// Startup policy only. The transaction helper verifies/copies data; no store is opened here.
async function prepareAdoptionBoot({ adoption, requested = false, rollback = false, profiles = false, choose }) {
  if (!adoption || typeof choose !== 'function') throw new Error('Adoption startup dependencies required');
  if (requested && rollback) throw new Error('Adoption and rollback must be separate actions');
  let state = await adoption.inspect();
  for (let step = 0; step < 8; step++) {
    if (!state || !['none', 'staged', 'activating', 'active', 'rolled-back', 'blocked'].includes(state.status)) throw new Error('Invalid adoption startup state');
    if (state.status === 'active') {
      if (!state.finalRoot || !state.profileId) throw new Error('Verified adoption root and identity required');
      if (rollback) {
        if (!state.actions?.includes('rollback')) throw new Error('Offline rollback unavailable');
        const action = await choose({ ...state, actions: ['rollback', 'quit'] });
        if (action !== 'rollback') return { mode: 'quit' };
        await adoption.recover({ action: 'rollback' });
        rollback = false;
        state = await adoption.inspect();
        continue;
      }
      return { mode: 'profiles', root: state.finalRoot, createEmpty: false };
    }
    if (state.status === 'none') {
      if (rollback) throw new Error('No adoption exists to roll back');
      if (!requested) return { mode: profiles ? 'profiles' : 'legacy', root: state.finalRoot, createEmpty: profiles };
      const action = await choose({ ...state, actions: ['prepare', 'quit'] });
      if (action !== 'prepare') return { mode: 'quit' };
      await adoption.prepare({});
      state = await adoption.inspect();
      // A prepared copy is not authority until the explicit activation succeeds.
      if (state.status === 'staged' && state.actions?.includes('activate')) {
        await adoption.recover({ action: 'activate' });
        state = await adoption.inspect();
      }
      continue;
    }
    if (state.status === 'rolled-back') {
      if (requested) throw new Error('This adoption was rolled back. Its retained profile requires inspection before a new adoption; no new copy was created');
      return { mode: 'legacy', createEmpty: false };
    }
    const available = state.actions || [];
    if (!Array.isArray(available) || available.some(action => !['resume', 'activate', 'rollback'].includes(action))) throw new Error('Invalid adoption recovery actions');
    const allowed = state.status === 'blocked' ? ['quit'] : [...available, 'quit'];
    const action = await choose({ ...state, actions: allowed });
    if (action === 'quit' || action == null) return { mode: 'quit' };
    if (!allowed.includes(action)) throw new Error('Unavailable adoption recovery action');
    await adoption.recover({ action });
    state = await adoption.inspect();
  }
  throw new Error('Adoption recovery did not reach a verified startup state');
}
module.exports = { prepareAdoptionBoot };
