// Project editor work tab: the agent's working folder as a file tree plus a CodeMirror editor with unsaved buffers.
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { el, esc, iconHtml, toast, basename } from '../ui.js';
import { askConfirm } from '../dialogs.js';

const api = window.barkdown;
// Unsaved buffers are keyed by folder + file so they survive tab switches and chat switches within a session.
export const buffers = new Map();
const bufferKey = (root, file) => `${root}::${file}`;
// No root means every open folder, as required before reloading a profile.
export function dirtyCount(root) {
  let n = 0;
  for (const [key, b] of buffers) if ((root === undefined || key.startsWith(root + '::')) && b.draft !== b.saved) n++;
  return n;
}

function languageFor(file) {
  const ext = (file.split('.').pop() || '').toLowerCase();
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return javascript({ jsx: true });
  if (['ts', 'tsx'].includes(ext)) return javascript({ jsx: true, typescript: true });
  if (ext === 'css') return css();
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) return html();
  if (ext === 'json') return json();
  if (['md', 'markdown'].includes(ext)) return markdown();
  return [];
}

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--bw-text)', height: '100%' },
  '.cm-content': { caretColor: 'var(--bw-accent)', padding: '10px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--bw-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--bw-wash) !important' },
  '.cm-line': { padding: '0 14px' },
});

