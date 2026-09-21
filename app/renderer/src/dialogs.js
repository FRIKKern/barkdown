// In-app dialogs. Electron has no window.prompt(), and its confirm() is a bare native box, so every
// question the app asks goes through these: a small sheet in the dialog layer with the app's own
// controls, resolved as a promise. `openDialog` is the host the settings sheet also uses.
import { el, esc } from './ui.js';

const host = () => document.getElementById('bw-dialog');

// Mount `node` in the dialog layer. Returns close(). Backdrop click and Escape call onDismiss.
export function openDialog(node, { onDismiss } = {}) {
  const backdrop = host();
  backdrop.innerHTML = '';
  backdrop.appendChild(node);
  backdrop.hidden = false;
  const close = () => { backdrop.hidden = true; backdrop.innerHTML = ''; document.removeEventListener('keydown', onKey, true); backdrop.onpointerdown = null; };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDismiss ? onDismiss() : close(); } };
  document.addEventListener('keydown', onKey, true);
  backdrop.onpointerdown = e => { if (e.target === backdrop) { onDismiss ? onDismiss() : close(); } };
  return close;
}

// Ask for one line of text. Resolves with the trimmed value, or null when dismissed.
export function askText({ title, label = '', value = '', placeholder = '', confirm = 'OK', hint = '' } = {}) {
  return new Promise(resolve => {
    const node = el(`<form class="bw-sheet bw-ask" role="dialog" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      ${label ? `<label for="bw-ask-input">${esc(label)}</label>` : ''}
      <input id="bw-ask-input" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}">
      ${hint ? `<p class="bw-sheet-hint">${esc(hint)}</p>` : ''}
      <div class="bw-sheet-actions"><button type="button" data-cancel>Cancel</button><button type="submit" class="primary">${esc(confirm)}</button></div>
    </form>`);
    const input = node.querySelector('input');
    input.value = value;
    const close = openDialog(node, { onDismiss: () => { close(); resolve(null); } });
    node.querySelector('[data-cancel]').onclick = () => { close(); resolve(null); };
    node.onsubmit = e => { e.preventDefault(); const v = input.value.trim(); close(); resolve(v); };
    setTimeout(() => { input.focus(); input.select(); }, 20);
  });
}

// Ask yes or no. Resolves true for the confirming button.
export function askConfirm(message, { title = 'Are you sure?', confirm = 'OK', danger = false } = {}) {
  return new Promise(resolve => {
    const node = el(`<div class="bw-sheet bw-ask" role="alertdialog" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      <div class="bw-sheet-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary ${danger ? 'danger' : ''}" data-ok>${esc(confirm)}</button></div>
    </div>`);
    const close = openDialog(node, { onDismiss: () => { close(); resolve(false); } });
    node.querySelector('[data-cancel]').onclick = () => { close(); resolve(false); };
    node.querySelector('[data-ok]').onclick = () => { close(); resolve(true); };
    setTimeout(() => node.querySelector('[data-ok]').focus(), 20);
  });
}
