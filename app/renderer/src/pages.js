// Notion-like page tree for the sidebar. Pages are local documents or Barkpark papers (ids "bp:<slug>");
// the tree itself (order, nesting, expansion) belongs to Barkdown and persists with the workspace.
// Everything in the library that is not placed in the tree lives in the Archive below it.
import { el, esc, iconHtml, toast } from './ui.js';
import { state, save } from './state.js';

export function ensurePages() {
  if (!state.pages) state.pages = { roots: [], children: {}, expanded: {}, archiveOpen: false, archiveFilter: '' };
  return state.pages;
}

export function pageKey(id, source) { return source === 'barkpark' ? 'bp:' + id : id; }
export function splitKey(key) { return key.startsWith('bp:') ? { id: key.slice(3), source: 'barkpark' } : { id: key, source: 'local' }; }

function allKeys() {
  return [...state.documents.map(d => d.id), ...state.barkparkDocs.map(d => 'bp:' + d.id)];
}

function summaryFor(key) {
  const { id, source } = splitKey(key);
  return source === 'barkpark' ? state.barkparkDocs.find(d => d.id === id) : state.documents.find(d => d.id === id);
}

export function parentOf(key) {
  const pages = ensurePages();
  for (const [parent, kids] of Object.entries(pages.children)) if (kids.includes(key)) return parent;
  return null;
}

export function pagePath(key) {
  const path = [];
  let current = key;
  let guard = 0;
  while (current && guard++ < 20) { const s = summaryFor(current); path.unshift(s ? s.title : current); current = parentOf(current); }
  return path;
}

export function inTree(key) { const pages = ensurePages(); return pages.roots.includes(key) || Object.values(pages.children).some(kids => kids.includes(key)); }

export function removeFromTree(key) {
  const pages = ensurePages();
  pages.roots = pages.roots.filter(k => k !== key);
  for (const parent of Object.keys(pages.children)) pages.children[parent] = pages.children[parent].filter(k => k !== key);
}

export function addPage(key, parent = null, index = null) {
  const pages = ensurePages();
  if (key === parent) return;
  removeFromTree(key);
  const list = parent ? (pages.children[parent] = pages.children[parent] || []) : pages.roots;
  if (index == null || index > list.length) list.push(key); else list.splice(index, 0, key);
  if (parent) pages.expanded[parent] = true;
  save();
}

function isDescendant(candidate, ancestor) {
  const pages = ensurePages();
  const walk = key => (pages.children[key] || []).some(k => k === candidate || walk(k));
  return walk(ancestor);
}

// Drop existing seeded documents at the root the first time, so the tree is not empty.
export function seedTree() {
  const pages = ensurePages();
  if (pages.seeded) return;
  for (const d of state.documents) if (!inTree(d.id)) pages.roots.push(d.id);
  pages.seeded = true;
  save();
}

// Prune pages whose document no longer exists.
function prune() {
  const pages = ensurePages();
  const known = new Set(allKeys());
  if (!state.settings?.barkpark?.enabled) for (const k of [...known]) if (k.startsWith('bp:')) known.delete(k);
  const keep = key => known.has(key) || (key.startsWith('bp:') && state.settings?.barkpark?.enabled && !state.barkparkDocs.length);
  pages.roots = pages.roots.filter(keep);
  for (const parent of Object.keys(pages.children)) { pages.children[parent] = pages.children[parent].filter(keep); if (!keep(parent) || !pages.children[parent].length) delete pages.children[parent]; }
}

