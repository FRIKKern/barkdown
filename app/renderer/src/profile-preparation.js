// The window owns human buffers; main owns durable preparation and processes.
export function installProfilePreparation({ api, root, state, controllers, serialise, savePositions, dirtyCount, pauseSaves = () => false }) {
  const composing = new Set(), captures = new Map();
  root.addEventListener('compositionstart', e => composing.add(e.target), true);
  root.addEventListener('compositionend', e => composing.delete(e.target), true);
  const navigation = ['title', 'folder', 'tabs', 'active', 'draft', 'draftImages', 'following', 'editorExpanded', 'chatScroll', 'closedTargets', 'provider', 'model', 'effort', 'parent', 'parentTitle', 'side', 'createdAt'];
  const fingerprint = () => {
    const view = serialise();
    return JSON.stringify([view.profileId, view.generation, view.order, view.favorites, view.pages, view.current, view.mode, view.directTab,
      Object.entries(view.chats).map(([id, chat]) => [id, navigation.map(key => chat[key])])]);
  };
  function preflight(writerOpen = true) {
    if (composing.size) throw new Error('Finish composing text before preparing this profile.');
    if (dirtyCount()) throw new Error('Save your project file buffers before preparing this profile.');
    for (const c of controllers.values()) {
      if (c.isDirty?.() && (!c.freezeRecovery || !writerOpen)) throw new Error('Keep unsaved editors open. Save them before preparing this profile.');
    }
  }
  async function capture(request) {
    if (!state.loaded || state.profileId !== request.profileId || state.generation !== request.generation) throw new Error('The window belongs to another profile generation.');
    preflight(request.payload.writerOpen);
    savePositions();
    const before = fingerprint(), inventory = [...controllers.entries()], leases = [], priorInert = root.inert;
    const priorPaused = pauseSaves(true);
    root.inert = true;
    try {
      if (request.payload.writerOpen) await api.preparation.saveView(request.id, serialise());
      // Await every candidate so a sibling refusal cannot strand a later freeze.
      const outcomes = await Promise.allSettled(inventory.filter(([, c]) => c.freezeRecovery).map(async ([, c]) => {
        const lease = await c.freezeRecovery({ retain: request.payload.writerOpen ? (token, draft) => api.preparation.retain(request.id, token, draft) : null });
        leases.push(lease);
      }));
      const assertCurrent = () => state.profileId === request.profileId && state.generation === request.generation && root.inert && !composing.size && !dirtyCount() &&
        inventory.length === controllers.size && inventory.every(([key, c]) => controllers.get(key) === c && (c.freezeRecovery || !c.isDirty?.())) &&
        fingerprint() === before && leases.every(lease => lease.assertCurrent());
      const failed = outcomes.find(x => x.status === 'rejected'); if (failed) throw failed.reason;
      if (!assertCurrent()) throw new Error('The window changed during preparation. Its retained copies are kept; capture again.');
      const sessionId = crypto.randomUUID(), draftKeys = [...new Set(leases.flatMap(lease => lease.draftKeys))];
      captures.set(sessionId, { assertCurrent, release() { for (const lease of leases) lease.release(); root.inert = priorInert; pauseSaves(priorPaused); captures.delete(sessionId); } });
      return { profileId: state.profileId, sessionId, draftKeys };
    } catch (error) {
      for (const lease of leases) { try { lease.release(); } catch (cleanup) { (error.cleanupErrors ||= []).push(cleanup); } }
      root.inert = priorInert; pauseSaves(priorPaused); throw error;
    }
  }
  api.preparation.onRequest(async request => {
    if (request.profileId !== state.profileId || request.generation !== state.generation) throw new Error('Preparation request belongs to another profile.');
    if (request.method === 'capture') return capture(request);
    const held = captures.get(request.payload?.sessionId);
    if (!held) throw new Error('The foreground preparation freeze is no longer available.');
    if (request.method === 'assert') return Boolean(held.assertCurrent());
    if (request.method === 'release') { held.release(); return true; }
    throw new Error('Unknown preparation request.');
  });
  let notice;
  async function status() {
    let value;
    try { value = await api.preparation.status(); }
    catch (error) { root.inert = true; pauseSaves(true); showNotice('Preparation status could not be verified. Keep this window open. ' + error.message); throw error; }
    if (value.readOnly) {
      root.inert = true;
      pauseSaves(true);
      showNotice('Editing is paused for this profile while preparation is resolved.');
    }
    return value;
  }
  function showNotice(message) {
    if (!notice) {
      notice = document.createElement('aside'); notice.className = 'bw-preparation-notice'; notice.setAttribute('role', 'status');
      notice.innerHTML = '<p></p><label>Switch profile <select aria-label="Preparation profile"></select></label><button class="bw-btn">Switch</button>';
      document.body.append(notice);
      notice.querySelector('button').onclick = async () => {
        try { const id = notice.querySelector('select').value; if (id && id !== state.profileId) { await api.profiles.select(id); window.location.reload(); } }
        catch (error) { notice.querySelector('p').textContent = error.message; }
      };
      api.profiles.status().then(info => {
        for (const profile of info.profiles || []) { const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name; option.selected = profile.id === state.profileId; notice.querySelector('select').append(option); }
      }).catch(() => {});
    }
    notice.querySelector('p').textContent = message;
  }
  async function prepare() {
    preflight();
    pauseSaves(true);
    try { return await api.preparation.prepare(); }
    finally { try { await status(); } finally { if (!root.inert) pauseSaves(false); } }
  }
  return Object.freeze({ prepare, status });
}
