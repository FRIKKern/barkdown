// Hold the entire window until main either closes it or releases this request.
// One early-finishing note must not become editable while another is settling.
export function installQuitSettlement({ api, root, state, controllers, savePositions, save }) {
  const surface = root.ownerDocument?.body || root;
  const composing = new Set();
  surface.addEventListener?.('compositionstart', event => composing.add(event.target), true);
  surface.addEventListener?.('compositionend', event => composing.delete(event.target), true);
  let active = null;
  function release(id) {
    const request = active;
    if (!request || request.id !== id) return;
    active = null;
    for (const unlock of request.unlock.reverse()) unlock();
    root.inert = request.priorInert;
    surface.inert = request.priorSurfaceInert;
  }
  api.app.onSettleRelease?.(release);
  api.app.onSettle?.(async id => {
    if (active) return;
    const request = { id, priorInert: root.inert, priorSurfaceInert: surface.inert, unlock: [] };
    const owner = [state.profileId, state.generation];
    active = request;
    // Each controller settled once, in rounds: a note that finishes mounting while the quit runs (a tab
    // restored at launch, opened as the runtime became ready) is locked and settled with the rest rather
    // than refusing the quit. A note that goes away, or a set that is still changing after three rounds,
    // still refuses.
    const settled = new Map();
    let results;
    try {
      if (!state.loaded) throw new Error('The workspace is still loading. Keep it open.');
      if (composing.size) throw new Error('Finish composing text before quitting.');
      for (let round = 0; round < 3; round++) {
        const pending = [...controllers.values()].filter(controller => !settled.has(controller));
        if (!pending.length) break;
        // Check composition before inert takes focus away from an input.
        for (const controller of pending) if (controller.lockForQuit) request.unlock.push(controller.lockForQuit());
        root.inert = true;
        // Preparation notices and dialogs can live beside the workspace root.
        surface.inert = true;
        const answers = await Promise.all(pending.map(async controller => {
          if (!controller.settle) return null;
          try { return await controller.settle(); }
          catch (error) { return { saved: false, kept: false, error: error.message || String(error) }; }
        }));
        if (active !== request) return;
        pending.forEach((controller, i) => settled.set(controller, answers[i]));
      }
      root.inert = true; surface.inert = true;
      savePositions();
      const workspace = await save.settle({ isCurrent: () => active === request });
      if (active !== request) return;
      if (composing.size || !workspace.assertCurrent()) throw new Error('The workspace changed after its quit copy was checked. Keep it open.');
      const open = [...controllers.values()];
      if (owner[0] !== state.profileId || owner[1] !== state.generation || open.length !== settled.size ||
        !open.every(controller => settled.has(controller))) throw new Error('The open notes changed while quitting. Keep the window open.');
      results = [...settled.values()];
      for (const result of results) if (result && (result.saved || result.kept) && !result.assertCurrent?.())
        throw new Error('A note changed after its quit copy was checked. Keep the window open.');
      results = results.filter(Boolean).map(({ saved, kept, error }) => ({ saved, kept, ...(error ? { error } : {}) }));
    } catch (error) { results = [{ saved: false, kept: false, error: error.message || String(error) }]; }
    if (active !== request) return;
    try { await api.app.settled(id, results); }
    catch { release(id); }
  });
}
