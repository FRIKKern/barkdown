import { el, esc, toast, errorMessage, relativeTime } from './ui.js';
import { openDialog } from './dialogs.js';
import { libraryScope } from './library-refresh.js';
import { state } from './state.js';

export async function openDeletedNotes({ refresh, openPaper }) {
  const scope = libraryScope(state), api = window.barkdown;
  const node = el(`<section class="bw-sheet bw-paper-recovery" role="dialog" aria-label="Deleted notes"><h2>Deleted notes</h2><p class="bw-sheet-hint">Recover a separate copy. Existing links and page placement stay with the original note.</p><div class="bw-recovery-list" aria-live="polite">Loading…</div><div class="bw-sheet-actions"><button data-close>Close</button></div></section>`);
  const close = openDialog(node);
  node.querySelector('[data-close]').onclick = close;
  const current = () => node.isConnected && scope === libraryScope(state);
  const host = node.querySelector('.bw-recovery-list');
  async function load() {
    try {
      const { records, binding } = await api.barkpark.deletedNotes();
      if (!current()) return;
      host.innerHTML = records.length ? '' : '<p class="bw-muted">No deleted notes in this library.</p>';
      for (const r of records) {
        const row = el(`<article class="bw-recovery-row"><div><strong>${esc(r.title)}</strong><p class="bw-small bw-muted">${r.status === 'sent' ? 'Deletion unconfirmed · ' : 'Deleted · '}${esc(relativeTime(r.at))}</p>${r.status === 'sent' ? '<p class="bw-small">The original may still exist. Checking only reads its status.</p>' : ''}</div><div class="bw-sheet-actions">${r.status === 'sent' ? '<button data-check>Check deletion</button>' : ''}<button data-recover>${r.copyId ? 'Open recovered copy' : 'Recover a copy'}</button></div></article>`);
        const perform = async action => {
          row.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try {
            if (!current()) return;
            if (action === 'check') { await api.barkpark.checkDeletion(r.key, binding); if (current()) await load(); }
            else {
              const paper = await api.barkpark.recoverNote(r.key, binding);
              if (!current()) return;
              await refresh(); if (!current()) return;
              close(); openPaper(paper); toast(r.copyId ? 'Opened the recovered copy' : 'Recovered a copy. Add it to Pages wherever you like.');
            }
          } catch (error) { if (current()) toast(errorMessage(error), 'error'); }
          finally { if (current()) row.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
        };
        row.querySelector('[data-check]')?.addEventListener('click', () => perform('check'));
        row.querySelector('[data-recover]').onclick = () => perform('recover');
        host.appendChild(row);
      }
    } catch (error) { if (current()) host.textContent = errorMessage(error); }
  }
  await load();
}
