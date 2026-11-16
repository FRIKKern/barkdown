// The Paper note's Export menu (the button in the note's path bar): Export as Markdown, HTML or PDF through
// the save dialog, or Copy as Markdown. Main reads the saved note and writes only the chosen file
// (main/note-export.js); this module only asks and reports.
import { el, iconHtml, toast, errorMessage, basename } from './ui.js';

const api = window.barkdown;
const ITEMS = [['markdown', 'file-text', 'Export as Markdown…'], ['html', 'file-code', 'Export as HTML…'], ['pdf', 'save', 'Export as PDF…'], null, ['copy', 'files', 'Copy as Markdown']];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function exportReport(result) {
  if (!result) return null;
  if (result.copied) return 'Copied as Markdown';
  let text = 'Exported to ' + basename(result.filePath);
  if (result.folder) text += ` · ${plural(result.images, 'picture')} in ${result.folder}`;
  else if (result.images && result.format !== 'markdown') text += ` · ${plural(result.images, 'picture')} embedded`;
  if (result.missing) text += ` · ${plural(result.missing, 'picture')} could not be fetched${result.format === 'pdf' ? ' and show as a caption' : ' and stay links'}`;
  return text;
}

// note(): { id, binding, paperOwner } or a string reason it cannot be exported now.
export function exportButton(note) {
  const button = el(`<button title="Export or copy this note" aria-label="Export note" aria-haspopup="menu" data-act="export">${iconHtml('folder-output')}</button>`);
  let busy = false;
  const run = async format => {
    const target = note();
    if (typeof target === 'string') return toast(target, 'error');
    busy = true; button.disabled = true;
    try { const report = exportReport(await api.barkpark.exportNote(target.id, format, target.binding, target.paperOwner)); if (report) toast(report); }
    catch (error) { toast('Could not export: ' + errorMessage(error), 'error'); }
    finally { busy = false; button.disabled = false; }
  };
  button.onclick = () => {
    if (busy) return;
    const open = document.querySelector('.bw-export-menu');
    if (open) { open.remove(); return; }
    const menu = el(`<div class="bw-menu bw-export-menu" role="menu" data-place="below-end">${ITEMS.map(item => item ? `<button type="button" role="menuitem" data-format="${item[0]}">${iconHtml(item[1])}${item[2]}</button>` : '<hr>').join('')}</div>`);
    const rect = button.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.max(8, Math.min(rect.right - 250, window.innerWidth - 258)) + 'px';
    document.getElementById('app').appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); };
    const onDown = e => { if (!menu.contains(e.target) && e.target !== button && !button.contains(e.target)) close(); };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); button.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...menu.querySelectorAll('button')], at = items.indexOf(document.activeElement);
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    };
    setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
    document.addEventListener('keydown', onKey, true);
    menu.querySelectorAll('[data-format]').forEach(item => { item.onclick = () => { close(); run(item.dataset.format); }; });
    menu.querySelector('button')?.focus();
  };
  return button;
}
