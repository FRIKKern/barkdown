import { libraryScope } from './library-refresh.js';

// Persist navigation intent before asking main to create. A retry after a lost
// reply or restart keeps the same request and human-selected parent.
export function createNoteAction({ state, api, serialise, pages, refresh, place, open, report, render, captureDestination = () => null, newId = () => crypto.randomUUID() }) {
  let busy = false;
  return async parent => {
    if (busy) return;
    const scope = libraryScope(state), owner = state.profileId, tree = pages(), destination = captureDestination();
    const current = () => scope === libraryScope(state) && tree === state.pages;
    busy = true;
    let intent;
    try {
      intent = tree.noteCreation;
      if (intent && (intent.profileId !== owner || !/^[a-f0-9-]{36}$/.test(intent.requestId || '') || (intent.parent !== null && typeof intent.parent !== 'string'))) throw new Error('The previous new-page request needs its original profile. It has been retained.');
      if (!intent) tree.noteCreation = intent = { requestId: newId(), profileId: owner, parent: typeof parent === 'string' ? parent : null };
      await api.state.save(serialise());
      if (!current()) return;
      render();
      const note = await api.barkpark.createNote(intent.requestId);
      if (!current()) return;
      await refresh();
      if (!current()) return;
      if (!state.barkparkDocs.some(d => d.id === note.id && d.paperOwner === note.paperOwner)) state.barkparkDocs.push(note);
      place(note, intent.parent);
      open(note, destination);
      delete tree.noteCreation;
      try { await api.state.save(serialise()); }
      catch (error) { tree.noteCreation = intent; throw error; }
      return note;
    } catch (error) {
      if (current()) report('New page is not confirmed. Retry checks the same note. ' + error.message);
    } finally { busy = false; if (current()) render(); }
  };
}
