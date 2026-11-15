// Import Markdown files or a folder as Paper notes (main/markdown-import-ipc.js does the work).
// One request per note: the Pages line shows progress, and a profile or library change mid-import
// stops the loop and drops any late answer. Main records each file's creation request before it is
// sent, so choosing the same files again finishes the rest without duplicates.
import { libraryScope } from './library-refresh.js';
import { addPage, inTree, pageKey } from './pages.js';

const STOP = new Set(['import_closed', 'import_profile', 'import_journal', 'writes_disabled', 'paper_connection_changed', 'draft_identity']);
const codeOf = error => error?.code || /^\[([\w-]+)\]/.exec(error?.message || '')?.[1] || null;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A library holding its writes for a moment (503 storage_unavailable) wrote nothing: the same
// request goes again after a pause. Anything else is the note's answer.
const PAUSES = [1500, 4000, 10000];
async function importNote(api, importId, key, current) {
  for (let attempt = 0; ; attempt++) {
    try { return await api.barkpark.importMarkdownNote({ importId, key }); }
    catch (error) {
      if (codeOf(error) !== 'storage_unavailable' || attempt >= PAUSES.length || !current()) throw error;
      await new Promise(resolve => setTimeout(resolve, PAUSES[attempt]));
      if (!current()) throw error;
    }
  }
}

export function createMarkdownImport({ state, api, refresh, progress, report, finish }) {
  let running = false;
  return async kind => {
    if (running) return report('An import is already running.');
    if (!state.profileId || !state.settings?.barkpark?.local?.enabled) return report('Importing needs this profile’s local library. Turn it on in Settings › Barkpark.');
    const scope = libraryScope(state), current = () => scope === libraryScope(state);
    running = true;
    try {
      const plan = await api.barkpark.importMarkdownChoose(kind);
      if (!plan || !current()) return;
      if (!plan.notes.length) return report(plan.skipped.length ? `Nothing to import: ${plural(plan.skipped.length, 'file')} skipped (${plan.skipped[0].path}: ${plan.skipped[0].reason}).` : 'No Markdown files were found there.');
      progress(`Importing 0 of ${plan.notes.length}…`);
      await refresh();
      if (!current()) return;
      const placed = new Map();
      let created = 0, earlier = 0, missing = 0, failed = 0, stopped = null;
      for (const [index, note] of plan.notes.entries()) {
        progress(`Importing ${index + 1} of ${plan.notes.length}…`);
        let result;
        try { result = await importNote(api, plan.importId, note.key, current); }
        catch (error) {
          if (!current()) return;
          failed++;
          console.warn('[import]', note.relPath, error.message);
          if (STOP.has(codeOf(error))) { stopped = error; break; }
          continue;
        }
        if (!current()) return;
        missing += result.missing || 0;
        const key = pageKey(result.id, 'barkpark', result.paperOwner);
        const known = state.barkparkDocs.some(d => d.id === result.id && d.paperOwner === result.paperOwner);
        if (result.done) {
          earlier++;
          // A note an earlier run made keeps the place the person gave it; one deleted since stays gone.
          if (known) placed.set(note.key, key);
          if (known && !inTree(key)) addPage(key, placed.get(note.parentKey) ?? null);
          continue;
        }
        created++;
        if (!known) state.barkparkDocs.push(result);
        addPage(key, placed.get(note.parentKey) ?? null);
        placed.set(note.key, key);
      }
      progress(null);
      await refresh();
      if (!current()) return;
      const parts = [`Imported ${plural(created, 'note')}`];
      if (earlier) parts.push(`${earlier} already imported`);
      if (missing) parts.push(`${plural(missing, 'image')} missing`);
      if (failed) parts.push(`${failed} failed`);
      if (plan.skipped.length) parts.push(`${plural(plan.skipped.length, 'file')} skipped`);
      finish(parts.join(', ') + (stopped ? '. Stopped: ' + String(stopped.message).replace(/^\[[\w-]+\]\s*/, '') : '.'), Boolean(stopped || failed));
    } catch (error) {
      if (current()) report('Import did not start. ' + String(error.message || error).replace(/^\[[\w-]+\]\s*/, ''));
    } finally { running = false; progress(null); }
  };
}
