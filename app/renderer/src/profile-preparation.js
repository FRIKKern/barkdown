import { openRetainedDrafts } from './retained-drafts.js';
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
  let notice, lastStatus;
  async function status() {
    let value;
    try { value = await api.preparation.status(); }
    catch (error) { root.inert = true; pauseSaves(true); showNotice('Preparation status could not be verified. Keep this window open. ' + error.message); throw error; }
    if (value.readOnly) {
      root.inert = true;
      pauseSaves(true);
      // A reopened writer belongs to a fresh host by design (main/profile-launch-admission.js):
      // the process that aborted the preparation restarts. The selection journal names the outcome.
      showNotice(value.restartRequired ? (state.selection === 'selected' ? 'The library switch completed. Notes now live on Paper; legacy notes are retained read-only. Restart Barkdown to continue; retained drafts are kept.'
        : state.selection === 'rolled-back' ? 'The rollback completed. Legacy notes are back; Papers and their later edits stay on Paper. Restart Barkdown to continue editing; retained drafts are kept.'
        : 'Preparation was cancelled. Restart Barkdown to continue editing; retained drafts are kept.') : 'Editing is paused for this profile while preparation is resolved.');
    } else if (value.record?.phase === 'aborted') {
      // The same release transition ends a completed switch or rollback; the selection journal says which.
      showNotice(state.selection === 'selected' ? 'The library switch completed. Notes now live on Paper; legacy notes are retained read-only. Retained drafts are available.'
        : state.selection === 'rolled-back' ? 'The rollback completed. Legacy notes are back; Papers and their later edits stay on Paper. Retained drafts are available.'
        : 'Preparation was cancelled. Your retained drafts are available; the current Paper has not been replaced.');
    }
    lastStatus = value;
    if (notice) {
      notice.querySelector('[data-abort]').hidden = !value.record || value.record.phase === 'aborted' && !value.readOnly || value.restartRequired;
      notice.querySelector('[data-dismiss]').hidden = Boolean(value.readOnly);
      notice.querySelector('[data-restart]').hidden = !value.restartRequired;
    }
    return value;
  }
  function showNotice(message) {
    if (!notice) {
      notice = document.createElement('aside'); notice.className = 'bw-preparation-notice'; notice.setAttribute('role', 'status');
      notice.innerHTML = '<p></p><div class="bw-preparation-actions"><button class="bw-btn" data-drafts>Review retained drafts</button><button class="bw-btn" data-abort hidden>Cancel preparation</button><button class="bw-btn" data-dismiss hidden>Dismiss</button><button class="bw-btn" data-restart hidden>Restart Barkdown</button></div><label>Switch profile <select aria-label="Preparation profile"></select></label><button class="bw-btn" data-switch>Switch</button>';
      document.body.append(notice);
      notice.querySelector('[data-switch]').onclick = async () => {
        try { const id = notice.querySelector('select').value; if (id && id !== state.profileId) { await api.profiles.select(id); window.location.reload(); } }
        catch (error) { notice.querySelector('p').textContent = error.message; }
      };
      notice.querySelector('[data-drafts]').onclick = () => openRetainedDrafts({ api, owner: { profileId: state.profileId, generation: state.generation },
        isCurrent: owner => owner.profileId === state.profileId && owner.generation === state.generation });
      notice.querySelector('[data-dismiss]').onclick = () => { if (!lastStatus?.readOnly) { notice.remove(); notice = null; } };
      notice.querySelector('[data-restart]').onclick = async event => { event.currentTarget.disabled = true; try { await api.app.relaunch(); } catch (error) { event.currentTarget.disabled = false; notice.querySelector('p').textContent = 'Barkdown could not restart itself. ' + error.message; } };
      notice.querySelector('[data-abort]').onclick = async event => {
        event.currentTarget.disabled = true;
        try { await api.preparation.abort(); await status(); }
        catch (error) { await status().catch(() => {}); notice.querySelector('p').textContent = 'Preparation could not be cancelled. ' + error.message; }
        finally { notice.querySelector('[data-abort]').disabled = false; }
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
