const crypto = require('node:crypto');
// Requests are bound to one main frame and profile generation by the existing
// IPC envelope gate. Only a live capture ticket admits recovery writes.
function createPreparationBridge({ profiles, foreground, webContents, draftsFor, writerState }) {
  const pending = new Map();
  function request(profileId, method, payload) {
    const owner = profiles.view();
    if (owner.profileId !== profileId) throw new Error('Return to this profile before preparing its foreground buffers.');
    const wc = webContents();
    if (!wc || wc.isDestroyed()) throw new Error('The profile window is unavailable.');
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const lost = () => finish(new Error('The profile window changed during preparation. Retained evidence remains closed.'));
      const finish = (error, value) => {
        pending.delete(id); wc.removeListener('render-process-gone', lost); wc.removeListener('destroyed', lost); wc.removeListener('did-start-navigation', lost);
        if (error) reject(error); else resolve(value);
      };
      pending.set(id, { owner, method, finish });
      wc.once('render-process-gone', lost); wc.once('destroyed', lost); wc.once('did-start-navigation', lost);
      try { wc.send('preparation:request', { id, profileId, generation: owner.generation, method, payload }); } catch (error) { finish(error); }
    });
  }
  function owned(id, capture = false) {
    const ticket = pending.get(id);
    if (!ticket || capture && ticket.method !== 'capture') throw new Error('Preparation capture ticket is stale or invalid.');
    profiles.validate(ticket.owner); return ticket;
  }
  function reply({ id, value, error }) {
    const ticket = owned(id); ticket.finish(error ? new Error(String(error)) : null, value); return true;
  }
  function retain({ id, token, draft }) { const ticket = owned(id, true); return draftsFor(ticket.owner.profileId).retain(token, draft); }
  function saveView({ id, snapshot }) { const ticket = owned(id, true); return profiles.save(ticket.owner, snapshot); }
  async function freeze(profileId, context) {
    foreground.close(profileId);
    try {
      await foreground.drain(profileId);
      const value = await request(profileId, 'capture', context);
      if (value?.profileId !== profileId || typeof value.sessionId !== 'string' || !Array.isArray(value.draftKeys)) throw new Error('The window returned foreign preparation buffers.');
      return Object.freeze({ ...value,
        assertCurrent: () => request(profileId, 'assert', { sessionId: value.sessionId }),
        release: async () => {
          if (writerState(profileId).phase !== 'open') throw new Error('Writer admission is closed; the foreground remains paused.');
          if (await request(profileId, 'release', { sessionId: value.sessionId }) !== true) throw new Error('The window did not acknowledge releasing its freeze.');
          if (writerState(profileId).phase !== 'open') throw new Error('Writer admission is closed; the foreground remains paused.');
          foreground.release(profileId);
        },
      });
    } catch (error) {
      try { if (writerState(profileId).phase === 'open') foreground.release(profileId); }
      catch (cleanup) { (error.cleanupErrors ||= []).push(cleanup); }
      throw error;
    }
  }
  return Object.freeze({ reply, retain, saveView, freeze });
}
module.exports = { createPreparationBridge };
