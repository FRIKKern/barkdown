// A library switch that was interrupted (main/migration-selection.js journal in
// intent, replacing or rolling-back, or unreadable) blocks legacy edits until it is
// resumed or rolled back. This notice says so at start and offers exactly those two
// actions; nothing here is dismissible while the switch is mid-flight.
import { toast } from './ui.js';
const inFlight = new Set(['intent', 'replacing', 'rolling-back', 'blocked']);
export function installSwitchNotice({ api, state, prepareProfile }) {
  if (!inFlight.has(state.selection)) return null;
  const notice = document.createElement('aside');
  notice.className = 'bw-preparation-notice bw-switch-notice'; notice.setAttribute('role', 'alertdialog');
  const message = { intent: 'A library switch was interrupted before the notes were replaced.', replacing: 'A library switch was interrupted while the notes were being replaced.', 'rolling-back': 'A rollback of the library switch was interrupted.', blocked: 'The library switch journal could not be read.' }[state.selection];
  notice.innerHTML = `<p>${message} Legacy notes are read-only until the switch is resumed or rolled back. Nothing was lost: the backup, the staged Papers and the retained workspace are all kept.</p><div class="bw-preparation-actions">${state.selection === 'blocked' ? '' : '<button class="bw-btn" data-resume>Resume switch</button>'}<button class="bw-btn" data-rollback>Roll back</button></div>`;
  const run = async (action, button) => {
    for (const b of notice.querySelectorAll('button')) b.disabled = true;
    notice.querySelector('p').textContent = action === 'switch' ? 'Resuming the switch under the hold…' : 'Rolling back under the hold…';
    try { await prepareProfile(); await (action === 'switch' ? api.migration.switch() : api.migration.rollback()); toast('Done. Reloading.'); setTimeout(() => window.location.reload(), 800); }
    catch (error) { notice.querySelector('p').textContent = message + ' The last attempt failed: ' + error.message; for (const b of notice.querySelectorAll('button')) b.disabled = false; }
  };
  notice.querySelector('[data-resume]')?.addEventListener('click', event => run('switch', event.currentTarget));
  notice.querySelector('[data-rollback]').addEventListener('click', event => run('rollback', event.currentTarget));
  document.body.append(notice);
  return notice;
}
