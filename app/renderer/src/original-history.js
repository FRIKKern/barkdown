import { el, esc, iconHtml, errorMessage } from './ui.js';
import { openDialog } from './dialogs.js';
import { libraryScope } from './library-refresh.js';
import { state } from './state.js';

const markTags = new Map(Object.entries({ bold: 'strong', italic: 'em', strike: 's', underline: 'u', code: 'code', highlight: 'mark', subscript: 'sub', superscript: 'sup' }));
const blockTags = new Map(Object.entries({ paragraph: 'p', blockquote: 'blockquote', bulletList: 'ul', orderedList: 'ol', taskList: 'ul', listItem: 'li', table: 'table', tableRow: 'tr', tableCell: 'td', tableHeader: 'th' }));

const date = value => {
  const parsed = new Date(value);
  return value && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'Date not recorded';
};

// Deliberately inert: retained links/images never fetch, navigate or execute. The
// exact record stays available even when a historical node has no preview here.
export function originalContent(node, depth = 0) {
  if (!node || typeof node !== 'object') return '';
  if (depth > 40) return '<p class="bw-history-unsupported">Nested content is available in the original record below.</p>';
  const children = () => (Array.isArray(node.content) ? node.content : []).map(n => originalContent(n, depth + 1)).join('');
  if (node.type === 'text') {
    let text = esc(node.text);
    for (const mark of Array.isArray(node.marks) ? node.marks : []) {
      const tag = markTags.get(mark?.type);
      if (tag) text = `<${tag}>${text}</${tag}>`;
      else if (mark?.type === 'link') text = `<span class="bw-history-link">${text}</span><small class="bw-history-address"> (${esc(mark.attrs?.href)})</small>`;
    }
    return text;
  }
  if (node.type === 'doc') return children();
  if (node.type === 'heading') { const raw = node.attrs?.level, level = Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 2; return `<h${level}>${children()}</h${level}>`; }
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'image') return `<figure class="bw-history-unsupported">${iconHtml('image', 16)}<figcaption>${esc(node.attrs?.alt || 'Original image')}<small>${esc(node.attrs?.src || 'Location not recorded')}</small></figcaption></figure>`;
  if (node.type === 'taskItem') return `<li class="bw-history-task"><span aria-label="${node.attrs?.checked ? 'Completed' : 'Not completed'}">${node.attrs?.checked ? '☑' : '☐'}</span><div>${children()}</div></li>`;
  const tag = blockTags.get(node.type);
  if (tag) return `<${tag}>${children()}</${tag}>`;
  if (node.type === 'codeBlock') return `<pre><code>${children()}</code></pre>`;
  return `<div class="bw-history-unsupported"><strong>${esc(node.type || 'Unknown original block')}</strong><p>This historical block has no preview. Its exact data is preserved below.</p>${children()}</div>`;
}

