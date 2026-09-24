import { agentPresence } from '../agent-presence.js';
import { renderAgentUndo } from '../agent-undo.js';
// Barkpark paper work tab: hosts Barkpark's own <bp-paper-canvas> (vendored bundle) over a real paper.
// Edits leave the canvas as bp-canvas-ops batches; each batch is applied through the fenced ops endpoint
// with the paper's revision, acknowledged on success, and the server echo is fed back so minted ids land.
import { el, esc, iconHtml, relativeTime, toast, errorCode, errorMessage, inlineMarkdownHtml } from '../ui.js';
import { state } from '../state.js';
import { askConfirm } from '../dialogs.js';
import { htmlToBlocks, blocksToMarkdown } from '../../../shared/portabledoc.js';
import { normaliseOps, reinsertMoves } from '../../../shared/ops.js';
import { ensureCanvasBundle } from '../canvas-bundle.js';

const api = window.barkdown;

export function mountPaper(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-doc-pane bw-paper-pane"><div class="bw-path" id="path"></div><div class="bw-current-pane" id="current"><div class="bw-document bw-paper-document"><div class="bw-kicker"><span id="kicker">Barkpark / Paper</span><span class="bw-doc-meta" id="meta"></span><span class="bw-save-state" id="save-state"></span></div><textarea class="bw-doc-title" id="title" rows="1" aria-label="Paper title" placeholder="Untitled"></textarea><div id="banner"></div><div id="agent-edit"></div><div id="proposals"></div><div id="conflict"></div><div class="bw-find" id="find" hidden><input id="find-q" type="text" placeholder="Find" aria-label="Find in paper"><span class="bw-find-count" id="find-count"></span><button type="button" class="bw-btn" id="find-prev" title="Previous (Shift+Enter)" aria-label="Previous match">↑</button><button type="button" class="bw-btn" id="find-next" title="Next (Enter)" aria-label="Next match">↓</button><input id="find-r" type="text" placeholder="Replace with" aria-label="Replace with"><button type="button" class="bw-btn" id="find-replace">Replace</button><button type="button" class="bw-btn" id="find-replace-all">All</button><button type="button" class="bw-btn" id="find-close" title="Close (Esc)" aria-label="Close find">×</button></div><div class="bp-paper-host" id="canvas-host"></div><div class="bw-doc-links" id="links"></div><div class="bw-doc-state" id="state"></div></div></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  // The receipt shares the existing metadata line; its arrival must not move
  // the editor while a person reads, selects text or takes over an agent edit.
  q('.bw-kicker').insertBefore(q('#agent-edit'), q('#save-state'));
  const presence = agentPresence(pane, () => q('.ProseMirror'), q('#current'));
  let refreshing = false, refreshAgain = false;
  const updateUndo = () => renderAgentUndo(q('#agent-edit'), 'bp:' + slug(), rev, async () => { if (hasUnsavedWork()) throw new Error('Finish saving your edit before Undo.'); presence.stop(); await api.docs.undoAgentEdit('bp:' + slug(), q('#agent-edit').dataset.editId, paper?.binding); await controller.refresh(); ctx.libraryChanged(); }, paper?.binding);
  let paper = null;
  let canvas = null;
  let positionReady = false, positionIntent = 0, cancelPositionRestore = () => {};
  const scroller = q('#current');
  // Loading layout is not a reading position. Explicit scrolling takes over
  // restoration, including a deliberate return to the top.
  const takePosition = () => { positionIntent++; positionReady = true; cancelPositionRestore(); };
  const positionEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'beforeinput'];
  for (const event of positionEvents) scroller.addEventListener(event, takePosition, { passive: true });
  let rev = null;
  let lastAcked = [];
  let destroyed = false;
  let saving = 0;
  let loadGeneration = 0;
  let mountedPath = [...tab.path];
  let mountedSource = tab.source;
  let inputVersion = 0;
  let titleDirty = false;
  let titleSaving = false;
  let pendingRetry = null;
  let latestSeq = null;
  let mergeAfterSave = false;
  const slug = () => mountedPath.at(-1);
  const hasUnsavedWork = () => Boolean(saving || titleDirty || pendingRetry || canvas?.hasPendingChanges?.());
  const connectionChanged = () => Boolean(paper?.connectionIdentity && paper.connectionIdentity !== state.settings?.barkpark?.connectionIdentity);
  const writesOn = () => Boolean(state.settings?.barkpark?.writes) && !connectionChanged();
  const writeUnavailable = () => connectionChanged() ? 'Restore this Paper’s original connection to use this action.' : 'Barkpark writes are off';

  // Find and replace: Ctrl+F / Ctrl+H inside the pane open the bar; the canvas paints the matches and
  // does the replacing (one transaction per replace-all, so undo is one step and the save is one batch).
  const findBar = q('#find');
  const findCountEl = q('#find-count');
  const syncFind = st => { const s = st || canvas?.findState?.() || { count: 0, index: -1 }; findCountEl.textContent = s.count ? `${s.index + 1} of ${s.count}` : (q('#find-q').value ? 'No matches' : ''); findCountEl.dataset.empty = s.count ? '' : 'true'; };
  const openFind = replaceToo => { findBar.hidden = false; findBar.dataset.replace = replaceToo ? 'true' : ''; const sel = String(window.getSelection?.() || '').trim(); if (sel && !sel.includes('\n')) q('#find-q').value = sel; q('#find-q').focus(); q('#find-q').select(); syncFind(canvas?.findSet?.(q('#find-q').value)); };
  const closeFind = () => { findBar.hidden = true; canvas?.findClear?.(); q('#find-count').textContent = ''; canvas?.querySelector('.ProseMirror')?.focus(); };
  q('#find-q').addEventListener('input', () => syncFind(canvas?.findSet?.(q('#find-q').value)));
  q('#find-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); syncFind(e.shiftKey ? canvas?.findPrev?.() : canvas?.findNext?.()); } if (e.key === 'Escape') { e.preventDefault(); closeFind(); } });
  q('#find-r').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); syncFind(e.ctrlKey || e.metaKey ? canvas?.replaceAll?.(q('#find-r').value) : canvas?.replaceCurrent?.(q('#find-r').value)); } if (e.key === 'Escape') { e.preventDefault(); closeFind(); } });
  q('#find-prev').onclick = () => syncFind(canvas?.findPrev?.());
  q('#find-next').onclick = () => syncFind(canvas?.findNext?.());
  q('#find-replace').onclick = () => { if (!writesOn()) return toast(writeUnavailable(), 'error'); syncFind(canvas?.replaceCurrent?.(q('#find-r').value)); };
  q('#find-replace-all').onclick = () => { if (!writesOn()) return toast(writeUnavailable(), 'error'); const r = canvas?.replaceAll?.(q('#find-r').value); syncFind(r); if (r?.replaced) toast(`Replaced ${r.replaced}`); };
  q('#find-close').onclick = closeFind;
  pane.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'f' || key === 'h')) { e.preventDefault(); e.stopPropagation(); openFind(key === 'h'); }
    else if (e.key === 'Escape' && !findBar.hidden) { e.preventDefault(); e.stopPropagation(); closeFind(); }
  }, true);

  function setSaveState(text, kind = '') { q('#save-state').textContent = text; q('#save-state').dataset.kind = kind; }
  function themeAttr() { const t = document.documentElement.dataset.theme; return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }

  async function fetchPaper() { return api.barkpark.get(slug(), paper?.binding, tab.paperOwner || null); }

  function renderMeta() {
    updateUndo();
    if (!paper) return;
    const crumbs = ctx.pagePath ? ctx.pagePath(slug(), 'barkpark', tab.paperOwner) : [];
    q('#kicker').textContent = crumbs.length > 1 ? crumbs.join(' / ') : '';
    q('#meta').textContent = `${connectionChanged() ? 'Original connection required' : writesOn() ? 'Editing live' : 'Read-only'} · edited ${relativeTime(paper.updatedAt)}${paper.draft ? ' · draft' : ''}${paper.blocks ? '' : ' · HTML body'}`;
  }

  // Barkpark derives a paper's title from its first heading, so when the document opens with one the
  // heading is the title row (Notion's model) and the separate input would only duplicate it.
  function syncTitleRow() {
    const first = canvas?._editor?.state?.doc?.firstChild;
    const headed = first ? first.type.name === 'heading' : /^heading$|^h[1-3]$/.test(canvas?.blocks?.[0]?.type || '');
    q('#title').hidden = Boolean(headed);
    q('#canvas-host').classList.toggle('bp-paper-host--titled', Boolean(headed));
  }

  function renderBanner() {
    const banner = q('#banner');
    banner.innerHTML = '';
    if (connectionChanged() && pendingRetry?.connectionChanged) return;
    if (connectionChanged()) {
      banner.appendChild(el('<div class="bw-conflict"><strong>Connection changed.</strong> This Paper stays with its original library. Restore that connection in Settings to save or reload it. Unsaved edits stay in this window.</div>'));
    } else if (!writesOn()) {
      const node = el(`<div class="bw-conflict"><strong>Read-only.</strong> Barkpark writes are off, so edits stay in this window. <button data-act="enable">Enable live editing</button></div>`);
      node.querySelector('[data-act="enable"]').onclick = async () => { try { state.settings = await api.settings.set({ barkpark: { writes: true } }); toast('Live editing enabled for Barkpark papers'); if (canvas && paper?.blocks) { canvas.setAttribute('editable', 'true'); q('#title').disabled = false; renderBanner(); renderMeta(); } else load(); } catch (error) { toast(error.message, 'error'); } };
      banner.appendChild(node);
    } else if (paper && !paper.blocks && paper.html) {
      const node = el(`<div class="bw-conflict"><strong>This paper is stored as HTML.</strong> Converting it to blocks makes it editable here; the conversion keeps headings, paragraphs, lists, quotes and code and drops other markup. <button data-act="convert">Convert to blocks</button></div>`);
      node.querySelector('[data-act="convert"]').onclick = async () => {
        if (!await askConfirm(`Convert "${paper.title}" to PortableDoc blocks on the server? This replaces its HTML body.`, { title: 'Convert to blocks?', confirm: 'Convert' })) return;
        try { await api.barkpark.publish({ binding: paper?.binding, slug: slug(), title: paper.title, blocks: htmlToBlocks(paper.html), description: paper.description || undefined }); toast('Converted to blocks'); load(); } catch (error) { toast('Could not convert: ' + error.message, 'error'); }
      };
      banner.appendChild(node);
    }
  }

  function renderPath() {
    const bar = q('#path');
    bar.innerHTML = `<span class="bw-muted">Barkpark paper · ${esc(slug())}</span>`;
    const actions = el('<div class="bw-doc-actions"></div>');
    const ask = el(`<button title="Ask the assistant about this paper">${iconHtml('sparkles')} Ask</button>`);
    ask.onclick = () => { if (connectionChanged()) return toast('Restore this Paper’s original connection before asking about it.', 'error'); ctx.askAbout(`About the Barkpark paper "${paper?.title || slug()}" (id bp:${slug()}): `); };
    const open = el(`<button title="Open in Barkpark">${iconHtml('external-link')}</button>`);
    open.onclick = () => { if (connectionChanged()) return toast('Restore this Paper’s original connection before opening it in Barkpark.', 'error'); const server = state.settings?.barkpark?.effectiveServer || state.settings?.barkpark?.server; if (!server) { toast('No server address is available.', 'error'); return; } api.app.openExternal(`${server.replace(/\/$/, '')}/papers/${slug()}`); };
    const copy = el(`<button title="Import a local copy">${iconHtml('download')}</button>`);
    copy.onclick = async () => { try { const local = await ctx.importPaper(slug(), paper?.binding); toast('Imported as ' + local.title); ctx.openLinked(tab, local.id, 'local', true); } catch (error) { toast(error.message, 'error'); } };
    const reload = el(`<button title="Reload from server">${iconHtml('rotate-cw')}</button>`);
    reload.onclick = () => load();
    actions.append(ask, open, copy, reload);
    bar.appendChild(actions);
  }

  async function renderLinks() {
    const host = q('#links');
    const id = slug(), generation = loadGeneration;
    let backlinks = [];
    let history = [];
    try { backlinks = await api.barkpark.backlinks(id, paper?.binding); } catch {}
    try { history = await api.barkpark.history(id, paper?.binding); } catch {}
    if (destroyed || generation !== loadGeneration || id !== slug()) return;
    host.innerHTML = [
      backlinks.length ? `<h3>Backlinks</h3>${backlinks.map(d => `<button data-open="${esc(d.id)}">${iconHtml('file-text')}<span>${esc(d.title)}</span><small>links here</small></button>`).join('')}` : '',
      history.length ? `<h3>History</h3>${history.slice(0, 8).map(r => `<div class="bw-rev"><span>rev ${esc(String(r.rev).slice(0, 8))}</span><span>${esc(r.summary || '')}</span><span>${esc(r.actor || '')} · ${esc(relativeTime(r.at))}</span></div>`).join('')}` : '',
    ].join('');
    host.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => { if (connectionChanged()) return toast('Restore this Paper’s original connection before following its links.', 'error'); ctx.openLinked(tab, b.dataset.open, 'barkpark'); }; });
  }

  function renderProposals() {
    const host = q('#proposals');
    host.innerHTML = '';
    for (const p of paper?.proposals || []) {
      const node = el(`<div class="bw-proposal" data-id="${esc(p.id)}"><small>Proposed by the assistant · ${esc(p.mode)} · ${esc(relativeTime(p.createdAt))}</small><div class="bw-proposal-head"><strong>${esc(p.summary || 'Change')}</strong><span><button class="primary" data-act="keep" ${writesOn() && !p.ownershipUnavailable ? '' : 'disabled'}>Keep</button><button data-act="discard" ${connectionChanged() || p.ownershipUnavailable ? 'disabled' : ''}>Discard</button></span></div>${p.ownershipUnavailable ? `<p>${esc(p.ownershipUnavailable)}</p>` : ''}<details><summary>Show the change</summary><div class="body">${inlineMarkdownHtml(p.markdown || '')}</div></details></div>`);
      node.querySelector('[data-act="keep"]').onclick = () => resolveProposal(p.id, true);
      node.querySelector('[data-act="discard"]').onclick = () => resolveProposal(p.id, false);
      host.appendChild(node);
    }
  }

  async function resolveProposal(id, accept) {
    try {
      if (accept && canvas) canvas.flushPendingChanges();
      const result = await api.docs.resolvePaperProposal(slug(), id, accept, rev, paper?.binding);
      if (result.conflict) { toast('The paper changed on the server; reloading before applying.', 'error'); await load(); return; }
      toast(accept ? 'Change applied on Barkpark' : 'Proposal discarded');
      await load();
      ctx.libraryChanged();
    } catch (error) { toast(error.message, 'error'); }
  }

  function showConflict(server) {
    const box = q('#conflict');
    box.innerHTML = '';
    const node = el(`<div class="bw-conflict"><strong>Someone else changed this paper</strong> (server is at rev ${esc(server.rev)}, you were editing rev ${esc(rev)}). Your unsaved edits are still on screen.<div><button data-act="theirs">Load the server version</button><button data-act="mine">Re-apply my edit on top</button></div></div>`);
    node.querySelector('[data-act="theirs"]').onclick = () => { paper = server; rev = server.rev; lastAcked = server.blocks || []; canvas?.resolveConflictWithServerBlocks(server.blocks || []); pendingRetry = null; mergeAfterSave = false; box.innerHTML = ''; setSaveState('Loaded rev ' + rev); renderMeta(); };
    node.querySelector('[data-act="mine"]').onclick = async () => { box.innerHTML = ''; if (pendingRetry) { const { ops, seq } = pendingRetry; pendingRetry = null; rev = server.rev; mergeAfterSave = true; await applyOps(ops, seq); } };
    box.appendChild(node);
  }

  async function applyOps(ops, seq) {
    if (!ops?.length) return;
    const id = slug(), editor = canvas, generation = loadGeneration;
    const current = () => !destroyed && generation === loadGeneration && editor === canvas && id === slug();
    saving++;
    setSaveState('Saving…', 'saving');
    try {
      const baseline = canvas?.blocks || lastAcked;
      const shaped = normaliseOps(ops, baseline);
      let result;
      try {
        result = await api.barkpark.applyOps(id, shaped.ops, rev, paper?.binding);
      } catch (error) {
        // Older servers reject move-block; re-express the reorder as remove + re-insert and try once more.
        const alt = /known DocPatchOp/.test(error.message) && shaped.ops.some(o => o.op === 'move-block') ? reinsertMoves(shaped.ops, baseline) : null;
        if (!alt) throw error;
        result = await api.barkpark.applyOps(id, alt, rev, paper?.binding);
      }
      if (!current()) return;
      rev = result.rev ?? rev;
      canvas.acknowledgeOps(seq, true);
      // "Saved" only when nothing newer is queued: acknowledging may flush the next batch at once, and an edit made
      // during this request is still debouncing in the canvas. Either way the paper is not saved yet.
      if (seq === latestSeq && !canvas.hasPendingChanges?.()) setSaveState('Saved · rev ' + rev, 'saved');
      if (pendingRetry?.seq !== seq) { pendingRetry = null; q('#conflict').innerHTML = ''; }
      renderMeta();
      // Echo: minted ids for new blocks come back on the paper itself.
      try {
        const echoRev = rev;
        const fresh = await api.barkpark.get(id, paper?.binding, tab.paperOwner || null);
        // An older echo may arrive after the next acknowledged batch. Never roll its baseline back.
        if (current() && echoRev === rev && seq === latestSeq && fresh?.blocks) {
          lastAcked = fresh.blocks;
          paper = { ...paper, ...fresh, proposals: paper.proposals };
          // After a conflict re-apply the server holds another writer's blocks too; with nothing pending locally, take the server truth.
          if (mergeAfterSave && !canvas.hasPendingChanges()) canvas.resolveConflictWithServerBlocks(fresh.blocks);
          else canvas.applyServerBlocks(fresh.blocks);
          mergeAfterSave = false;
          renderMeta();
          if (paper.title && tab.title !== paper.title) { tab.title = paper.title; q('#title').value = paper.title; ctx.tabChanged(tab); ctx.libraryChanged(); }
          syncTitleRow();
        }
      } catch {}
      if (current()) ctx.documentChanged({ id: 'bp:' + id, title: paper.title });
    } catch (error) {
      if (!current()) return;
      const code = errorCode(error);
      if (code === 'precondition_failed' || error.status === 412) {
        let server = null;
        try { server = await api.barkpark.get(id, paper?.binding, tab.paperOwner || null); } catch {}
        if (!current()) return;
        pendingRetry = { ops, seq };
        setSaveState('Conflict', 'error');
        if (server) showConflict(server); else toast('Conflict, and the server copy could not be fetched.', 'error');
      } else if (code === 'writes_disabled') {
        setSaveState('Read-only', 'error');
        toast(errorMessage(error), 'error');
        renderBanner();
      } else {
        setSaveState('Not saved', 'error');
        pendingRetry = { ops, seq, connectionChanged: code === 'paper_connection_changed' };
        // Tell the canvas the batch was refused, or every later edit stays queued behind it. It keeps the author's
        // state and, on the next edit, diffs against the last saved blocks, so the refused change rides along —
        // a vetoed batch (say, one that would empty the paper) then saves as soon as the author writes again.
        const discarded = canvas.discardInflightOps?.(seq) === true;
        const box = q('#conflict');
        box.innerHTML = '';
        const message = /known DocPatchOp/.test(error.message) && ops.some(o => o.op === 'move-block') ? 'Moving blocks needs the newer Barkpark server (move-block landed on main; this server predates it). Your edit is still on screen.' : errorMessage(error);
        const node = el(`<div class="bw-conflict"><strong>Could not save:</strong> ${esc(message)} <button data-act="retry">Retry</button><button data-act="discard">Discard unsaved edits</button></div>`);
        // After a discard the canvas re-diffs on Retry (resending the old ops would land an insert twice); an older
        // canvas without the seam keeps the batch in flight and Retry resends it as before.
        node.querySelector('[data-act="retry"]').onclick = async () => { box.innerHTML = ''; const p = pendingRetry; pendingRetry = null; if (discarded) { setSaveState('Saving…', 'saving'); if (!canvas.resendPendingOps?.()) setSaveState('Saved · rev ' + rev, 'saved'); } else if (p) await applyOps(p.ops, p.seq); };
        node.querySelector('[data-act="discard"]').onclick = async () => {
          if (saving || !await askConfirm('Discard the unsaved edits and load the saved paper? This cannot be undone.', { title: 'Discard unsaved edits?', confirm: 'Discard edits' })) return;
          if (!current() || saving) return;
          // Fetch before discarding; an offline read must leave the draft and Retry available.
          const expected = latestSeq, expectedInput = inputVersion;
          try {
            const fresh = await api.barkpark.get(id, paper?.binding, tab.paperOwner || null);
            if (!current() || saving || latestSeq !== expected || inputVersion !== expectedInput) return;
            editor.resolveConflictWithServerBlocks(fresh.blocks || []);
            paper = fresh; rev = fresh.rev; lastAcked = fresh.blocks || []; pendingRetry = null;
            box.innerHTML = ''; setSaveState('Loaded rev ' + rev); syncTitleRow(); renderMeta();
          } catch (failure) { toast('Could not load the saved paper: ' + errorMessage(failure), 'error'); }
        };
        box.appendChild(node);
        renderBanner();
      }
    } finally { saving--; }
  }

  function mountCanvas(blocks, editable, current) {
    if (!current()) return;
    const hostEl = q('#canvas-host');
    hostEl.innerHTML = '';
    hostEl.dataset.theme = themeAttr();
    canvas = document.createElement('bp-paper-canvas');
    canvas.setAttribute('editable', editable ? 'true' : 'false');
    canvas.acknowledgedSaves = true;
    canvas.blocks = blocks;
    canvas.wikilinkSource = async query => { try { return (await api.barkpark.search(query, paper?.binding)).slice(0, 8).map(d => ({ title: d.title, id: d.id, type: 'paper' })); } catch { return []; } };
    canvas.tagSource = async () => [];
    // The link hover card: a wikilink's title and first line come from the connected Barkpark; Open
    // goes to a paper tab for a wikilink and to the system browser for an address (plan #23).
    canvas.linkPreviewSource = async info => {
      if (info?.kind !== 'wikilink') return null;
      const id = info.docId || info.target;
      if (!id) return null;
      try {
        const p = await api.barkpark.get(id, paper?.binding, tab.paperOwner || null);
        // The first line is the first paragraph, not the title again; the summary's excerpt is the fallback.
        const inline = nodes => (Array.isArray(nodes) ? nodes : []).map(n => typeof n === 'string' ? n : (n?.value ?? n?.text ?? inline(n?.children || n?.content))).join('');
        const first = (p.blocks || []).find(b => b?.type === 'paragraph');
        const firstLine = first ? inline(first.content || (first.text ? [first.text] : [])).trim() : '';
        return { title: p.title, excerpt: firstLine || p.excerpt || p.description || '', href: 'bp:' + (p.slug || p.id) };
      } catch { return null; }
    };
    canvas.addEventListener('bp-canvas-open-link', event => {
      const d = event.detail || {};
      event.preventDefault();
      if (d.kind === 'wikilink') { if (connectionChanged()) return toast('Restore this Paper’s original connection before following its links.', 'error'); const id = d.docId || d.target; if (id) ctx.openLinked(tab, id, 'barkpark'); return; }
      if (/^https?:/.test(d.href || '')) api.app.openExternal(d.href);
    });
    // A pasted or dropped picture uploads to the connected Barkpark's media; the node shows the outcome.
    canvas.mediaUploader = async file => {
      if (!writesOn()) throw new Error(writeUnavailable());
      const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      return api.barkpark.uploadMedia({ binding: paper?.binding, name: file.name, mime: file.type, dataUrl });
    };
    canvas.addEventListener('bp-canvas-ops', event => {
      const { ops, seq } = event.detail || {};
      if (!Array.isArray(ops) || !ops.length) return;
      inputVersion++;
      latestSeq = seq;
      ctx.userIsEditing();
      syncTitleRow();
      applyOps(ops, seq);
    });
    canvas.addEventListener('keyup', () => syncTitleRow());
    canvas.addEventListener('beforeinput', () => { inputVersion++; });
    canvas.addEventListener('focusin', () => ctx.userIsEditing());
    hostEl.appendChild(canvas);
  }

  let loadFailed = false;
  async function load() {
    if (hasUnsavedWork()) {
      tab.path = [...mountedPath]; tab.source = mountedSource;
      ctx.tabChanged(tab);
      toast('Finish saving this paper before reloading or opening another paper.', 'error');
      return false;
    }
    cancelPositionRestore();
    const generation = ++loadGeneration, path = [...tab.path], source = tab.source, id = path.at(-1);
    const restorePosition = tab.scroll || 0, restoreIntent = positionIntent;
    const beforeInput = inputVersion, beforeRev = rev;
    const current = () => !destroyed && generation === loadGeneration;
    loadFailed = false;
    q('#conflict').innerHTML = '';
    setSaveState('');
    let fetched;
    try { fetched = await api.barkpark.get(id, paper?.binding, tab.paperOwner || null); } catch (error) {
      if (current()) {
        loadFailed = true;
        if (canvas) { tab.path = [...mountedPath]; tab.source = mountedSource; ctx.tabChanged(tab); toast('Could not open ' + id + ': ' + errorMessage(error), 'error'); }
        else { q('#title').value = tab.title || id; q('#title').disabled = true; q('#canvas-host').innerHTML = `<p class="bw-error">Could not open ${esc(id)}: ${esc(errorMessage(error))}</p>`; }
      }
      return;
    }
    if (!current() || !fetched) return;
    try { fetched.proposals = await api.docs.paperProposals(id, fetched.binding); } catch { fetched.proposals = []; }
    // Resolve every asynchronous prerequisite before changing the mounted document identity.
    try { await ensureCanvasBundle(); } catch (e) { if (current()) setSaveState('Editor bundle failed to load: ' + (e?.message || e), 'error'); return; }
    if (!current()) return;
    // The old editor remains usable while the read is pending; a new human edit wins over the load.
    if (hasUnsavedWork() || inputVersion !== beforeInput || rev !== beforeRev) { tab.path = [...mountedPath]; tab.source = mountedSource; ctx.tabChanged(tab); return false; }
    paper = fetched; mountedPath = path; mountedSource = source;
    rev = paper.rev;
    lastAcked = paper.blocks || [];
    tab.title = paper.title;
    ctx.tabChanged(tab);
    q('#title').value = paper.title;
    q('#title').disabled = !writesOn();
    q('#title').oninput = () => {
      const field = q('#title');
      // Retain the old single-line title contract while allowing visual wrapping.
      if (/[\r\n]/.test(field.value)) { const caret = field.value.slice(0, field.selectionStart).replace(/[\r\n]/g, '').length; field.value = field.value.replace(/[\r\n]/g, ''); field.setSelectionRange(caret, caret); }
      inputVersion++; titleDirty = field.value.trim() !== paper.title;
    };
    q('#title').onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); q('#title').blur(); } };
    q('#title').onchange = async () => {
      if (titleSaving) return;
      const title = q('#title').value.trim() || paper.title;
      if (title === paper.title) { q('#title').value = paper.title; titleDirty = false; return; }
      inputVersion++;
      const ownerCanvas = canvas, ownsTitle = () => !destroyed && slug() === id && canvas === ownerCanvas;
      let succeeded = false; titleDirty = true; titleSaving = true; saving++;
      try { await api.barkpark.patchTitle(id, title, paper?.binding); if (!ownsTitle()) return; succeeded = true; paper.title = title; tab.title = title; titleDirty = q('#title').value.trim() !== title; q('#title-error')?.remove(); ctx.tabChanged(tab); ctx.libraryChanged(); toast('Title saved'); }
      catch (error) { if (ownsTitle()) {
        q('#title-error')?.remove();
        const message = el(`<div class="bw-conflict" id="title-error"><strong>Title not saved:</strong> ${esc(errorMessage(error))} <button data-act="retry-title">Retry</button><button data-act="discard-title">Discard title edit</button></div>`);
        message.querySelector('[data-act="retry-title"]').onclick = () => q('#title').onchange();
        message.querySelector('[data-act="discard-title"]').onclick = () => { if (titleSaving) return; q('#title').value = paper.title; titleDirty = false; message.remove(); };
        q('#title').after(message);
      } }
      finally { saving--; titleSaving = false; if (succeeded && ownsTitle() && titleDirty) q('#title').onchange(); }
    };
    const editable = writesOn() && Boolean(paper.blocks);
    const blocks = paper.blocks || (paper.html ? htmlToBlocks(paper.html) : []);
    positionReady = positionIntent !== restoreIntent;
    mountCanvas(blocks, editable, current);
    if (!current()) return;
    syncTitleRow();
    requestAnimationFrame(() => { if (!destroyed) syncTitleRow(); });
    q('#state').textContent = editable
      ? 'Edits go straight to Barkpark through the fenced ops endpoint. Each batch is saved with the paper\'s revision; a clash with another writer shows up here instead of overwriting.'
      : paper.blocks ? 'Read-only view of the Barkpark paper. Enable live editing above to edit in place.' : 'Preview converted from the paper\'s HTML body.';
    renderMeta(); renderBanner(); renderPath(); renderProposals();
    const linksReady = renderLinks();
    if (refreshAgain) { refreshAgain = false; void controller.refresh(); }
    if (positionIntent === restoreIntent) scroller.scrollTop = restorePosition;
    else return;
    // The editor and image dimensions can arrive after its custom element mounts.
    // Keep the saved value authoritative until that initial layout is usable.
    void (async () => {
      const cancelled = new Promise(resolve => { cancelPositionRestore = () => resolve(false); });
        const ready = (async () => {
          await new Promise(resolve => requestAnimationFrame(resolve));
          if (!current()) return;
          await Promise.all([linksReady, ...[...canvas.querySelectorAll('img')].map(image => {
            // Offscreen lazy media must not delay the visible editor.
            if (image.complete || image.loading === 'lazy' || !image.decode) return;
            return image.decode().catch(() => {});
          })]);
          await new Promise(resolve => requestAnimationFrame(resolve));
          return true;
        })();
        const settled = await Promise.race([ready, cancelled]);
        if (!current() || positionIntent !== restoreIntent) return;
        // This task never blocks load. Slow successful media can still restore
        // the saved position; any human engagement cancels that late movement.
        if (!settled) return;
        scroller.scrollTop = restorePosition;
        positionReady = true;
    })();
  }

  const offLocal = api.barkpark.onLocalStatus(status => {
    if (status.phase !== 'ready' || destroyed) return;
    // Never reload over an unsaved edit or replay a write with uncertain acknowledgement.
    if (loadFailed) load(); else if (canvas && !saving && !pendingRetry && !canvas.hasPendingChanges?.()) controller.refresh();
  });
  load();

  const controller = {
    el: pane, type: 'doc', tab,
    async renameTitle(title) {
      if (destroyed || !paper || !canvas) throw new Error('Wait for this Paper to open before renaming it.');
      if (hasUnsavedWork()) throw new Error('Finish saving your Paper edits before renaming the tab.');
      // Use the same captured owner, pending-write guard and retained failure
      // draft as the document title field. Never obtain a fresh ambient binding.
      const field = q('#title');
      field.value = title;
      await field.onchange();
      if (titleDirty || paper.title !== title) throw new Error('Title was not saved. Your title edit remains in the Paper for retry or discard.');
      return paper.title;
    },
    connectionChanged() { renderBanner(); renderMeta(); renderProposals(); },
    canClose() { if (!hasUnsavedWork()) return true; canvas?.flushPendingChanges?.(); toast('Finish saving this paper before closing it. If saving failed, retry or discard the unsaved edits.', 'error'); return false; },
    async refresh(changedId) {
      if (changedId && changedId !== 'bp:' + slug() && changedId !== slug()) return;
      // A read tool may open this pane and finish its edit before the first
      // bundle/load mounts. Replay that notification once there is a canvas;
      // absence during loading is not an older editor capability failure.
      if (!canvas) { refreshAgain = true; return; }
      if (refreshing) { refreshAgain = true; return; }
      if (hasUnsavedWork()) return;
      refreshing = true;
      const id = slug(), beforeRev = rev, generation = loadGeneration;
      try {
        const fresh = await fetchPaper();
        if (destroyed || !fresh || id !== slug()) return;
        const proposals = await api.docs.paperProposals(id, paper?.binding).catch(() => []);
        const edit = await api.docs.agentEdit('bp:' + id, paper?.binding);
        const allowed = () => !destroyed && generation === loadGeneration && slug() === id && rev === beforeRev && !hasUnsavedWork();
        const apply = () => {
          if (fresh.rev !== rev && canvas) {
            // A focused canvas may queue applyServerBlocks while retaining its
            // old baseline. Never stamp that old content with a newer revision.
            if (!canvas.applyServerBlocksIfIdle?.(fresh.blocks || [])) return false;
            rev = fresh.rev; lastAcked = fresh.blocks || []; setSaveState('Saved · rev ' + rev, 'saved');
          }
          paper = { ...fresh, proposals }; syncTitleRow(); return true;
        };
        // Older bundles have no synchronous acceptance contract. Keep their
        // revision pinned so subsequent input remains protected by server 412.
        if (fresh.rev !== rev && !canvas?.applyServerBlocksIfIdle) {
          if (allowed()) setSaveState('Update available · reload');
          return;
        }
        if (edit && !edit.undoUnavailable && !edit.undone && edit.beforeRev === beforeRev && edit.afterRev === fresh.rev) await presence.run(edit, apply, allowed);
        else if (allowed()) apply();
        renderProposals(); renderMeta(); renderLinks(); renderPath();
      } catch (error) { console.warn('Paper refresh:', error); }
      finally { refreshing = false; if (refreshAgain) { refreshAgain = false; controller.refresh(); } }
    },
    navigate() { presence.stop(); return load(); },
    savePosition() { if (positionReady && !destroyed) tab.scroll = scroller.scrollTop; },
    focus() { canvas?.querySelector('.ProseMirror')?.focus(); },
    isDirty: hasUnsavedWork,
    flush: () => canvas?.flushPendingChanges?.(),
    markdown: () => blocksToMarkdown(canvas?.blocks || paper?.blocks || []),
    destroy() { offLocal(); destroyed = true; cancelPositionRestore(); for (const event of positionEvents) scroller.removeEventListener(event, takePosition); presence.destroy(); try { canvas?.flushPendingChanges?.(); } catch {} pane.remove(); },
  };
  return controller;
}
