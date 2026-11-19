import { libraryScope } from './library-refresh.js';
import { errorText } from '../../shared/error-code.js';
import { keptRequest, exposeKept } from './kept-request.js';

// Save a web page (or a selection of it) as a note, with New page's rules (note-creation.js): the creation
// intent, content included, is saved before main is asked, so a lost reply or a restart retries the same
// request and never makes a second note; a result that arrives after a profile or library switch is dropped.
// A kept intent is retried before anything new is clipped; it lives in its own slot so New page is unaffected.
// Save as a note from the chat menu (chat-menu.js) runs the same action in the slot `chatNoteCreation`, with
// `lenient` so main converts a reply's free Markdown block by block, and its own words in the report.
//
// A kept request never blocks later saves for good (kept-request.js, shared with New page): one main refuses for
// good is dropped at once with the reason, and Pages shows an unconfirmed one with Retry (the same request) and Discard.
// `unavailable()` says why a save can't run now (no local library), or null; it is asked first on every press,
// Pages' Retry included, so a retry with the library off says so and keeps the request.
// `remember(destination)` adds what the intent keeps about where the save was pressed, so a retry from
// anywhere opens the note there; `open(note, destination, intent)` gets the intent to read it back.
// `passOn(intent, destination)`: a press for another destination (another chat) than the kept request's. That
// press retries the kept request quietly (placed in Pages, never opened, so the screen stays put), then saves its
// own; if the kept one fails, `words.held(intent, destination, dropped)` names what is in the way and what to
// press, and the press's own save is not made. done(note, intent, earlier, retried, quiet).
const REQUEST = /^[a-f0-9-]{36}$/;
export function createClipAction({ state, api, serialise, pages, refresh, place, open, report, done, render, newId = () => crypto.randomUUID(),
  slot = 'clipCreation', lenient = false, remember = () => ({}), unavailable = () => null, passOn = () => false,
  words = { earlier: 'The earlier clip', saving: 'Saving to notes', notice: 'Saved page not confirmed.', dropped: 'Dropped the unconfirmed saved page. Save to notes makes a new one.' },
  notice = 'clip' }) {
  const held = keptRequest({ state, api, serialise, pages, slot, render, report, words, notice });
  // capture: async () => ({ title, markdown }), or null to only retry a kept request.
  // destination: whatever `open` needs to decide where to show it.
  const action = async (capture, destination) => {
    if (held.busy) return;
    if (!capture && !pages()[slot]) return;
    const why = unavailable();
    if (why) { report(why); return; }
    held.busy = true;
    const scope = libraryScope(state), owner = state.profileId, tree = pages();
    const current = () => scope === libraryScope(state) && tree === state.pages;
    let intent, earlier = false, quiet = false;
    // Sends `intent`, places the note and opens it (unless quiet); null when a switch dropped the result.
    const send = async () => {
      await api.state.save(serialise());
      if (!current()) return null;
      render();
      const note = await api.barkpark.createNoteWith({ requestId: intent.requestId, title: intent.title, markdown: intent.markdown, ...(lenient ? { lenient: true } : {}) });
      if (!current()) return null;
      await refresh();
      if (!current()) return null;
      if (!state.barkparkDocs.some(d => d.id === note.id && d.paperOwner === note.paperOwner)) state.barkparkDocs.push(note);
      place(note);
      if (!quiet) open(note, destination, intent);
      delete tree[slot];
      try { await api.state.save(serialise()); }
      catch (error) { tree[slot] = intent; throw error; }
      return note;
    };
    try {
      intent = tree[slot];
      if (intent && (intent.profileId !== owner || !REQUEST.test(intent.requestId || '') || typeof intent.title !== 'string' || typeof intent.markdown !== 'string')) throw new Error(`${words.earlier} needs its original profile. It has been kept.`);
      if (intent) {
        earlier = true;
        quiet = Boolean(capture) && passOn(intent, destination);
        const note = await send();
        if (!note) return;
        done(note, intent, true, !capture, quiet);
        if (!quiet) return note;
        earlier = quiet = false;
      }
      const clip = await capture();
      if (!current()) return;
      tree[slot] = intent = { requestId: newId(), profileId: owner, title: String(clip.title || ''), markdown: String(clip.markdown || ''), ...remember(destination) };
      const note = await send();
      if (!note) return;
      done(note, intent, false, false, false);
      return note;
    } catch (error) {
      if (!current()) return;
      const what = earlier ? `${words.earlier} "${intent.title || 'Untitled'}"` : words.saving;
      if (await held.dropRefused(tree, intent, error)) {
        if (!current()) return;
        report(quiet ? `${what} was refused, so that request was dropped: ${errorText(error)} ${words.held(intent, destination, true)}`
          : `${what} was refused, so that request was dropped. Press again to try anew. ${errorText(error)}`);
      } else if (tree[slot]) report(quiet ? `${what} is not confirmed. ${words.held(intent, destination, false)}`
        : `${what} is not confirmed. Retry checks the same note. ` + errorText(error));
      else report(errorText(error));
    } finally { held.busy = false; if (current()) render(); }
  };
  return exposeKept(action, held, () => action(null, null));
}
