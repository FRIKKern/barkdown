// A Paper note's Outline: a narrow panel beside the note listing its headings (h1–h4) nested by level, the
// note's title on top and "1,234 words · 5 min read" below. It follows the editor while it is open (one
// MutationObserver, debounced), never edits the note or moves its caret: a row scrolls the note's scroller
// so the heading sits near the top and briefly highlights it with a CSS highlight, which ProseMirror never
// sees. The open state is the tab's (tab.outlineOpen in workspace.json); closed it observes nothing.
import { el, iconHtml } from './ui.js';
import { outlineRows, countWords, outlineSummary, currentSection, readingLine } from './note-outline-model.js';

const HEADINGS = 'h1, h2, h3, h4';
const DEBOUNCE_MS = 200;
const TOP_MARGIN = 16; // a chosen heading lands this far below the top edge
const READING_LINE = 40; // a heading this close to the top counts as the section being read
const FLASH = 'bw-outline-flash';
const MAC = /Mac/.test(navigator.platform);
const isHeading = node => /^H[1-6]$/.test(node?.tagName || '');

// options: isOpen(), setOpen(open) to remember it, title() for a note without a heading title,
// takePosition() so a jump counts as the reader's own scroll (a late position restore must not undo it).
export function noteOutline(pane, scroller, options) {
  const panel = el('<aside class="bw-outline" aria-label="Outline" hidden><button type="button" class="bw-outline-title" data-outline-title></button><ol class="bw-outline-list"></ol><p class="bw-outline-empty" hidden></p><footer class="bw-outline-footer"></footer></aside>');
  pane.appendChild(panel);
  const button = el(`<button type="button" data-act="outline" aria-pressed="false" aria-label="Outline" title="Outline (${MAC ? '⇧⌘O' : 'Ctrl+Shift+O'})">${iconHtml('list-tree')}</button>`);
  const titleRow = panel.querySelector('.bw-outline-title'), list = panel.querySelector('.bw-outline-list');
  const empty = panel.querySelector('.bw-outline-empty'), footer = panel.querySelector('.bw-outline-footer');
  let canvas = null, open = false, destroyed = false, observer = null, timer = 0, frame = 0, flashTimer = 0;
  let targets = [], rows = [], tops = null, current = null, signature = '';
  const resize = new ResizeObserver(() => { tops = null; pick(); });

  const root = () => canvas?._editor?.view?.dom || canvas?.querySelector('.ProseMirror') || null;
  function bodyText(rootEl, titleEl) {
    // The editor's own model gives words with block boundaries; marks never split a word.
    const doc = canvas?._editor?.state?.doc;
    if (doc?.textBetween) return doc.textBetween(doc.firstChild?.type?.name === 'heading' ? doc.firstChild.nodeSize : 0, doc.content.size, '\n', ' ');
    return [...rootEl.children].filter(node => node !== titleEl).map(node => node.innerText || node.textContent || '').join('\n');
  }

  function render() {
    timer = 0;
    if (!open || destroyed) return;
    const rootEl = root();
    // Barkpark takes a note's title from its first heading; that heading is the title row, not a section.
    const first = rootEl?.firstElementChild, titleEl = isHeading(first) ? first : null;
    titleRow.textContent = (titleEl ? titleEl.textContent : options.title())?.trim() || 'Untitled';
    targets = rootEl ? [...rootEl.querySelectorAll(HEADINGS)].filter(h => h !== titleEl && h.getClientRects().length) : [];
    rows = outlineRows(targets.map(h => ({ level: Number(h.tagName[1]), text: h.textContent })));
    const next = JSON.stringify(rows.map(r => [r.depth, r.level, r.text, r.empty]));
    if (next !== signature) {
      signature = next;
      list.replaceChildren(...rows.map(row => {
        const item = document.createElement('li'), jump = document.createElement('button');
        jump.type = 'button'; jump.className = 'bw-outline-row'; jump.dataset.index = row.index; jump.dataset.depth = row.depth;
        jump.style.setProperty('--depth', row.depth); jump.setAttribute('aria-level', row.depth + 1);
        if (row.empty) jump.dataset.empty = 'true';
        jump.textContent = row.text; jump.title = row.text;
        item.append(jump);
        return item;
      }));
      current = null;
    }
    empty.hidden = rows.length > 0;
    empty.textContent = rootEl ? 'No headings yet' : 'Nothing to outline';
    const text = rootEl ? bodyText(rootEl, titleEl) : '';
    const summary = outlineSummary(countWords(text), [...text.replace(/\n/g, '')].length);
    footer.textContent = rootEl ? summary.text : ''; footer.title = rootEl ? summary.title : '';
    tops = null; pick();
  }
  const schedule = () => { if (open && !timer) timer = setTimeout(render, DEBOUNCE_MS); };

  // Mark the section being read: the last heading at or above the reading line; the title above the first.
  function pick() {
    if (!open || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!open || destroyed) return;
      if (!tops) { const base = scroller.getBoundingClientRect().top - scroller.scrollTop; tops = targets.map(h => h.getBoundingClientRect().top - base); }
      const at = currentSection(tops, readingLine(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight), READING_LINE);
      if (at === current) return;
      current = at;
      panel.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
      const row = at < 0 ? titleRow : list.querySelector(`[data-index="${at}"]`);
      if (!row) return;
      row.setAttribute('aria-current', 'location');
      // Keep the marked row in view inside the list without scrolling anything else.
      if (row !== titleRow) {
        const top = row.offsetTop - list.offsetTop, bottom = top + row.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      }
    });
  }
  const onScroll = () => pick();

  function flash(heading) {
    if (!globalThis.CSS?.highlights || !window.Highlight) return;
    const range = document.createRange(); range.selectNodeContents(heading);
    CSS.highlights.set(FLASH, new Highlight(range));
    clearTimeout(flashTimer); flashTimer = setTimeout(() => CSS.highlights.delete(FLASH), 1400);
  }
  function go(index) {
    const heading = index < 0 ? null : targets[index];
    if (index >= 0 && !heading?.isConnected) return;
    options.takePosition?.();
    // Laid over a narrow note, the panel steps aside once a heading is chosen. It closes before the scroll:
    // the pane's layout change would otherwise cancel a smooth scroll that had just started.
    if (getComputedStyle(panel).position === 'absolute') { const focused = panel.contains(document.activeElement); setOpen(false); if (focused) button.focus({ preventScroll: true }); }
    const top = heading ? scroller.scrollTop + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - TOP_MARGIN : 0;
    scroller.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (heading) flash(heading);
  }
  titleRow.onclick = () => go(-1);
  list.addEventListener('click', event => { const row = event.target.closest('.bw-outline-row'); if (row) go(Number(row.dataset.index)); });
  panel.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [titleRow, ...list.querySelectorAll('.bw-outline-row')], at = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)));
    event.preventDefault(); items[next]?.focus();
  });

  function connect() {
    observer?.disconnect(); resize.disconnect();
    if (!canvas) return;
    observer = new MutationObserver(schedule);
    observer.observe(canvas, { childList: true, subtree: true, characterData: true });
    resize.observe(canvas); resize.observe(scroller);
  }
  function disconnect() { observer?.disconnect(); observer = null; resize.disconnect(); clearTimeout(timer); timer = 0; cancelAnimationFrame(frame); frame = 0; }

  function setOpen(value, { remember = true } = {}) {
    open = Boolean(value) && !destroyed;
    panel.hidden = !open; pane.classList.toggle('bw-outline-open', open);
    button.setAttribute('aria-pressed', String(open));
    scroller.removeEventListener('scroll', onScroll);
    if (open) { scroller.addEventListener('scroll', onScroll, { passive: true }); connect(); render(); }
    else { disconnect(); signature = ''; current = null; list.replaceChildren(); }
    if (remember) options.setOpen(open);
  }
  button.onclick = () => setOpen(!open);
  pane.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') { event.preventDefault(); event.stopPropagation(); setOpen(!open); }
  }, true);
  setOpen(options.isOpen(), { remember: false });

  return {
    button, panel,
    // The pane mounts a new editor per note it shows (and none for a deleted note).
    watch(next) { canvas = next; if (open) { connect(); clearTimeout(timer); timer = 0; render(); } },
    toggle: setOpen,
    destroy() { destroyed = true; disconnect(); scroller.removeEventListener('scroll', onScroll); if (flashTimer) { clearTimeout(flashTimer); globalThis.CSS?.highlights?.delete(FLASH); } },
  };
}
