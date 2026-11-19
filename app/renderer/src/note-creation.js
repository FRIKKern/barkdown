import { libraryScope } from './library-refresh.js';
import { errorText } from '../../shared/error-code.js';
import { keptRequest, exposeKept } from './kept-request.js';

// Persist navigation intent before asking main to create. A retry after a lost
// reply or restart keeps the same request and human-selected parent.
// The request is kept the way a clip's is (kept-request.js): one main refuses for good is dropped with the reason,
// so the next press makes a new page, and Pages shows an unconfirmed one with Retry (the same request) and Discard.
// `unavailable()` says why New page can't run now (no local library), or null; Pages' Retry asks it too.
const words = { notice: 'New page not confirmed.', dropped: 'Dropped the unconfirmed new page. New page makes a new one.' };
export function createNoteAction({ state, api, serialise, pages, refresh, place, open, report, render, captureDestination = () => null, unavailable = () => null, newId = () => crypto.randomUUID() }) {
  const held = keptRequest({ state, api, serialise, pages, slot: 'noteCreation', render, report, words, notice: 'note' });
  const action = async parent => {
    if (held.busy) return;
    const why = unavailable();
    if (why) { report(why); return; }
    const scope = libraryScope(state), owner = state.profileId, tree = pages(), destination = captureDestination();
    const current = () => scope === libraryScope(state) && tree === state.pages;
    held.busy = true;
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
      if (!current()) return;
      if (await held.dropRefused(tree, intent, error)) {
        if (current()) report('New page was refused, so that request was dropped. Press again to try anew. ' + errorText(error));
      } else if (tree.noteCreation) report('New page is not confirmed. Retry checks the same note. ' + errorText(error));
      else report(errorText(error));
    } finally { held.busy = false; if (current()) render(); }
  };
  return exposeKept(action, held, () => (pages().noteCreation ? action(null) : undefined));
}