export function renderPages(host, deps) {
  const pages = ensurePages();
  prune();
  const { openKey, isOpen, onNewPage, onNewSubpage, onDelete } = deps;
  const row = (key, depth) => {
    const s = summaryFor(key);
    const kids = pages.children[key] || [];
    const expanded = Boolean(pages.expanded[key]);
    const { source } = splitKey(key);
    const title = s?.title || (key.startsWith('bp:') ? key.slice(3) : key);
    return `<div class="bw-page" data-page="${esc(key)}" data-depth="${depth}" draggable="true" style="--depth:${depth}">
      <button class="bw-nav bw-page-row ${isOpen(key) ? 'selected' : ''}" data-open="${esc(key)}" data-source="${source}" title="${esc(s?.excerpt || title)}">
        <span class="bw-page-toggle ${kids.length ? '' : 'empty'}" data-toggle="${esc(key)}" aria-label="${expanded ? 'Collapse' : 'Expand'}">${iconHtml(expanded ? 'chevron-down' : 'chevron-right', 12)}</span>
        ${iconHtml(source === 'barkpark' ? 'cloud' : 'file-text', 13)}<span class="bw-page-title">${esc(title)}</span>${s?.proposals ? '<span class="bw-dot" title="Pending proposal"></span>' : ''}
        <span class="bw-page-actions"><span data-add="${esc(key)}" title="Add a sub-page">${iconHtml('plus', 12)}</span><span data-more="${esc(key)}" title="Options">${iconHtml("ellipsis", 12)}</span></span>
      </button>
      ${expanded && kids.length ? `<div class="bw-page-children">${kids.map(k => row(k, depth + 1)).join('')}</div>` : ''}
    </div>`;
  };
  const treeHtml = pages.roots.length ? pages.roots.map(k => row(k, 0)).join('') : '<p class="bw-small bw-muted bw-page-empty">No pages yet. Add one with +, or pull a document up from the archive.</p>';
  const placed = new Set([...pages.roots, ...Object.values(pages.children).flat()]);
  const filter = (pages.archiveFilter || '').toLowerCase();
  const archive = allKeys().filter(k => !placed.has(k)).map(k => ({ key: k, s: summaryFor(k) })).filter(({ s, key }) => !filter || (s?.title || key).toLowerCase().includes(filter));
  const archiveHtml = `<div class="bw-label bw-archive-label"><button class="bw-archive-toggle" id="bw-archive-toggle" aria-expanded="${pages.archiveOpen}">${iconHtml(pages.archiveOpen ? 'chevron-down' : 'chevron-right', 12)} Archive <span class="bw-muted">${archive.length}</span></button></div>
    ${pages.archiveOpen ? `<div class="bw-archive" id="bw-archive"><input id="bw-archive-filter" type="search" placeholder="Filter ${allKeys().length - placed.size} unplaced…" value="${esc(pages.archiveFilter || '')}" aria-label="Filter archive">${archive.slice(0, 200).map(({ key, s }) => `<div class="bw-page" data-page="${esc(key)}" draggable="true"><button class="bw-nav bw-page-row bw-archive-row ${isOpen(key) ? 'selected' : ''}" data-open="${esc(key)}" data-source="${splitKey(key).source}" data-archive title="${esc(s?.excerpt || '')}">${iconHtml(splitKey(key).source === 'barkpark' ? 'cloud' : 'file-text', 13)}<span class="bw-page-title">${esc(s?.title || key)}</span><span class="bw-page-actions"><span data-place="${esc(key)}" title="Add to pages">${iconHtml('arrow-left', 12)}</span></span></button></div>`).join('')}${archive.length > 200 ? '<p class="bw-small bw-muted">Filter to see more.</p>' : ''}${!archive.length ? '<p class="bw-small bw-muted bw-page-empty">Everything is placed.</p>' : ''}</div>` : ''}`;
  host.innerHTML = `<div class="bw-label bw-pages-label"><span>Pages</span><span class="bw-spacer"></span><button class="bw-icon-button" id="bw-new-page" title="New page" aria-label="New page">${iconHtml('plus', 13)}</button></div><div class="bw-pages" id="bw-pages">${treeHtml}</div>${archiveHtml}`;

  host.querySelectorAll('[data-open]').forEach(b => {
    b.onclick = e => {
      const t = e.target.closest('[data-toggle],[data-add],[data-more],[data-place]');
      if (t?.dataset.toggle != null) { pages.expanded[t.dataset.toggle] = !pages.expanded[t.dataset.toggle]; save(); renderPages(host, deps); return; }
      if (t?.dataset.add != null) { onNewSubpage(t.dataset.add); return; }
      if (t?.dataset.place != null) { addPage(t.dataset.place, null); renderPages(host, deps); toast('Added to pages'); return; }
      if (t?.dataset.more != null) { showMenu(t, t.dataset.more, host, deps); return; }
      const { id, source } = splitKey(b.dataset.open);
      openKey(id, source);
    };
    b.oncontextmenu = e => { e.preventDefault(); showMenu(b, b.dataset.open, host, deps); };
  });
  host.querySelector('#bw-new-page').onclick = () => onNewPage(null);
  const toggle = host.querySelector('#bw-archive-toggle');
  toggle.onclick = () => { pages.archiveOpen = !pages.archiveOpen; save(); renderPages(host, deps); if (pages.archiveOpen) host.querySelector('#bw-archive-filter')?.focus(); };
  const filterInput = host.querySelector('#bw-archive-filter');
  if (filterInput) filterInput.oninput = () => { pages.archiveFilter = filterInput.value; const pos = filterInput.selectionStart; renderPages(host, deps); const again = host.querySelector('#bw-archive-filter'); again.focus(); again.setSelectionRange(pos, pos); };

  // Drag and drop: drop onto the upper or lower edge to reorder, onto the middle to nest.
  let dragKey = null;
  host.querySelectorAll('.bw-page[draggable]').forEach(node => {
    node.addEventListener('dragstart', e => { dragKey = node.dataset.page; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragKey); e.stopPropagation(); });
    node.addEventListener('dragend', () => { dragKey = null; host.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(n => n.classList.remove('drop-before', 'drop-after', 'drop-into')); });
  });
  host.querySelectorAll('#bw-pages .bw-page-row').forEach(rowEl => {
    const zone = e => { const r = rowEl.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height; return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into'; };
    rowEl.addEventListener('dragover', e => { if (!dragKey) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; rowEl.classList.remove('drop-before', 'drop-after', 'drop-into'); rowEl.classList.add('drop-' + zone(e)); });
    rowEl.addEventListener('dragleave', () => rowEl.classList.remove('drop-before', 'drop-after', 'drop-into'));
    rowEl.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      const target = rowEl.dataset.open;
      const key = dragKey || e.dataTransfer.getData('text/plain');
      if (!key || key === target || isDescendant(target, key)) return;
      const where = zone(e);
      if (where === 'into') addPage(key, target);
      else { const parent = parentOf(target); const list = parent ? pages.children[parent] : pages.roots; removeFromTree(key); const list2 = parent ? (pages.children[parent] = pages.children[parent] || []) : pages.roots; const idx = list2.indexOf(target); list2.splice(where === 'before' ? idx : idx + 1, 0, key); save(); }
      renderPages(host, deps);
    });
  });
  const tree = host.querySelector('#bw-pages');
  tree.addEventListener('dragover', e => { if (dragKey && e.target === tree) { e.preventDefault(); tree.classList.add('drop-root'); } });
  tree.addEventListener('dragleave', e => { if (e.target === tree) tree.classList.remove('drop-root'); });
  tree.addEventListener('drop', e => { if (e.target !== tree) return; e.preventDefault(); tree.classList.remove('drop-root'); const key = dragKey || e.dataTransfer.getData('text/plain'); if (key) { addPage(key, null); renderPages(host, deps); } });
}

