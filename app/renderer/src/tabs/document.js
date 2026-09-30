import { agentPresence } from '../agent-presence.js';
// Legacy document work tab, read-only since the legacy retirement (R4): a retained original, a
// note of a profile that has not switched, or a read-only copy of a Paper, rendered from its
// blocks with proposals, revisions, references and a linked-document path that opens to the
// right. Nothing here writes the legacy store; notes live on Paper.
import { el, esc, iconHtml, relativeTime, toast } from '../ui.js';
import { docToHtml } from '../../../shared/doc-html.js';

const api = window.barkdown;

export function mountDocument(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-doc-pane"><div class="bw-path" id="path"></div><div class="bw-docpanes"><div class="bw-source-pane" id="source"></div><div class="bw-current-pane" id="current"><div class="bw-document"><div class="bw-kicker"><span id="kicker">Barkdown / Library</span><span class="bw-save-state" id="save-state"></span></div><input class="bw-doc-title" id="title" aria-label="Document title" placeholder="Untitled" disabled><div class="bw-doc-meta" id="meta"></div><div id="agent-edit"></div><div id="proposals"></div><div id="conflict"></div><div id="editor"></div><div class="bw-doc-links" id="links"></div><div class="bw-doc-state" id="state"></div></div></div></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  const presence = agentPresence(pane, () => q('.ProseMirror'), q('#current'));
  let refreshing = false, refreshAgain = false;
  let doc = null;
  let destroyed = false;

  const docId = () => tab.path.at(-1);

  async function fetchDoc(id) {
    if (tab.source === 'barkpark') throw new Error('This Paper must be opened in its original Paper editor.');
    return api.docs.get(id);
  }

  // The document's blocks rendered once; links open the way they always did.
  function show(content) {
    const hostNode = q('#editor'); hostNode.innerHTML = `<div class="ProseMirror bw-readonly-doc" tabindex="0">${docToHtml(content)}</div>`;
    hostNode.querySelector('.bw-readonly-doc').onclick = event => {
      const anchor = event.target.closest('a[href]'); if (!anchor) return;
      event.preventDefault(); const href = anchor.getAttribute('href') || '';
      const m = /^barkdown:\/\/doc\/([\w-]+)/.exec(href);
      if (m) ctx.openLinked(tab, m[1], 'local'); else if (/^https?:/.test(href)) ctx.openWebsite(href);
    };
  }

  function renderMeta() {
    if (!doc) return;
    const crumbs = ctx.pagePath ? ctx.pagePath(doc.id, doc.source) : [];
    q('#kicker').textContent = crumbs.length > 1 ? crumbs.join(' / ') : (doc.source === 'barkpark' ? 'Barkpark / Paper' : 'Pages');
    q('#meta').textContent = `${doc.retained ? 'Retained original · read-only · this profile’s notes live on Paper · ' : doc.source === 'barkpark' ? 'Read-only copy · ' : 'Legacy note · read-only · '}rev ${doc.rev ?? '–'} · updated ${relativeTime(doc.updatedAt)} · ${(doc.references || []).length} reference(s) · ${(doc.backlinks || []).length} backlink(s)`;
  }

  // Proposals the assistant left on a legacy note are shown as they were; nothing resolves them any more.
  function renderProposals() {
    const host = q('#proposals');
    host.innerHTML = '';
    for (const p of doc?.proposals || []) {
      host.appendChild(el(`<div class="bw-proposal" data-id="${esc(p.id)}"><small>${esc(p.actor === 'agent' ? 'Proposed by the assistant' : 'Proposal')} · ${esc(p.mode)}${p.mode === 'replace_block' ? ' #' + esc(String(p.blockIndex)) : ''} · kept for reading</small><pre>${esc(p.markdown || '')}</pre></div>`));
    }
  }

  async function renderLinks() {
    const host = q('#links');
    if (!doc) return;
    const references = (doc.references || []).map(id => ctx.documentSummary(id)).filter(Boolean);
    let related = [];
    let history = [];
    try { related = doc.source === 'barkpark' ? await api.barkpark.related(doc.id).catch(() => []) : await api.docs.related(doc.id); } catch {}
    try { history = doc.source === 'barkpark' ? await api.barkpark.history(doc.id).catch(() => []) : await api.docs.history(doc.id); } catch {}
    if (destroyed) return;
    const row = (d, hint) => `<button data-open="${esc(d.id)}" data-source="${esc(d.source || 'local')}">${iconHtml('file-text')}<span>${esc(d.title)}</span><small>${esc(hint || '')}</small></button>`;
    host.innerHTML = [
      references.length ? `<h3>References</h3>${references.map(d => row(d, 'linked from here')).join('')}` : '',
      (doc.backlinks || []).length ? `<h3>Backlinks</h3>${doc.backlinks.map(d => row(d, 'links here')).join('')}` : '',
      related.length ? `<h3>Related</h3>${related.map(d => row(d, (d.reasons || []).join(' · '))).join('')}` : '',
      history.length ? `<h3>History</h3>${history.slice(0, 8).map(r => `<div class="bw-rev"><span>rev ${esc(r.rev)}</span><span>${esc(r.summary || '')}</span><span>${esc(r.actor || '')} · ${esc(relativeTime(r.at || r.updatedAt))}</span></div>`).join('')}` : '',
      !references.length && !(doc.backlinks || []).length && !related.length ? '<h3>Linked documents</h3><p class="bw-small bw-muted">Documents this note links to, and notes linking here, appear in this list.</p>' : '',
    ].join('');
    host.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => ctx.openLinked(tab, b.dataset.open, b.dataset.source); });
  }

  function renderPath() {
    const bar = q('#path');
    bar.innerHTML = '';
    if (tab.path.length > 1) {
      tab.path.forEach((id, i) => {
        const summary = ctx.documentSummary(id, tab.source);
        const b = el(`<button data-i="${i}">${esc(summary?.title || id)}</button>`);
        b.onclick = () => { if (i < tab.path.length - 1) { tab.path = tab.path.slice(0, i + 1); ctx.tabChanged(tab); load(); } };
        bar.appendChild(b);
        if (i < tab.path.length - 1) bar.appendChild(document.createTextNode(' / '));
      });
    } else {
      bar.appendChild(el(`<span class="bw-muted">${esc(doc?.source === 'barkpark' ? 'Barkpark paper' : doc?.retained ? 'Retained original' : 'Legacy note')}</span>`));
    }
    const actions = el('<div class="bw-doc-actions"></div>');
    if (doc?.source === 'barkpark') {
      const importBtn = el(`<button title="Copy into the local library">${iconHtml('download')} Import</button>`);
      importBtn.onclick = async () => { try { const local = await api.barkpark.import(doc.id); toast('Imported as ' + local.title); ctx.libraryChanged(); ctx.openLinked(tab, local.id, 'local', true); } catch (error) { toast(error.message, 'error'); } };
      actions.appendChild(importBtn);
    } else if (doc) {
      const ask = el(`<button title="Ask the assistant about this document">${iconHtml('sparkles')} Ask</button>`);
      ask.onclick = () => ctx.askAbout(`About the document "${doc.title}" (id ${doc.id}): `);
      const exportBtn = el(`<button title="Export as Markdown">${iconHtml('download')}</button>`);
      exportBtn.onclick = async () => { const p = await api.docs.exportMarkdown(doc.id); if (p) toast('Exported to ' + p); };
      actions.append(ask, exportBtn);
    }
    bar.appendChild(actions);
  }

  async function renderSource() {
    const pane = q('#source');
    pane.innerHTML = '';
    pane.hidden = tab.path.length < 2;
    if (tab.path.length < 2) return;
    try {
      const source = await fetchDoc(tab.path.at(-2));
      if (destroyed) return;
      pane.hidden = false;
      pane.innerHTML = `<div class="bw-kicker">Source document</div><h2>${esc(source.title)}</h2><div id="source-body"></div>`;
      pane.querySelector('#source-body').innerHTML = `<div class="ProseMirror bw-readonly-doc">${docToHtml(source.content)}</div>`;
    } catch { pane.innerHTML = ''; }
  }

  async function load() {
    const id = docId();
    q('#save-state').textContent = '';
    q('#conflict').innerHTML = '';
    try { doc = await fetchDoc(id); } catch (error) { q('#editor').innerHTML = `<p class="bw-error">Could not open ${esc(id)}: ${esc(error.message)}</p>`; return; }
    if (destroyed || !doc) { if (!doc) q('#editor').innerHTML = `<p class="bw-error">Document ${esc(id)} no longer exists.</p>`; return; }
    tab.title = doc.title;
    ctx.tabChanged(tab);
    q('#title').value = doc.title;
    show(doc.content);
    q('#state').textContent = doc.retained ? 'Retained original. This profile’s notes moved to Paper when the library was switched; this legacy copy stays readable and is never edited.'
      : doc.source === 'barkpark' ? 'This paper is read from Barkpark. Import it to keep a local copy.'
      : 'Legacy note, read-only. Notes live on Paper now: switch this library to Paper in Settings › Barkpark to edit it there.';
    renderMeta(); renderProposals(); renderPath(); renderLinks(); renderSource();
    q('#current').scrollTop = tab.scroll || 0;
  }

  load();

  const controller = {
    el: pane,
    type: 'doc',
    tab,
    async refresh(changedId) {
      if (!doc || changedId && changedId !== doc.id) return;
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      const id = doc.id, beforeRev = doc.rev;
      try {
        const fresh = await fetchDoc(id);
        if (destroyed || !fresh || doc.id !== id) return;
        doc = fresh; if (fresh.rev !== beforeRev) show(doc.content); q('#title').value = doc.title;
        renderProposals(); renderMeta(); renderLinks(); renderPath(); tab.title = doc.title; ctx.tabChanged(tab);
      } catch (error) { console.warn('Document refresh:', error); }
      finally { refreshing = false; if (refreshAgain) { refreshAgain = false; controller.refresh(); } }
    },
    navigate() { presence.stop(); load(); },
    savePosition() { tab.scroll = q('#current').scrollTop; },
    focus() { q('.bw-readonly-doc')?.focus(); },
    isDirty: () => false,
    flush: () => {},
    destroy() { destroyed = true; presence.destroy(); pane.remove(); },
  };
  return controller;
}
