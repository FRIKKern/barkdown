import { refusedForGood } from '../../shared/error-code.js';

// A creation request kept in the page tree until main confirms it (New page in note-creation.js; Save to notes
// and Save as a note in clip-note.js), so a lost reply or a restart retries the same request and never makes a
// second note. A kept request never blocks later presses for good: one main refuses for good
// (shared/error-code.js) is dropped at once, and Pages shows an unconfirmed one with Retry and Discard
// (pages.js renders every action's notice from `words.notice`; there is no other notice path).
export function keptRequest({ state, api, serialise, pages, slot, render, report, words, notice }) {
  let busy = false;
  const kept = {
    get busy() { return busy; },
    set busy(value) { busy = value; },
    // Pages says "not confirmed" only once a press has settled.
    kept: () => !busy && Boolean(pages()[slot]),
    // When main refused `intent` for good and it is still the kept one: drop it, save the drop, return true.
    async dropRefused(tree, intent, error) {
      if (!intent || tree[slot] !== intent || !refusedForGood(error)) return false;
      delete tree[slot];
      try { await api.state.save(serialise()); } catch {}
      return true;
    },
    // Drop the kept request: the next press makes a new note. A note main may already have made stays in the
    // library (in the archive), never lost. Returns whether anything was dropped.
    async discard() {
      const tree = pages(), intent = tree[slot];
      if (busy || !intent) return false;
      busy = true;
      try {
        delete tree[slot];
        try { await api.state.save(serialise()); }
        catch (error) { if (tree === state.pages && !tree[slot]) tree[slot] = intent; report('Could not discard: ' + error.message); return false; }
        return true;
      } finally { busy = false; if (tree === state.pages) render(); }
    },
    words,
    notice,
  };
  return kept;
}

// Gives `action` the surface Pages uses: busy(), kept(), retry(), discard(), words and notice.
export function exposeKept(action, kept, retry) {
  action.busy = () => kept.busy;
  action.kept = kept.kept;
  action.retry = retry;
  action.discard = kept.discard;
  action.words = kept.words;
  action.notice = kept.notice;
  return action;
}
