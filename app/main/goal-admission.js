// One main-owned coordinator is shared by all profile-local schedulers in a host.
// A slot is released by driver finalization, never by deadline/abort/visibility.
class GoalAdmission {
  constructor(limit = 3, { canAcquire = () => true } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 3) throw new Error('Worker limit must be 1–3');
    this.limit = limit; this.owners = new Map(); this.listeners = new Set(); this.canAcquire = canAcquire;
  }
  acquire({ profileId, chatId, attemptId }) {
    if (!this.canAcquire(profileId)) return null;
    const key = JSON.stringify([profileId, chatId]);
    if (this.owners.size >= this.limit || this.owners.has(key)) return null;
    const owner = Object.freeze({ profileId, chatId, attemptId });
    this.owners.set(key, owner); let released = false;
    return () => {
      if (released) return false;
      released = true;
      if (this.owners.get(key) !== owner) throw new Error('Worker admission owner changed');
      this.owners.delete(key);
      queueMicrotask(() => { for (const listener of this.listeners) { try { listener(); } catch { /* Each scheduler retains its own fault. */ } } });
      return true;
    };
  }
  snapshot() { return [...this.owners.values()].map(owner => ({ ...owner })); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
module.exports = { GoalAdmission };
