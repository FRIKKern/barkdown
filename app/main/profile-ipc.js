// A foreground switch waits for existing request handlers, then rejects their
// old generation. Provider driver work outlives its short start handler and is
// protected separately by captured run scopes/runtime leases.
function createProfileIpcGate(service) {
  const pending = new Set();
  let switching = false;
  let failure = null;
  async function request(owner, handler) {
    if (failure) throw new Error('Profile activation failed; restart to recover: ' + failure.message);
    if (switching) throw new Error('Profile switch is in progress');
    service.validate(owner);
    const operation = Promise.resolve().then(() => {
      service.validate(owner);
      return handler();
    });
    pending.add(operation);
    try { return await operation; } finally { pending.delete(operation); }
  }
  async function select(owner, profileId, rebind, beforeSelect = async () => {}) {
    if (failure) throw new Error('Profile activation failed; restart to recover: ' + failure.message);
    if (switching) throw new Error('Profile switch is in progress');
    service.validate(owner); switching = true;
    try {
      await Promise.allSettled([...pending]);
      service.validate(owner);
      await beforeSelect();
      service.validate(owner);
      const result = await service.select(owner, profileId);
      try { await rebind(result); } catch (error) { failure = error; throw error; }
      return result;
    } finally { switching = false; }
  }
  return Object.freeze({ request, select });
}
module.exports = { createProfileIpcGate };