export async function openOriginalHistory() {
  const api = window.barkdown.originalHistory, scope = libraryScope(state);
  const previousFocus = document.activeElement;
  const node = el(`<section class="bw-sheet bw-original-history" role="dialog" aria-modal="true" aria-label="Original history">
    <header class="bw-history-head"><div><h2>${iconHtml('history', 20)}Original history</h2><p>Preserved notes and changes, exactly as they were kept.</p></div><button data-close aria-label="Close original history">${iconHtml('x', 16)}</button></header>
    <div class="bw-history-toolbar"><label>Backup<select data-source aria-label="Original backup"></select></label><button data-choose>${iconHtml('folder-open', 14)}Open backup…</button></div>
    <p class="bw-history-status" role="status" aria-live="polite"></p>
    <div class="bw-history-layout"><aside aria-label="Original documents"><input type="search" data-search aria-label="Find an original note" placeholder="Find a note…"><div class="bw-history-documents"></div></aside><div class="bw-history-detail" tabindex="0" aria-label="Original record"></div></div>
    <footer><span>${iconHtml('file-text', 13)}Read-only · Changes here cannot affect your notes.</span><button data-refresh>Refresh</button></footer>
  </section>`);
  let closed = false, request = 0, sources = [], selectedSource = null, selectedDoc = null;
  const dismiss = openDialog(node, { onDismiss: () => close() });
  function close() { closed = true; request++; dismiss(); if (previousFocus?.isConnected) previousFocus.focus(); }
  const current = () => !closed && node.isConnected && scope === libraryScope(state);
  const q = selector => node.querySelector(selector), detail = q('.bw-history-detail'), list = q('.bw-history-documents'), status = q('[role=status]');
  q('[data-close]').onclick = close;
  node.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...node.querySelectorAll('button,select,input,[tabindex="0"],summary')].filter(n => !n.disabled && n.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  function message(title, copy) { detail.innerHTML = `<div class="bw-history-empty">${iconHtml('history', 28)}<h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`; }
  function renderDocuments() {
    const source = sources.find(s => s.id === selectedSource), search = q('[data-search]').value.trim().toLocaleLowerCase();
    list.innerHTML = '';
    if (source?.unavailable) { message('Original backup unavailable', source.unavailable); return; }
    const documents = (source?.documents || []).filter(d => `${d.title} ${d.id}`.toLocaleLowerCase().includes(search));
    for (const doc of documents) {
      const button = el(`<button class="bw-history-document" aria-pressed="${doc.id === selectedDoc}" data-document="${esc(doc.id)}">${iconHtml('file-text', 14)}<span>${esc(doc.title || 'Untitled')}<small>${esc(doc.id)}</small></span></button>`);
      button.onclick = () => selectDocument(doc.id);
      list.append(button);
    }
    if (!documents.length) list.innerHTML = '<p class="bw-history-list-empty">No matching original notes.</p>';
  }
  function renderEvidence(evidence) {
    const doc = evidence.document, receipt = evidence.latestAgentEdit;
    const groups = [
      { id: 'document', title: 'Document', rows: [{ label: `Saved document · revision ${doc.rev}`, content: doc.content, record: doc }] },
      { id: 'revisions', title: `Revisions (${doc.revisions?.length || 0})`, rows: (doc.revisions || []).map(r => ({ label: `Revision ${r.rev} · ${r.summary || r.actor || 'Saved change'} · ${date(r.at)}`, content: r.content, record: r })) },
      { id: 'proposals', title: `Proposals (${doc.proposals?.length || 0})`, rows: (doc.proposals || []).map(p => ({ label: `${p.summary || 'Original proposal'} · ${p.status || 'Status not recorded'}`, text: typeof p.markdown === 'string' ? p.markdown : null, record: p })) },
      { id: 'receipt', title: 'Agent edit', rows: receipt ? [{ label: `${receipt.undone ? 'Undone edit' : receipt.afterRev !== doc.rev ? 'Earlier edit · a later revision exists' : 'Recorded edit'} · revisions ${receipt.beforeRev}–${receipt.afterRev}`, content: receipt.before.content, record: receipt, note: 'Original content before this agent edit. This retained receipt cannot be used for Undo.' }] : [] },
    ];
    detail.innerHTML = `<div class="bw-history-title"><span class="bw-history-eyebrow">Original note</span><h3>${esc(doc.title || 'Untitled')}</h3><p>${esc(doc.id)} · legacy revision ${esc(doc.rev)}</p></div><nav class="bw-history-kinds" aria-label="Original record types"></nav><div class="bw-history-record"></div><details class="bw-history-provenance"><summary>Backup details</summary><dl><dt>Profile</dt><dd>${esc(evidence.profileId)}</dd><dt>Source hash</dt><dd>${esc(evidence.sourceHash)}</dd><dt>Manifest hash</dt><dd>${esc(evidence.manifestHash)}</dd></dl><p>Only retained records are shown. The old store kept at most 60 revisions; previously pruned history is unavailable. Images and links remain inert references.</p></details>`;
    const host = q('.bw-history-record');
    function showGroup(group) {
      for (const b of q('.bw-history-kinds').children) b.setAttribute('aria-pressed', String(b.dataset.kind === group.id));
      host.innerHTML = '';
      if (!group.rows.length) { host.innerHTML = '<p class="bw-history-list-empty">No record was retained for this note.</p>'; return; }
      const select = el(`<select aria-label="Select original record">${group.rows.map((r, i) => `<option value="${i}">${esc(r.label)}</option>`).join('')}</select>`);
      const body = document.createElement('div'); host.append(select, body);
      const show = () => {
        const r = group.rows[Number(select.value)];
        body.innerHTML = `<p class="bw-history-record-note">${esc(r.note || r.label)}</p><article class="bw-history-content">${r.content ? originalContent(r.content) : r.text != null ? `<pre class="bw-history-proposal">${esc(r.text)}</pre>` : '<p>The exact original fields are available below.</p>'}</article><details class="bw-history-raw"><summary>Original record (JSON)</summary><pre></pre></details>`;
        const raw = body.querySelector('details');
        raw.addEventListener('toggle', () => { if (raw.open && !raw.querySelector('pre').textContent) raw.querySelector('pre').textContent = JSON.stringify(r.record, null, 2); });
      };
      select.onchange = show; show();
    }
    for (const group of groups) {
      const button = el(`<button data-kind="${group.id}" aria-pressed="false">${esc(group.title)}</button>`);
      button.onclick = () => showGroup(group); q('.bw-history-kinds').append(button);
    }
    showGroup(groups[0]);
  }
  async function selectDocument(id) {
    const serial = ++request, sourceId = selectedSource;
    selectedDoc = id; renderDocuments(); message('Reading original history…', 'Checking the complete backup before displaying this note.');
    try {
      const evidence = await api.read({ sourceId, documentId: id });
      if (!current() || serial !== request) return;
      renderEvidence(evidence); detail.scrollTop = 0;
    } catch (error) { if (current() && serial === request) message('Original history unavailable', errorMessage(error)); }
  }
  function selectSource(id) {
    request++; selectedSource = id; selectedDoc = null; q('[data-search]').value = ''; renderDocuments();
    const source = sources.find(s => s.id === id);
    if (source?.unavailable) return;
    if (source?.documents.length) selectDocument(source.documents[0].id);
    else message('No original notes', 'This backup contains no original documents.');
  }
  async function load(preferred) {
    const serial = ++request;
    try {
      const value = await api.list(); if (!current() || serial !== request) return;
      sources = value; q('[data-source]').innerHTML = sources.map(s => `<option value="${esc(s.id)}">${esc(s.name)} · ${s.sourceHash.slice(0, 8)}${s.unavailable ? ' · unavailable' : ''}</option>`).join('');
      q('[data-source]').disabled = !sources.length;
      const pick = sources.find(s => s.id === preferred) || sources[0];
      if (pick) { q('[data-source]').value = pick.id; selectSource(pick.id); }
      else { selectedSource = null; selectedDoc = null; renderDocuments(); message('Your originals, kept close', 'Open an existing migration backup to read its notes, revisions and agent changes. Your current notes stay unchanged.'); }
    } catch (error) { if (current() && serial === request) { list.innerHTML = ''; message('Original history unavailable', errorMessage(error)); } }
  }
  q('[data-source]').onchange = event => selectSource(event.target.value);
  q('[data-search]').oninput = renderDocuments;
  q('[data-refresh]').onclick = () => load(selectedSource);
  q('[data-choose]').onclick = async () => {
    q('[data-choose]').disabled = true; status.textContent = '';
    try { const result = await api.choose(); if (current() && result) await load(result.id); }
    catch (error) { if (current()) status.textContent = `That backup was not opened. ${errorMessage(error)}`; }
    finally { if (current()) q('[data-choose]').disabled = false; }
  };
  q('[data-choose]').focus();
  await load();
}
