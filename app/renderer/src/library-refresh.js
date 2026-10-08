// Discovery never owns Pages placement. Only the latest refresh for the same
// profile and connection may publish a catalog or an error.
export function libraryScope(state) {
  const b = state.settings?.barkpark || {};
  return JSON.stringify([state.profileId, state.generation, b.enabled, b.effectiveServer || b.server,
    b.dataset, b.viaCli, b.catalogGeneration, b.local?.enabled, b.local?.source]);
}
export function createLibraryRefresh({ state, api, render, report }) {
  let sequence = 0, previousScope = null;
  return async function refreshLibrary() {
    const scope = libraryScope(state), request = ++sequence;
    const current = () => request === sequence && scope === libraryScope(state);
    if (scope !== previousScope) {
      state.barkparkDocs = [];
      state.barkparkLibraryError = null;
      // On boot, rendering before local documents arrive would seed Pages from
      // an empty library and permanently skip the initial human-facing notes.
      if (previousScope !== null) render();
      previousScope = scope;
    }
    // Start both requests together, and publish only while still owned.
    const results = await Promise.allSettled([api.docs.list(), state.settings?.barkpark?.enabled ? api.barkpark.list() : Promise.resolve([])]);
    if (!current()) return { status: 'superseded', isCurrent: current };
    if (results[0].status === 'fulfilled') state.documents = results[0].value;
    else report(results[0].reason.message);
    if (results[1].status === 'fulfilled') { state.barkparkDocs = results[1].value; state.barkparkLibraryError = null; }
    else {
      state.barkparkLibraryError = results[1].reason.message;
      // A library that is away answers with a server status or not at all; the person reads what it means.
      const reason = String(results[1].reason.message || '').replace(/^\[[\w-]+\]\s*/, '');
      const away = /^5\d\d\b|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|timed out|timeout|is not running|stopped answering/i.test(reason);
      report((away ? 'The library did not answer. It restarts by itself.' : 'Barkpark: ' + reason) + (state.barkparkDocs.length ? ' Showing the last successful library.' : ''));
    }
    // Commands need this request's result, not the last successful UI cache.
    // Capture before rendering; ownership must also survive until consumption.
    const receipt = results[1].status === 'fulfilled'
      ? { status: 'ready', documents: results[1].value.map(note => ({ ...note })), isCurrent: current }
      : { status: 'unavailable', error: state.barkparkLibraryError, isCurrent: current };
    render();
    return receipt;
  };
}