function showMenu(anchor, key, host, deps) {
  document.querySelector('.bw-page-menu')?.remove();
  const { source } = splitKey(key);
  const placed = inTree(key);
  const menu = el(`<div class="bw-menu bw-page-menu"><button data-act="sub">${iconHtml('plus')}New sub-page</button>${placed ? `<button data-act="archive">${iconHtml('minus')}Move to archive</button>` : `<button data-act="place">${iconHtml('arrow-left')}Add to pages</button>`}<button data-act="side">${iconHtml('file-text')}Open beside chat</button>${source === 'local' ? `<button data-act="delete" class="bw-negative">${iconHtml('trash')}Delete document</button>` : ''}</div>`);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = Math.min(rect.left + 12, window.innerWidth - 260) + 'px';
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.right = 'auto';
  document.getElementById('app').appendChild(menu);
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', onDown, true); };
  const onDown = e => { if (!menu.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
  menu.querySelector('[data-act="sub"]').onclick = () => { close(); deps.onNewSubpage(key); };
  menu.querySelector('[data-act="archive"]') && (menu.querySelector('[data-act="archive"]').onclick = () => { close(); const pages = ensurePages(); const kids = pages.children[key] || []; const parent = parentOf(key); removeFromTree(key); for (const k of kids) addPage(k, parent); delete pages.children[key]; save(); renderPages(host, deps); });
  menu.querySelector('[data-act="place"]') && (menu.querySelector('[data-act="place"]').onclick = () => { close(); addPage(key, null); renderPages(host, deps); });
  menu.querySelector('[data-act="side"]').onclick = () => { close(); const { id, source: s } = splitKey(key); deps.openBeside(id, s); };
  menu.querySelector('[data-act="delete"]') && (menu.querySelector('[data-act="delete"]').onclick = () => { close(); deps.onDelete(splitKey(key).id); });
}
