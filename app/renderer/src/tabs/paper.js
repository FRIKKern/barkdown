// Barkpark paper work tab: hosts Barkpark's own <bp-paper-canvas> (vendored bundle) over a real paper.
// Edits leave the canvas as bp-canvas-ops batches; each batch is applied through the fenced ops endpoint
// with the paper's revision, acknowledged on success, and the server echo is fed back so minted ids land.
import { el, esc, iconHtml, relativeTime, toast, errorCode, errorMessage, inlineMarkdownHtml } from '../ui.js';
import { state } from '../state.js';
import { askConfirm } from '../dialogs.js';
import { htmlToBlocks, blocksToMarkdown } from '../../../shared/portabledoc.js';
import { normaliseOps, reinsertMoves } from '../../../shared/ops.js';

const api = window.barkdown;

export function mountPaper(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-doc-pane bw-paper-pane"><div class="bw-path" id="path"></div><div class="bw-current-pane" id="current"><div class="bw-document bw-paper-document"><div class="bw-kicker"><span id="kicker">Barkpark / Paper</span><span class="bw-doc-meta" id="meta"></span><span class="bw-save-state" id="save-state"></span></div><input class="bw-doc-title" id="title" aria-label="Paper title" placeholder="Untitled"><div id="banner"></div><div id="proposals"></div><div id="conflict"></div><div class="bp-paper-host" id="canvas-host"></div><div class="bw-doc-links" id="links"></div><div class="bw-doc-state" id="state"></div></div></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  let paper = null;
  let canvas = null;
  let rev = null;
  let lastAcked = [];
  let destroyed = false;
  let saving = false;
  let pendingRetry = null;
  let latestSeq = null;
  let mergeAfterSave = false;
  const slug = () => tab.path.at(-1);
  const writesOn = () => Boolean(state.settings?.barkpark?.writes);

  function setSaveState(text, kind = '') { q('#save-state').textContent = text; q('#save-state').dataset.kind = kind; }
  function themeAttr() { const t = document.documentElement.dataset.theme; return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }

  async function fetchPaper() { return api.barkpark.get(slug()); }

  function renderMeta() {
    if (!paper) return;
    const crumbs = ctx.pagePath ? ctx.pagePath(slug(), 'barkpark') : [];
    q('#kicker').textContent = crumbs.length > 1 ? crumbs.join(' / ') : '';
    q('#meta').textContent = `${writesOn() ? 'Editing live' : 'Read-only'} · edited ${relativeTime(paper.updatedAt)}${paper.draft ? ' · draft' : ''}${paper.blocks ? '' : ' · HTML body'}`;
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
    if (!writesOn()) {
      const node = el(`<div class="bw-conflict"><strong>Read-only.</strong> Barkpark writes are off, so edits stay in this window. <button data-act="enable">Enable live editing</button></div>`);
      node.querySelector('[data-act="enable"]').onclick = async () => { try { state.settings = await api.settings.set({ barkpark: { writes: true } }); toast('Live editing enabled for Barkpark papers'); load(); } catch (error) { toast(error.message, 'error'); } };
      banner.appendChild(node);
    } else if (paper && !paper.blocks && paper.html) {
      const node = el(`<div class="bw-conflict"><strong>This paper is stored as HTML.</strong> Converting it to blocks makes it editable here; the conversion keeps headings, paragraphs, lists, quotes and code and drops other markup. <button data-act="convert">Convert to blocks</button></div>`);
      node.querySelector('[data-act="convert"]').onclick = async () => {
        if (!await askConfirm(`Convert "${paper.title}" to PortableDoc blocks on the server? This replaces its HTML body.`, { title: 'Convert to blocks?', confirm: 'Convert' })) return;
        try { await api.barkpark.publish({ slug: slug(), title: paper.title, blocks: htmlToBlocks(paper.html), description: paper.description || undefined }); toast('Converted to blocks'); load(); } catch (error) { toast('Could not convert: ' + error.message, 'error'); }
      };
      banner.appendChild(node);
    }
  }

  function renderPath() {
    const bar = q('#path');
    bar.innerHTML = `<span class="bw-muted">Barkpark paper · ${esc(slug())}</span>`;
    const actions = el('<div class="bw-doc-actions"></div>');
    const ask = el(`<button title="Ask the assistant about this paper">${iconHtml('sparkles')} Ask</button>`);
    ask.onclick = () => ctx.askAbout(`About the Barkpark paper "${paper?.title || slug()}" (id bp:${slug()}): `);
    const open = el(`<button title="Open in Barkpark">${iconHtml('external-link')}</button>`);
    open.onclick = () => { const server = state.settings?.barkpark?.server || 'https://gyldendal.barkpark.cloud'; api.app.openExternal(`${server.replace(/\/$/, '')}/papers/${slug()}`); };
    const copy = el(`<button title="Import a local copy">${iconHtml('download')}</button>`);
    copy.onclick = async () => { try { const local = await api.barkpark.import(slug()); toast('Imported as ' + local.title); ctx.libraryChanged(); ctx.openLinked(tab, local.id, 'local', true); } catch (error) { toast(error.message, 'error'); } };
    const reload = el(`<button title="Reload from server">${iconHtml('rotate-cw')}</button>`);
    reload.onclick = () => load();
    actions.append(ask, open, copy, reload);
    bar.appendChild(actions);
  }

  async function renderLinks() {
    const host = q('#links');
    let backlinks = [];
    let history = [];
    try { backlinks = await api.barkpark.backlinks(slug()); } catch {}
    try { history = await api.barkpark.history(slug()); } catch {}
    if (destroyed) return;
    host.innerHTML = [
      backlinks.length ? `<h3>Backlinks</h3>${backlinks.map(d => `<button data-open="${esc(d.id)}">${iconHtml('file-text')}<span>${esc(d.title)}</span><small>links here</small></button>`).join('')}` : '',
      history.length ? `<h3>History</h3>${history.slice(0, 8).map(r => `<div class="bw-rev"><span>rev ${esc(String(r.rev).slice(0, 8))}</span><span>${esc(r.summary || '')}</span><span>${esc(r.actor || '')} · ${esc(relativeTime(r.at))}</span></div>`).join('')}` : '',
    ].join('');
    host.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => ctx.openLinked(tab, b.dataset.open, 'barkpark'); });
  }

  function renderProposals() {
    const host = q('#proposals');
    host.innerHTML = '';
    for (const p of paper?.proposals || []) {
      const node = el(`<div class="bw-proposal" data-id="${esc(p.id)}"><small>Proposed by the assistant · ${esc(p.mode)} · ${esc(relativeTime(p.createdAt))}</small><div class="bw-proposal-head"><strong>${esc(p.summary || 'Change')}</strong><span><button class="primary" data-act="keep" ${writesOn() ? '' : 'disabled title="Enable live editing first"'}>Keep</button><button data-act="discard">Discard</button></span></div><details><summary>Show the change</summary><div class="body">${inlineMarkdownHtml(p.markdown || '')}</div></details></div>`);
      node.querySelector('[data-act="keep"]').onclick = () => resolveProposal(p.id, true);
      node.querySelector('[data-act="discard"]').onclick = () => resolveProposal(p.id, false);
      host.appendChild(node);
    }
  }

  async function resolveProposal(id, accept) {
    try {
      if (accept && canvas) canvas.flushPendingChanges();
      const result = await api.docs.resolvePaperProposal(slug(), id, accept, rev);
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
    node.querySelector('[data-act="theirs"]').onclick = () => { paper = server; rev = server.rev; lastAcked = server.blocks || []; canvas?.resolveConflictWithServerBlocks(server.blocks || []); box.innerHTML = ''; setSaveState('Loaded rev ' + rev); renderMeta(); };
    node.querySelector('[data-act="mine"]').onclick = async () => { box.innerHTML = ''; if (pendingRetry) { const { ops, seq } = pendingRetry; pendingRetry = null; rev = server.rev; mergeAfterSave = true; await applyOps(ops, seq); } };
    box.appendChild(node);
  }

  async function applyOps(ops, seq) {
    if (!ops?.length) return;
    saving = true;
    setSaveState('Saving…', 'saving');
    try {
      const baseline = canvas?.blocks || lastAcked;
      const shaped = normaliseOps(ops, baseline);
      let result;
      try {
        result = await api.barkpark.applyOps(slug(), shaped.ops, rev);
      } catch (error) {
        // Older servers reject move-block; re-express the reorder as remove + re-insert and try once more.
        const alt = /known DocPatchOp/.test(error.message) && shaped.ops.some(o => o.op === 'move-block') ? reinsertMoves(shaped.ops, baseline) : null;
        if (!alt) throw error;
        result = await api.barkpark.applyOps(slug(), alt, rev);
      }
      if (destroyed) return;
      rev = result.rev ?? rev;
      canvas.acknowledgeOps(seq, true);
      // "Saved" only when nothing newer is queued: acknowledging may flush the next batch at once, and an edit made
      // during this request is still debouncing in the canvas. Either way the paper is not saved yet.
      if (seq === latestSeq && !canvas.hasPendingChanges?.()) setSaveState('Saved · rev ' + rev, 'saved');
      if (pendingRetry?.seq !== seq) { pendingRetry = null; q('#conflict').innerHTML = ''; }
      renderMeta();
      // Echo: minted ids for new blocks come back on the paper itself.
      try {
        const fresh = await fetchPaper();
        if (!destroyed && fresh?.blocks) {
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
      ctx.documentChanged({ id: 'bp:' + slug(), title: paper.title });
    } catch (error) {
      if (destroyed) return;
      const code = errorCode(error);
      if (code === 'precondition_failed' || error.status === 412) {
        let server = null;
        try { server = await fetchPaper(); } catch {}
        pendingRetry = { ops, seq };
        setSaveState('Conflict', 'error');
        if (server) showConflict(server); else toast('Conflict, and the server copy could not be fetched.', 'error');
      } else if (code === 'writes_disabled') {
        setSaveState('Read-only', 'error');
        toast(errorMessage(error), 'error');
        renderBanner();
      } else {
        setSaveState('Not saved', 'error');
        pendingRetry = { ops, seq };
        // Tell the canvas the batch was refused, or every later edit stays queued behind it. It keeps the author's
        // state and, on the next edit, diffs against the last saved blocks, so the refused change rides along —
        // a vetoed batch (say, one that would empty the paper) then saves as soon as the author writes again.
        const discarded = canvas.discardInflightOps?.(seq) === true;
        const box = q('#conflict');
        box.innerHTML = '';
        const message = /known DocPatchOp/.test(error.message) && ops.some(o => o.op === 'move-block') ? 'Moving blocks needs the newer Barkpark server (move-block landed on main; this server predates it). Your edit is still on screen.' : errorMessage(error);
        const node = el(`<div class="bw-conflict"><strong>Could not save:</strong> ${esc(message)} <button data-act="retry">Retry</button></div>`);
        // After a discard the canvas re-diffs on Retry (resending the old ops would land an insert twice); an older
        // canvas without the seam keeps the batch in flight and Retry resends it as before.
        node.querySelector('[data-act="retry"]').onclick = async () => { box.innerHTML = ''; const p = pendingRetry; pendingRetry = null; if (discarded) { setSaveState('Saving…', 'saving'); if (!canvas.resendPendingOps?.()) setSaveState('Saved · rev ' + rev, 'saved'); } else if (p) await applyOps(p.ops, p.seq); };
        box.appendChild(node);
      }
    } finally { saving = false; }
  }

  function mountCanvas(blocks, editable) {
    const hostEl = q('#canvas-host');
    hostEl.innerHTML = '';
    hostEl.dataset.theme = themeAttr();
    canvas = document.createElement('bp-paper-canvas');
    canvas.setAttribute('editable', editable ? 'true' : 'false');
    canvas.acknowledgedSaves = true;
    canvas.blocks = blocks;
    canvas.wikilinkSource = async query => { try { return (await api.barkpark.search(query)).slice(0, 8).map(d => ({ title: d.title, id: d.id, type: 'paper' })); } catch { return []; } };
    canvas.tagSource = async () => [];
    canvas.addEventListener('bp-canvas-ops', event => {
      const { ops, seq } = event.detail || {};
      if (!Array.isArray(ops) || !ops.length) return;
      latestSeq = seq;
      ctx.userIsEditing();
      syncTitleRow();
      applyOps(ops, seq);
    });
    canvas.addEventListener('keyup', () => syncTitleRow());
    canvas.addEventListener('focusin', () => ctx.userIsEditing());
    hostEl.appendChild(canvas);
  }

  async function load() {
    q('#conflict').innerHTML = '';
    setSaveState('');
    try { paper = await fetchPaper(); } catch (error) { q('#canvas-host').innerHTML = `<p class="bw-error">Could not open ${esc(slug())}: ${esc(error.message)}</p>`; return; }
    if (destroyed || !paper) return;
    try { paper.proposals = await api.docs.paperProposals(slug()); } catch { paper.proposals = []; }
    rev = paper.rev;
    lastAcked = paper.blocks || [];
    tab.title = paper.title;
    ctx.tabChanged(tab);
    q('#title').value = paper.title;
    q('#title').disabled = !writesOn();
    q('#title').onchange = async () => { const title = q('#title').value.trim() || paper.title; if (title === paper.title) return; try { await api.barkpark.patchTitle(slug(), title); paper.title = title; tab.title = title; ctx.tabChanged(tab); ctx.libraryChanged(); toast('Title saved'); } catch (error) { toast(error.message, 'error'); q('#title').value = paper.title; } };
    const editable = writesOn() && Boolean(paper.blocks);
    const blocks = paper.blocks || (paper.html ? htmlToBlocks(paper.html) : []);
    mountCanvas(blocks, editable);
    syncTitleRow();
    requestAnimationFrame(() => { if (!destroyed) syncTitleRow(); });
    q('#state').textContent = editable
      ? 'Edits go straight to Barkpark through the fenced ops endpoint. Each batch is saved with the paper\'s revision; a clash with another writer shows up here instead of overwriting.'
      : paper.blocks ? 'Read-only view of the Barkpark paper. Enable live editing above to edit in place.' : 'Preview converted from the paper\'s HTML body.';
    renderMeta(); renderBanner(); renderPath(); renderProposals(); renderLinks();
    q('#current').scrollTop = tab.scroll || 0;
  }

  load();

  return {
    el: pane, type: 'doc', tab,
    async refresh(changedId) {
      if (changedId && changedId !== 'bp:' + slug() && changedId !== slug()) return;
      if (saving || canvas?.hasPendingChanges?.()) return;
      try {
        const fresh = await fetchPaper();
        if (destroyed || !fresh) return;
        const proposals = await api.docs.paperProposals(slug()).catch(() => []);
        const revChanged = fresh.rev !== rev;
        paper = { ...fresh, proposals };
        if (revChanged && canvas) { rev = fresh.rev; lastAcked = fresh.blocks || []; canvas.applyServerBlocks(fresh.blocks || []); }
        renderProposals(); renderMeta(); renderLinks(); renderPath();
      } catch {}
    },
    navigate() { load(); },
    savePosition() { tab.scroll = q('#current').scrollTop; },
    focus() { canvas?.querySelector('.ProseMirror')?.focus(); },
    isDirty: () => Boolean(canvas?.hasPendingChanges?.()),
    flush: () => canvas?.flushPendingChanges?.(),
    markdown: () => blocksToMarkdown(canvas?.blocks || paper?.blocks || []),
    destroy() { destroyed = true; try { canvas?.flushPendingChanges?.(); } catch {} pane.remove(); },
  };
}
