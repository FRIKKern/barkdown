import { libraryScope } from './library-refresh.js';

// Save a web page (or a selection of it) as a note, with New page's rules (note-creation.js): the creation
// intent, content included, is saved before main is asked, so a lost reply or a restart retries the same
// request and never makes a second note; a result that arrives after a profile or library switch is dropped.
// A kept intent is retried before anything new is clipped; it lives in its own slot so New page is unaffected.
// Save as a note from the chat menu (chat-menu.js) runs the same action in the slot `chatNoteCreation`, with
// `lenient` so main converts a reply's free Markdown block by block, and its own words in the report.
const REQUEST = /^[a-f0-9-]{36}$/;
export function createClipAction({ state, api, serialise, pages, refresh, place, open, report, done, render, newId = () => crypto.randomUUID(),
  slot = 'clipCreation', lenient = false, words = { earlier: 'The earlier clip', saving: 'Saving to notes' } }) {
  let busy = false;
  // capture: async () => ({ title, markdown }); destination: whatever `open` needs to decide where to show it.
  const action = async (capture, destination) => {
    if (busy) return;
    busy = true;
    const scope = libraryScope(state), owner = state.profileId, tree = pages();
    const current = () => scope === libraryScope(state) && tree === state.pages;
    let intent, earlier = false;
    try {
      intent = tree[slot];
      if (intent && (intent.profileId !== owner || !REQUEST.test(intent.requestId || '') || typeof intent.title !== 'string' || typeof intent.markdown !== 'string')) throw new Error(`${words.earlier} needs its original profile. It has been kept.`);
      if (intent) earlier = true;
      else {
        const clip = await capture();
        if (!current()) return;
        tree[slot] = intent = { requestId: newId(), profileId: owner, title: String(clip.title || ''), markdown: String(clip.markdown || '') };
      }
      await api.state.save(serialise());
      if (!current()) return;
      render();
      const note = await api.barkpark.createNoteWith({ requestId: intent.requestId, title: intent.title, markdown: intent.markdown, ...(lenient ? { lenient: true } : {}) });
      if (!current()) return;
      await refresh();
      if (!current()) return;
      if (!state.barkparkDocs.some(d => d.id === note.id && d.paperOwner === note.paperOwner)) state.barkparkDocs.push(note);
      place(note);
      open(note, destination);
      delete tree[slot];
      try { await api.state.save(serialise()); }
      catch (error) { tree[slot] = intent; throw error; }
      done(note, intent, earlier);
      return note;
    } catch (error) {
      if (!current()) return;
      if (tree[slot]) report(`${earlier ? `${words.earlier} "${intent.title || 'Untitled'}"` : words.saving} is not confirmed. Retry checks the same note. ` + error.message);
      else report(error.message);
    } finally { busy = false; if (current()) render(); }
  };
  action.busy = () => busy; // Pages says "not confirmed" only once a save has settled
  return action;
}