export function mountProject(tab, host, ctx) {
  const pane = el(`<div class="bw-pane"><div class="bw-project-editor"><div class="bw-editor-head"><span class="bw-file-path" id="path"></span><button data-act="tree" aria-expanded="false">${iconHtml('files')}Files</button><button data-act="expand"></button></div><div class="bw-editor-body"><div class="bw-source-editor" id="editor"><div class="bw-file-empty" id="empty">Choose a file from the tree, or ask the assistant to open one.</div></div><aside class="bw-file-tree" id="tree" aria-label="Project file explorer" hidden></aside></div><div class="bw-project-chat-action"><button data-act="folder-chat">${iconHtml('message-circle-plus')}New chat in this folder</button><span id="folder-label"></span></div><footer class="bw-editor-footer"><span id="status" role="status"></span><span class="bw-spacer"></span><button data-act="revert">Revert</button><button class="primary" data-act="save">Save (Ctrl+S)</button></footer></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  let view = null;
  let tree = null;
  let root = ctx.folder();
  let currentKey = null;
  let opened = null, navigation = 0, destroyed = false;
  const language = new Compartment();

  function buffer() { return currentKey ? buffers.get(currentKey) : null; }
  function isDirty() { const b = buffer(); return Boolean(b && b.draft !== b.saved); }

  function status(text) { if (!destroyed) q('#status').textContent = text; }
  function controls() {
    q('[data-act="save"]').disabled = !opened || Boolean(buffer()?.saving);
    q('[data-act="revert"]').disabled = !opened;
  }

  function renderHead() {
    q('#path').textContent = root ? `${basename(root)}${tab.file ? ' / ' + tab.file : ''}` : 'No working folder';
    q('#path').title = root ? `${root}${tab.file ? '/' + tab.file : ''}` : '';
    q('[data-act="expand"]').innerHTML = ctx.isExpanded() ? `${iconHtml('panel-left-open')}Back to chat` : `${iconHtml('expand')}Expand editor`;
    q('[data-act="tree"]').setAttribute('aria-expanded', String(Boolean(tab.treeOpen)));
    q('#tree').hidden = !tab.treeOpen;
    const folder = tab.file ? tab.file.split('/').slice(0, -1).join('/') : '';
    q('#folder-label').textContent = root ? (folder ? `${basename(root)} / ${folder}` : `${basename(root)} (root)`) : '';
    q('[data-act="folder-chat"]').disabled = !root;
    q('[data-act="folder-chat"]').onclick = () => ctx.startFolderChat(folder ? `${root}/${folder}` : root);
  }

  async function loadTree() {
    const host = q('#tree');
    if (!root) { host.innerHTML = '<p class="bw-small bw-muted" style="padding:10px">Pick a working folder from the composer.</p>'; return; }
    const requestedRoot = root, request = navigation;
    try {
      const result = await api.files.tree(requestedRoot);
      if (destroyed || root !== requestedRoot || navigation !== request) return;
      tree = result;
    } catch (error) {
      if (!destroyed && root === requestedRoot && navigation === request) host.innerHTML = `<p class="bw-error">${esc(error.message)}</p>`;
      return;
    }
    const render = (nodes, depth = 0) => nodes.map(n => n.type === 'dir'
      ? `<details ${depth === 0 || tab.file && tab.file.startsWith(n.path + '/') ? 'open' : ''}><summary>${esc(n.name)}</summary>${render(n.children, depth + 1)}</details>`
      : `<button class="bw-tree-file ${n.path === tab.file ? 'selected' : ''}" data-file="${esc(n.path)}">${iconHtml('file-code', 12)}<span>${esc(n.name)}</span>${(buffers.get(bufferKey(root, n.path))?.draft ?? null) !== null && buffers.get(bufferKey(root, n.path)).draft !== buffers.get(bufferKey(root, n.path)).saved ? '<span class="dirty">●</span>' : ''}</button>`).join('');
    host.innerHTML = `<header>${iconHtml('folder-open')}<span title="${esc(root)}">${esc(tree.name)}</span><span class="bw-spacer"></span><button data-act="close-tree" aria-label="Close file explorer">×</button></header>${render(tree.children)}${tree.truncated ? '<p class="bw-small bw-muted">Tree truncated</p>' : ''}`;
    host.querySelector('[data-act="close-tree"]').onclick = () => { tab.treeOpen = false; ctx.tabChanged(tab); renderHead(); };
    host.querySelectorAll('[data-file]').forEach(b => { b.onclick = () => openFile(b.dataset.file); });
  }

  async function openFile(file) {
    const request = ++navigation, requestedRoot = root;
    saveSelection();
    view?.destroy(); view = null; currentKey = null; opened = null;
    tab.file = file;
    tab.title = basename(file);
    ctx.tabChanged(tab);
    renderHead(); controls();
    q('#empty').hidden = false;
    q('#empty').textContent = requestedRoot ? `Opening ${file}…` : 'Choose a working folder to open this file.';
    status(requestedRoot ? `Opening ${file}…` : 'No working folder');
    if (!requestedRoot) return;
    const key = bufferKey(requestedRoot, file);
    let buf = buffers.get(key);
    if (!buf) {
      try {
        const data = await api.files.read(requestedRoot, file);
        if (destroyed || request !== navigation) return;
        if (data.binary) { q('#empty').textContent = `${file} is binary (${data.size} bytes)`; status('This file cannot be edited as text.'); return; }
        buf = { draft: data.text, saved: data.text, mtime: data.mtime, selection: 0, scroll: 0 };
        buffers.set(key, buf);
      } catch (error) {
        if (destroyed || request !== navigation) return;
        q('#empty').textContent = `Could not open ${file}: ${error.message}`;
        status('File unavailable · other unsaved drafts are preserved');
        return;
      }
    }
    if (destroyed || request !== navigation) return;
    currentKey = key;
    opened = { root: requestedRoot, file, key };
    q('#empty').hidden = true;
    controls();
    view = new EditorView({
      parent: q('#editor'),
      state: EditorState.create({ doc: buf.draft, selection: { anchor: Math.min(buf.selection, buf.draft.length) }, extensions: [
        lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(), bracketMatching(), indentOnInput(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }), theme,
        language.of(languageFor(file)),
        keymap.of([{ key: 'Mod-s', run: () => { save(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(update => { if (update.docChanged) { buf.draft = update.state.doc.toString(); ctx.userIsEditing(); ctx.dirtyChanged(); status(buf.draft === buf.saved ? 'No unsaved changes' : 'Edited · not saved'); } }),
        EditorView.lineWrapping,
      ] }),
    });
    view.scrollDOM.scrollTop = buf.scroll || 0;
    status(buf.draft === buf.saved ? `${file} · saved` : 'Edited · not saved');
    renderHead();
    loadTree();
  }

  function saveSelection() { const b = buffer(); if (b && view) { b.selection = view.state.selection.main.head; b.scroll = view.scrollDOM.scrollTop; } }

  async function save() {
    const target = opened, b = buffer();
    if (!target || !b || b.saving) return;
    const text = b.draft;
    if (text === b.saved) { status('Nothing to save'); return; }
    b.saving = true; controls();
    const stillHere = () => !destroyed && opened?.key === target.key;
    try {
      const result = await api.files.write(target.root, target.file, text, b.mtime);
      if (result.conflict) {
        if (!await askConfirm(result.missing ? `${target.root}/${target.file} was removed from disk. Recreate it with this draft?` : `${target.root}/${target.file} changed on disk since you opened it. Overwrite the disk version with yours?`, { title: result.missing ? 'File removed from disk' : 'File changed on disk', confirm: result.missing ? 'Recreate' : 'Overwrite', danger: true })) {
          if (stillHere()) status('Not saved · file changed on disk');
          return;
        }
        const forced = await api.files.write(target.root, target.file, text);
        b.mtime = forced.mtime;
      } else b.mtime = result.mtime;
      b.saved = text;
      ctx.dirtyChanged();
      ctx.fileSaved(target.file);
      if (stillHere()) { status(b.draft === text ? `${target.file} · saved` : 'Edited · not saved'); loadTree(); }
    } catch (error) { if (stillHere()) toast('Could not save: ' + error.message, 'error'); }
    finally { b.saving = false; if (!destroyed) controls(); }
  }

  function revert() {
    const b = buffer();
    if (!b || !view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: b.saved } });
    b.draft = b.saved;
    status('Reverted to saved');
    ctx.dirtyChanged();
  }

  q('[data-act="tree"]').onclick = () => { tab.treeOpen = !tab.treeOpen; ctx.tabChanged(tab); renderHead(); if (tab.treeOpen) loadTree(); };
  q('[data-act="expand"]').onclick = () => ctx.toggleExpanded();
  q('[data-act="save"]').onclick = save;
  q('[data-act="revert"]').onclick = revert;

  renderHead();
  controls();
  loadTree();
  if (tab.file) openFile(tab.file); else if (!root) status('Pick a working folder to browse and edit files.'); else status('Session buffers keep unsaved edits while you switch files and tabs.');

  return {
    el: pane,
    type: 'project',
    tab,
    navigate() { root = ctx.folder(); renderHead(); loadTree(); if (tab.file) openFile(tab.file); },
    async refresh(file) {
      if (file && file === tab.file) { const key = bufferKey(root, file); const b = buffers.get(key); if (b && b.draft === b.saved) { buffers.delete(key); openFile(file); } }
      else loadTree();
      renderHead();
    },
    openFile,
    savePosition() { saveSelection(); },
    focus() { view?.focus(); },
    isDirty,
    destroy() { saveSelection(); destroyed = true; navigation++; view?.destroy(); pane.remove(); },
  };
}
