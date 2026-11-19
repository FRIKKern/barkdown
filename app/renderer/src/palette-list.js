// Quick open's list. Each typed query is collected once and drawn; the arrow keys and Enter work on the list
// already drawn. Collecting runs every search (files, chats, documents, Papers), and a chat profile over the
// search cache's size reparses on each one (main/chat-search.js), so moving through hits must not collect again.
// Enter runs the highlighted row from the drawn list: collecting again could swap the item under the highlight.
import { esc, iconHtml } from './ui.js';

const EMPTY = '<div class="bw-palette-empty">Nothing matches. Try a tab, document, chat, file, or action.</div>';

export function createPaletteList({ panel, input, list, collect, scope }) {
  let items = [];
  let index = 0;
  let drawn = null; // the query and library scope the drawn list belongs to; null while a collect is pending
  let pending = null;
  const current = () => input.value.trim().toLowerCase() + '\n' + scope();

  function render() {
    const query = input.value.trim().toLowerCase();
    const at = scope();
    drawn = null;
    const job = pending = (async () => {
      const all = await collect(query);
      if (panel.hidden || input.value.trim().toLowerCase() !== query || scope() !== at) return false;
      items = all.filter(i => i.noFilter || !query || (i.label + ' ' + i.group + ' ' + i.hint).toLowerCase().includes(query));
      index = Math.min(index, Math.max(0, items.length - 1));
      draw();
      drawn = query + '\n' + at;
      return true;
    })();
    job.finally(() => { if (pending === job) pending = null; }).catch(() => {});
    return job;
  }

  function draw() {
    let group = '';
    list.innerHTML = items.length ? items.map((i, n) => (group === i.group ? '' : (group = i.group, `<div class="bw-palette-group">${esc(i.group)}</div>`)) + `<button type="button" role="option" data-palette="${n}" aria-selected="${n === index}">${iconHtml(i.icon)}<span>${i.html || esc(i.label)}</span><small>${esc(i.hint || '')}</small></button>`).join('') : EMPTY;
    list.querySelectorAll('[data-palette]').forEach(b => {
      b.onclick = () => run(Number(b.dataset.palette));
      b.onpointermove = () => { if (Number(b.dataset.palette) !== index) highlight(Number(b.dataset.palette)); };
    });
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  function highlight(n) {
    index = n;
    list.querySelectorAll('[data-palette]').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.palette) === index)));
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  function run(n, alt = false) {
    const item = items[n];
    if (!item) return;
    panel.hidden = true;
    (alt && item.alt ? item.alt.run : item.run)();
  }

  // Enter right after a keystroke waits for that keystroke's list to be drawn (never a new collect), then runs the
  // row highlighted on it. A drawn list that no longer matches, with nothing pending, is redrawn and not run.
  async function enter(alt) {
    let seen;
    while (drawn !== current() && pending && pending !== seen) { seen = pending; await seen.catch(() => false); }
    if (drawn === current()) return run(index, alt);
    if (!pending) render();
  }

  // ArrowUp/ArrowDown and Enter; true when the key was the list's.
  function keydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) highlight((index + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
      return true;
    }
    if (e.key === 'Enter') { e.preventDefault(); enter(e.shiftKey); return true; }
    return false;
  }

  // A new query starts at the top.
  function open() { index = 0; return render(); }

  return { render, open, keydown, get items() { return items; }, get index() { return index; } };
}
