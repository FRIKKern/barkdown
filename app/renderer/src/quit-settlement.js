// Hold the entire window until main either closes it or releases this request.
// One early-finishing note must not become editable while another is settling.
export function installQuitSettlement({ api, root, state, controllers, savePositions, save }) {
  const surface = root.ownerDocument?.body || root;
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
    const owner = [state.profileId, state.generation], inventory = [...controllers.entries()];
    active = request;
    let results;
    try {
      if (!state.loaded) throw new Error('The workspace is still loading. Keep it open.');
      // Check composition before inert takes focus away from an input.
      for (const [, controller] of inventory) if (controller.lockForQuit) request.unlock.push(controller.lockForQuit());
      root.inert = true;
      // Preparation notices and dialogs can live beside the workspace root.
      surface.inert = true;
      results = await Promise.all(inventory.map(async ([, controller]) => {
        if (!controller.settle) return null;
        try { return await controller.settle(); }
        catch (error) { return { saved: false, kept: false, error: error.message || String(error) }; }
      }));
      if (active !== request) return;
      if (owner[0] !== state.profileId || owner[1] !== state.generation || inventory.length !== controllers.size ||
        !inventory.every(([key, c]) => controllers.get(key) === c)) throw new Error('The open notes changed while quitting. Keep the window open.');
      for (const result of results) if (result && (result.saved || result.kept) && !result.assertCurrent?.())
        throw new Error('A note changed after its quit copy was checked. Keep the window open.');
      savePositions(); save.flush();
      results = results.filter(Boolean).map(({ saved, kept, error }) => ({ saved, kept, ...(error ? { error } : {}) }));
    } catch (error) { results = [{ saved: false, kept: false, error: error.message || String(error) }]; }
    if (active !== request) return;
    try { await api.app.settled(id, results); }
    catch { release(id); }
  });
}
