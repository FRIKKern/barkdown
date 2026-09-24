import { agentPresence } from '../agent-presence.js';
import { renderAgentUndo } from '../agent-undo.js';
// Document work tab: a Tiptap editor over the local document store, with proposals, revisions,
// references and a linked-document path that opens to the right.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { el, esc, icon, iconHtml, relativeTime, toast, debounce } from '../ui.js';
import { markdownToDoc } from '../../../shared/markdown.js';
import { askText, askConfirm } from '../dialogs.js';

const api = window.barkdown;

const BLOCK_TYPES = [
  { id: 'paragraph', label: 'Text', icon: 'type', run: e => e.chain().focus().setParagraph().run(), active: e => e.isActive('paragraph') },
  { id: 'h1', label: 'Heading 1', icon: 'heading', run: e => e.chain().focus().toggleHeading({ level: 1 }).run(), active: e => e.isActive('heading', { level: 1 }) },
  { id: 'h2', label: 'Heading 2', icon: 'heading', run: e => e.chain().focus().toggleHeading({ level: 2 }).run(), active: e => e.isActive('heading', { level: 2 }) },
  { id: 'h3', label: 'Heading 3', icon: 'heading', run: e => e.chain().focus().toggleHeading({ level: 3 }).run(), active: e => e.isActive('heading', { level: 3 }) },
  { id: 'bullet', label: 'Bulleted list', icon: 'list', run: e => e.chain().focus().toggleBulletList().run(), active: e => e.isActive('bulletList') },
  { id: 'ordered', label: 'Numbered list', icon: 'list-ordered', run: e => e.chain().focus().toggleOrderedList().run(), active: e => e.isActive('orderedList') },
  { id: 'task', label: 'Checklist', icon: 'list-checks', run: e => e.chain().focus().toggleTaskList().run(), active: e => e.isActive('taskList') },
  { id: 'quote', label: 'Quote', icon: 'quote', run: e => e.chain().focus().toggleBlockquote().run(), active: e => e.isActive('blockquote') },
  { id: 'code', label: 'Code block', icon: 'square-code', run: e => e.chain().focus().toggleCodeBlock().run(), active: e => e.isActive('codeBlock') },
  { id: 'rule', label: 'Divider', icon: 'minus', run: e => e.chain().focus().setHorizontalRule().run(), active: () => false },
];

export function mountDocument(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-doc-pane"><div class="bw-path" id="path"></div><div class="bw-docpanes"><div class="bw-source-pane" id="source"></div><div class="bw-current-pane" id="current"><div class="bw-document"><div class="bw-kicker"><span id="kicker">Barkdown / Library</span><span class="bw-save-state" id="save-state"></span></div><input class="bw-doc-title" id="title" aria-label="Document title" placeholder="Untitled"><div class="bw-doc-meta" id="meta"></div><div id="agent-edit"></div><div id="proposals"></div><div id="conflict"></div><div id="editor"></div><div class="bw-doc-links" id="links"></div><div class="bw-doc-state" id="state"></div></div></div></div><div class="bw-bubble" id="bubble" hidden></div><div class="bw-slash" id="slash" hidden></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  const presence = agentPresence(pane, () => q('.ProseMirror'), q('#current'));
  let refreshing = false, refreshAgain = false;
  const updateUndo = () => renderAgentUndo(q('#agent-edit'), doc?.id, doc?.rev, async () => { if (dirty || saving) throw new Error('Finish saving your edit before Undo.'); presence.stop(); await api.docs.undoAgentEdit(doc.id, q('#agent-edit').dataset.editId); await controller.refresh(doc.id); ctx.libraryChanged(); });
  let editor = null;
  let doc = null;
  let dirty = false;
  let saving = false;
  let readOnly = false;
  let destroyed = false;
  let slashState = null;
  let typesOpen = false;

  const docId = () => tab.path.at(-1);

  async function fetchDoc(id) {
    if (tab.source === 'barkpark') throw new Error('This Paper must be opened in its original Paper editor.');
    return api.docs.get(id);
  }

  function htmlToMarkdownish(html) {
    return String(html).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${'#'.repeat(Number(n))} ${strip(t)}\n`).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${strip(t)}`).replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${strip(t)}\n`).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  }
  function strip(t) { return String(t).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

  const persist = debounce(async () => {
    if (!editor || !doc || readOnly || !dirty) return;
    saving = true;
    setSaveState('Saving…');
    try {
      const result = await api.docs.save({ id: doc.id, baseRev: doc.rev, content: editor.getJSON(), title: q('#title').value.trim() || 'Untitled', actor: 'you', summary: 'Edited in Barkdown' });
      if (destroyed) return;
      if (result.conflict) { showConflict(result.doc); setSaveState('Conflict'); return; }
      doc = result.doc;
      dirty = false;
      setSaveState('Saved · rev ' + doc.rev);
      renderMeta();
      renderLinks();
      ctx.documentChanged(doc);
    } catch (error) {
      setSaveState('Not saved');
      toast('Could not save: ' + error.message, 'error');
    } finally { saving = false; }
  }, 700);

  function setSaveState(text) { q('#save-state').textContent = text; }

  function showConflict(current) {
    const box = q('#conflict');
    box.innerHTML = '';
    box.appendChild(el(`<div class="bw-conflict"><strong>This document changed elsewhere</strong> (now rev ${current.rev}, ${esc(relativeTime(current.updatedAt))}). Your unsaved edits are still here.<div><button data-act="theirs">Load the newer version</button><button data-act="mine">Keep mine and overwrite</button></div></div>`));
    box.querySelector('[data-act="theirs"]').onclick = () => { doc = current; editor.commands.setContent(doc.content, { emitUpdate: false }); q('#title').value = doc.title; dirty = false; box.innerHTML = ''; setSaveState('Loaded rev ' + doc.rev); renderMeta(); };
    box.querySelector('[data-act="mine"]').onclick = () => { doc.rev = current.rev; dirty = true; box.innerHTML = ''; persist(); persist.flush(); };
  }

  function renderMeta() {
    if (!doc) return;
    updateUndo();
    const crumbs = ctx.pagePath ? ctx.pagePath(doc.id, doc.source) : [];
    q('#kicker').textContent = crumbs.length > 1 ? crumbs.join(' / ') : (doc.source === 'barkpark' ? 'Barkpark / Paper' : 'Pages');
    q('#meta').textContent = `${doc.source === 'barkpark' ? 'Read-only copy · ' : ''}rev ${doc.rev ?? '–'} · updated ${relativeTime(doc.updatedAt)} · ${(doc.references || []).length} reference(s) · ${(doc.backlinks || []).length} backlink(s)`;
  }

  function renderProposals() {
    const host = q('#proposals');
    host.innerHTML = '';
    for (const p of doc?.proposals || []) {
      const node = el(`<div class="bw-proposal" data-id="${esc(p.id)}"><small>${esc(p.actor === 'agent' ? 'Proposed by the assistant' : 'Proposal')} · ${esc(p.mode)}${p.mode === 'replace_block' ? ' #' + p.blockIndex : ''} · ${esc(relativeTime(p.createdAt))}</small><p><strong>${esc(p.summary || 'Change')}</strong></p><div class="body">${esc(p.markdown)}</div><button class="primary" data-act="keep">Keep</button><button data-act="discard">Discard</button></div>`);
      node.querySelector('[data-act="keep"]').onclick = () => resolve(p.id, true);
      node.querySelector('[data-act="discard"]').onclick = () => resolve(p.id, false);
      host.appendChild(node);
    }
  }

  async function resolve(proposalId, accept) {
    try {
      const result = await api.docs.resolveProposal(doc.id, proposalId, accept);
      doc = result.doc || doc;
      if (accept && editor) { editor.commands.setContent(doc.content, { emitUpdate: false }); dirty = false; setSaveState('Applied · rev ' + doc.rev); }
      renderProposals(); renderMeta(); renderLinks();
      ctx.documentChanged(doc);
      toast(accept ? 'Change applied' : 'Proposal discarded');
    } catch (error) { toast(error.message, 'error'); }
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
      history.length ? `<h3>History</h3>${history.slice(0, 8).map(r => `<div class="bw-rev"><span>rev ${esc(r.rev)}</span><span>${esc(r.summary || '')}</span><span>${esc(r.actor || '')} · ${esc(relativeTime(r.at))}</span>${doc.source !== 'barkpark' && r.rev !== doc.rev ? `<button data-restore="${esc(r.rev)}">Restore</button>` : ''}</div>`).join('')}` : '',
      !references.length && !(doc.backlinks || []).length && !related.length ? '<h3>Linked documents</h3><p class="bw-small bw-muted">Link another document with the link button (barkdown://doc/&lt;id&gt;) and it will appear here with its backlink.</p>' : '',
    ].join('');
    host.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => ctx.openLinked(tab, b.dataset.open, b.dataset.source); });
    host.querySelectorAll('[data-restore]').forEach(b => { b.onclick = async () => { try { const r = await api.docs.restore(doc.id, Number(b.dataset.restore)); doc = r.doc; editor.commands.setContent(doc.content, { emitUpdate: false }); dirty = false; setSaveState('Restored · rev ' + doc.rev); renderMeta(); renderLinks(); ctx.documentChanged(doc); } catch (error) { toast(error.message, 'error'); } }; });
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
      bar.appendChild(el(`<span class="bw-muted">${esc(doc?.source === 'barkpark' ? 'Barkpark paper' : 'Library document')}</span>`));
    }
    const actions = el('<div class="bw-doc-actions"></div>');
    if (doc?.source === 'barkpark') {
      const importBtn = el(`<button title="Copy into the local library">${iconHtml('download')} Import</button>`);
      importBtn.onclick = async () => { try { const local = await api.barkpark.import(doc.id); toast('Imported as ' + local.title); ctx.libraryChanged(); ctx.openLinked(tab, local.id, 'local', true); } catch (error) { toast(error.message, 'error'); } };
      actions.appendChild(importBtn);
    } else {
      const ask = el(`<button title="Ask the assistant about this document">${iconHtml('sparkles')} Ask</button>`);
      ask.onclick = () => ctx.askAbout(`About the document "${doc.title}" (id ${doc.id}): `);
      const exportBtn = el(`<button title="Export as Markdown">${iconHtml('download')}</button>`);
      exportBtn.onclick = async () => { const p = await api.docs.exportMarkdown(doc.id); if (p) toast('Exported to ' + p); };
      const del = el(`<button title="Delete document">${iconHtml('trash')}</button>`);
      del.onclick = async () => { if (!await askConfirm(`Delete "${doc.title}"? This cannot be undone.`, { title: 'Delete document?', confirm: 'Delete', danger: true })) return; await api.docs.delete(doc.id); ctx.libraryChanged(); ctx.closeTab(tab); };
      actions.append(ask, exportBtn, del);
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
      new Editor({ element: pane.querySelector('#source-body'), editable: false, extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }), TaskList, TaskItem.configure({ nested: true }), TableKit.configure({ table: { resizable: false } })], content: source.content });
    } catch { pane.innerHTML = ''; }
  }

  // ----- floating selection menu with attached Types submenu -----
  function positionBubble() {
    const bubble = q('#bubble');
    if (!editor || readOnly) { bubble.hidden = true; return; }
    const { from, to, empty } = editor.state.selection;
    if (empty || !editor.isFocused && !typesOpen) { if (!typesOpen) bubble.hidden = true; return; }
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const paneRect = pane.getBoundingClientRect();
    bubble.hidden = false;
    renderBubble();
    const width = bubble.offsetWidth;
    let left = (start.left + end.left) / 2 - paneRect.left - width / 2;
    left = Math.max(8, Math.min(left, paneRect.width - width - 8));
    let top = start.top - paneRect.top - bubble.offsetHeight - 8;
    if (top < 4) top = end.bottom - paneRect.top + 8;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function renderBubble() {
    const bubble = q('#bubble');
    const marks = [
      { id: 'bold', icon: 'bold', run: () => editor.chain().focus().toggleBold().run() },
      { id: 'italic', icon: 'italic', run: () => editor.chain().focus().toggleItalic().run() },
      { id: 'strike', icon: 'strikethrough', run: () => editor.chain().focus().toggleStrike().run() },
      { id: 'code', icon: 'code', run: () => editor.chain().focus().toggleCode().run() },
    ];
    bubble.innerHTML = marks.map(m => `<button data-mark="${m.id}" class="${editor.isActive(m.id) ? 'on' : ''}" title="${m.id}">${iconHtml(m.icon, 13)}</button>`).join('') + `<button data-link title="Link">${iconHtml('link', 13)}</button><span class="sep"></span><button data-types class="${typesOpen ? 'on' : ''}">Types ${iconHtml('chevron-down', 12)}</button>` + (typesOpen ? `<div class="bw-slash" style="position:absolute;left:0;top:100%;margin-top:4px">${BLOCK_TYPES.map(t => `<button data-type="${t.id}" aria-selected="${t.active(editor)}">${iconHtml(t.icon, 13)}${esc(t.label)}</button>`).join('')}</div>` : '');
    bubble.querySelectorAll('[data-mark]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { marks.find(m => m.id === b.dataset.mark).run(); renderBubble(); }; });
    const link = bubble.querySelector('[data-link]');
    link.onmousedown = e => e.preventDefault();
    link.onclick = async () => {
      const previous = editor.getAttributes('link').href || '';
      const href = await askText({ title: 'Link', label: 'Address', value: previous, placeholder: 'https://… or barkdown://doc/<id>', confirm: previous ? 'Update' : 'Link', hint: 'Leave empty to remove the link.' });
      if (href === null) return;
      if (!href) editor.chain().focus().unsetLink().run(); else editor.chain().focus().setLink({ href }).run();
      renderBubble();
    };
    const types = bubble.querySelector('[data-types]');
    types.onmousedown = e => e.preventDefault();
    types.onclick = () => { typesOpen = !typesOpen; renderBubble(); };
    bubble.querySelectorAll('[data-type]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { BLOCK_TYPES.find(t => t.id === b.dataset.type).run(editor); typesOpen = false; renderBubble(); positionBubble(); }; });
  }

  // ----- slash command menu -----
  function updateSlash() {
    const menu = q('#slash');
    if (!editor || readOnly) { menu.hidden = true; return; }
    const { $from, empty } = editor.state.selection;
    const text = $from.parent.textContent;
    const match = empty && $from.parent.type.name === 'paragraph' && /^\/([\w ]*)$/.exec(text);
    if (!match) { menu.hidden = true; slashState = null; return; }
    const query = match[1].toLowerCase();
    const items = BLOCK_TYPES.filter(t => t.id !== 'paragraph' && t.label.toLowerCase().includes(query));
    if (!items.length) { menu.hidden = true; slashState = null; return; }
    if (!slashState || slashState.query !== query) slashState = { query, index: 0, items };
    slashState.items = items;
    slashState.index = Math.min(slashState.index, items.length - 1);
    menu.hidden = false;
    menu.innerHTML = items.map((t, i) => `<button data-slash="${t.id}" aria-selected="${i === slashState.index}">${iconHtml(t.icon, 13)}${esc(t.label)}</button>`).join('');
    menu.querySelectorAll('[data-slash]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => applySlash(b.dataset.slash); });
    const coords = editor.view.coordsAtPos($from.pos);
    const paneRect = pane.getBoundingClientRect();
    menu.style.left = Math.min(coords.left - paneRect.left, paneRect.width - 230) + 'px';
    menu.style.top = (coords.bottom - paneRect.top + 6) + 'px';
  }

  function applySlash(id) {
    const type = BLOCK_TYPES.find(t => t.id === id);
    const { $from } = editor.state.selection;
    editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos }).run();
    type.run(editor);
    slashState = null;
    q('#slash').hidden = true;
  }

  function onKeyDown(view, event) {
    if (slashState && !q('#slash').hidden) {
      if (event.key === 'ArrowDown') { slashState.index = (slashState.index + 1) % slashState.items.length; updateSlash(); return true; }
      if (event.key === 'ArrowUp') { slashState.index = (slashState.index - 1 + slashState.items.length) % slashState.items.length; updateSlash(); return true; }
      if (event.key === 'Enter') { applySlash(slashState.items[slashState.index].id); return true; }
      if (event.key === 'Escape') { slashState = null; q('#slash').hidden = true; return true; }
    }
    if (event.key === 'Escape') { typesOpen = false; q('#bubble').hidden = true; }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); persist(); persist.flush(); return true; }
    return false;
  }

  async function load() {
    const id = docId();
    setSaveState('');
    q('#conflict').innerHTML = '';
    try { doc = await fetchDoc(id); } catch (error) { q('#editor').innerHTML = `<p class="bw-error">Could not open ${esc(id)}: ${esc(error.message)}</p>`; return; }
    if (destroyed || !doc) { if (!doc) q('#editor').innerHTML = `<p class="bw-error">Document ${esc(id)} no longer exists.</p>`; return; }
    readOnly = doc.source === 'barkpark';
    tab.title = doc.title;
    ctx.tabChanged(tab);
    q('#title').value = doc.title;
    q('#title').disabled = readOnly;
    if (editor) { editor.destroy(); editor = null; }
    q('#editor').innerHTML = '';
    editor = new Editor({
      element: q('#editor'),
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: false, autolink: true, protocols: ['barkdown'] }),
        Placeholder.configure({ placeholder: 'Write, or type / for block types…' }),
        TaskList, TaskItem.configure({ nested: true }),
        TableKit.configure({ table: { resizable: false } }),
      ],
      content: doc.content,
      editorProps: {
        handleKeyDown: onKeyDown,
        handleClick: (view, pos, event) => {
          const anchor = event.target.closest('a[href]');
          if (!anchor) return false;
          const href = anchor.getAttribute('href');
          const m = /^barkdown:\/\/doc\/([\w-]+)/.exec(href);
          if (m) { ctx.openLinked(tab, m[1], 'local'); return true; }
          if (/^https?:/.test(href)) { ctx.openWebsite(href); return true; }
          return false;
        },
      },
      onUpdate: () => { if (!readOnly) { dirty = true; setSaveState('Editing…'); ctx.userIsEditing(); persist(); } updateSlash(); },
      onSelectionUpdate: () => { positionBubble(); updateSlash(); },
      onBlur: () => { setTimeout(() => { if (!typesOpen && !pane.contains(document.activeElement)) q('#bubble').hidden = true; }, 120); },
      onFocus: () => ctx.userIsEditing(),
    });
    q('#title').oninput = () => { if (readOnly) return; dirty = true; tab.title = q('#title').value.trim() || 'Untitled'; ctx.tabChanged(tab); persist(); };
    q('#title').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } };
    q('#state').textContent = readOnly ? 'This paper is read from Barkpark. Import it to edit a local copy; writes back to Barkpark are fenced through the ops endpoint and off by default.' : 'Edits save automatically to the local library with revision history. Assistant edits save directly. Undo the latest change above or restore a revision from History.';
    renderMeta(); renderProposals(); renderPath(); renderLinks(); renderSource();
    q('#current').scrollTop = tab.scroll || 0;
  }

  load();
  pane.addEventListener('scroll', () => {}, true);

  const controller = {
    el: pane,
    type: 'doc',
    tab,
    async refresh(changedId) {
      if (!doc || changedId && changedId !== doc.id) return;
      if (refreshing) { refreshAgain = true; return; }
      if (dirty || saving) return;
      refreshing = true;
      const id = doc.id, beforeRev = doc.rev;
      try {
        const fresh = await fetchDoc(id);
        if (destroyed || !fresh || doc.id !== id || dirty || saving) return;
        const edit = await api.docs.agentEdit(id);
        const allowed = () => !destroyed && doc.id === id && doc.rev === beforeRev && !dirty && !saving;
        const apply = () => { doc = fresh; if (editor && fresh.rev !== beforeRev) editor.commands.setContent(doc.content, { emitUpdate: false }); q('#title').value = doc.title; setSaveState('Saved · rev ' + doc.rev); };
        if (edit && !edit.undone && edit.beforeRev === beforeRev && edit.afterRev === fresh.rev) await presence.run(edit, apply, allowed);
        else if (allowed()) apply();
        renderProposals(); renderMeta(); renderLinks(); renderPath(); tab.title = doc.title; ctx.tabChanged(tab);
      } catch (error) { console.warn('Document refresh:', error); }
      finally { refreshing = false; if (refreshAgain) { refreshAgain = false; controller.refresh(); } }
    },
    navigate() { presence.stop(); load(); },
    savePosition() { tab.scroll = q('#current').scrollTop; },
    focus() { editor?.commands.focus(); },
    isDirty: () => dirty,
    flush: () => persist.flush(),
    destroy() { destroyed = true; presence.destroy(); persist.flush(); editor?.destroy(); pane.remove(); },
  };
  return controller;
}
