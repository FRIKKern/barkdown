import { mountComposer } from './composer.js';
// Barkdown desktop renderer: app-wide navigation, per-chat workspaces, agent runs, pins, quick open.
import { el, esc, iconHtml, renderIcons, toast, basename, relativeTime, errorMessage } from './ui.js';
import { state, load, save, newChat, newTab, currentChat, activeTab, touch, chatTitleFrom } from './state.js';
import { transcriptHtml, handleAgentEvent, respondApproval, providerFor, formatDuration } from './conversation.js';
import { mountDocument } from './tabs/document.js';
import { mountPaper } from './tabs/paper.js';
import { mountWebsite } from './tabs/website.js';
import { mountReview } from './tabs/review.js';
import { mountProject, buffers, dirtyCount } from './tabs/project.js';
import { mountSideChat } from './tabs/sidechat.js';
import { mountTerminal } from './tabs/terminal.js';
import { openSettings } from './settings.js';
import { ensureCanvasBundle } from './canvas-bundle.js';
import { toggleMenu, hideMenus as closeMenus, installMenuDismissal } from './menus.js';
import { askText, askConfirm } from './dialogs.js';
import { renderPages, seedTree, addPage, pagePath, pageKey, ensurePages } from './pages.js';
import { tabToTarget, favoriteKey } from './state.js';

const api = window.barkdown;
const root = document.getElementById('app');
const q = s => root.querySelector(s);
const TYPE_ICON = { doc: 'file-text', web: 'globe', review: 'git-pull-request', project: 'folder-code', chat: 'message-circle', terminal: 'terminal' };

let mainComposer;
const controllers = new Map(); // tab.id -> mounted controller
const DIRECT = 'direct';

// ---------- helpers ----------
function directChat() {
  if (!state.chats[DIRECT]) {
    const temp = newChat({ title: 'Documents', side: true });
    delete state.chats[temp.id];
    state.chats[DIRECT] = { ...temp, id: DIRECT };
  }
  return state.chats[DIRECT];
}
function workspaceChat() { return state.mode === 'document' ? directChat() : currentChat(); }
function documentSummary(id, source) {
  return (source === 'barkpark' ? state.barkparkDocs : state.documents).find(d => d.id === id) || state.documents.find(d => d.id === id) || state.barkparkDocs.find(d => d.id === id) || null;
}
function pauseFollow(chat = currentChat()) { if (chat) chat.following = false; }

// ---------- tab context passed to tab controllers ----------
function tabContext(chat) {
  return {
    folder: () => chat.folder || null,
    bindTranscript,
    initials,
    switchChat,
    chatChanged: changed => { if (state.current === changed.id) renderChat(); renderSidebar(); renderTabs(); save(); },
    openChatTarget: (owner, target) => openConversationTarget(target, owner),
    folderChanged: owner => { for (const c of controllers.values()) if (owner.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); },
    tabChanged: tab => { renderTabs(); save(); },
    documentSummary,
    pagePath: (id, source) => pagePath(pageKey(id, source)),
    openLinked: (fromTab, id, source = 'local', replace = false) => {
      pauseFollow(chat);
      if (replace) { fromTab.path = [id]; fromTab.source = source; }
      else if (fromTab.type === 'doc' && fromTab.source === (source || 'local') && !fromTab.path.includes(id)) fromTab.path = [...fromTab.path, id];
      else if (fromTab.type === 'doc' && fromTab.source !== source) { openDocTab(chat, id, source); return; }
      else if (fromTab.path.includes(id)) fromTab.path = fromTab.path.slice(0, fromTab.path.indexOf(id) + 1);
      controllers.get(fromTab.id)?.navigate();
      renderTabs(); save();
    },
    openWebsite: url => openTarget({ kind: 'web', url, title: hostname(url) }, chat, true),
    askAbout: text => { q('#bw-prompt').value = text; q('#bw-prompt').focus(); if (state.mode !== 'chat') { state.mode = 'chat'; render(); } },
    libraryChanged: () => refreshLibrary(),
    importPaper,
    closeTab: tab => closeTab(chat, tab.id),
    documentChanged: doc => { refreshLibrary(); for (const c of controllers.values()) if (c.type === 'doc' && c.tab.path.at(-1) === String(doc.id).replace(/^bp:/, '')) c.refresh?.(doc.id); },
    userIsEditing: () => pauseFollow(chat),
    isExpanded: () => Boolean(chat.editorExpanded),
    toggleExpanded: () => { chat.editorExpanded = !chat.editorExpanded; render(); },
    startFolderChat: folder => startFolderChat(folder),
    dirtyChanged: () => renderTabs(),
    fileSaved: file => { for (const c of controllers.values()) if (c.type === 'review') c.refresh(); },
    openProjectFile: file => openTarget({ kind: 'project', path: file, title: basename(file) }, chat, true),
    openTarget: target => openTarget(target, chat, true),
  };
}

function hostname(url) { try { return new URL(url).hostname; } catch { return url; } }

// ---------- mounting ----------
function mountTab(chat, tab) {
  if (controllers.has(tab.id)) return controllers.get(tab.id);
  const host = q('#bw-workspace');
  const ctx = tabContext(chat);
  const controller = tab.type === 'doc' ? (tab.source === 'barkpark' ? mountPaper(tab, host, ctx) : mountDocument(tab, host, ctx)) : tab.type === 'web' ? mountWebsite(tab, host, ctx) : tab.type === 'review' ? mountReview(tab, host, ctx) : tab.type === 'project' ? mountProject(tab, host, ctx) : tab.type === 'terminal' ? mountTerminal(tab, host, ctx) : mountSideChat(tab, host, ctx);
  controller.chatId = chat.id;
  controllers.set(tab.id, controller);
  return controller;
}

function unmountTab(tabId) { const c = controllers.get(tabId); if (c) { c.destroy(); controllers.delete(tabId); } }

function renderWorkspace() {
  const chat = workspaceChat();
  const host = q('#bw-workspace');
  const active = activeTab(chat);
  for (const c of controllers.values()) c.el.hidden = true;
  host.querySelector('.bw-empty')?.remove();
  if (!active) {
    const empty = el(`<div class="bw-pane bw-empty"><span>${chat?.tabs.length ? 'Choose a tab.' : 'Open something beside the conversation.'}</span><button data-show-new>New work tab +</button></div>`);
    empty.querySelector('[data-show-new]').onclick = () => toggleMenu('#bw-new-menu', '#bw-plus');
    host.appendChild(empty);
    return;
  }
  const controller = mountTab(chat, active);
  controller.el.hidden = false;
  if (controller.type === 'chat') controller.render?.();
  q('#bw-splitter').hidden = state.mode !== 'chat' || Boolean(chat.editorExpanded);
}

// ---------- tabs ----------
function renderTabs() {
  const chat = workspaceChat();
  const nav = q('#bw-tabs');
  // The work panel is something you open: with no tabs in a chat it stays collapsed and the chat takes the width.
  root.classList.toggle('bw-nowork', state.mode !== 'document' && !chat?.editorExpanded && !(chat?.tabs?.length));
  const html = (chat?.tabs || []).map(t => {
    const dirty = t.type === 'project' && chat.folder && dirtyCount(chat.folder) > 0;
    if (t.type === 'chat' && state.chats[t.sideChatId]?.title) t.title = state.chats[t.sideChatId].title;
    const title = t.type === 'doc' ? t.path.map(id => documentSummary(id, t.source)?.title || id).join(' → ') : t.type === 'web' ? t.url || t.title : t.title;
    return `<div class="bw-tab ${t.id === chat.active ? 'active' : ''}"><button data-tab="${t.id}" aria-current="${t.id === chat.active ? 'page' : 'false'}" title="${esc(title)}">${iconHtml(TYPE_ICON[t.type])}<span class="bw-tab-label">${esc(t.title)}</span>${t.unread ? '<span class="bw-dot" aria-label="Updated by the assistant"></span>' : dirty ? '<span class="bw-dot bw-dot-dirty" aria-label="Unsaved edits"></span>' : ''}</button><div class="bw-tab-actions"><button data-fav="${t.id}" class="${favoriteFor(t) ? 'on' : ''}" aria-label="${favoriteFor(t) ? 'Remove from favorites' : 'Add to favorites'}" title="${favoriteFor(t) ? 'Remove from favorites' : 'Add to favorites'}">${iconHtml('star', 12)}</button><button data-close="${t.id}" aria-label="Close ${esc(t.title)}">${iconHtml('x', 12)}</button></div></div>`;
  }).join('');
  // Only touch the DOM when the strip changed: keeps double-clicks (rename) and hover states intact.
  if (nav.innerHTML !== html) nav.innerHTML = html;
  requestAnimationFrame(() => { const b = nav.querySelector(`[data-tab="${chat?.active}"]`); if (b) { const o = nav.getBoundingClientRect(), i = b.getBoundingClientRect(); if (i.right > o.right) nav.scrollLeft += i.right - o.right; else if (i.left < o.left) nav.scrollLeft -= o.left - i.left; } });
}

function focusTab(chat, id, manual = true) {
  savePositions();
  if (manual) pauseFollow(chat);
  chat.active = id;
  const tab = activeTab(chat);
  if (tab) tab.unread = false;
  hideMenus();
  renderTabs(); renderWorkspace(); save();
}

function closeTab(chat, id) {
  savePositions();
  pauseFollow(chat);
  const index = chat.tabs.findIndex(t => t.id === id);
  if (index < 0) return;
  const controller = controllers.get(id);
  if (controller?.canClose?.() === false) return;
  const [removed] = chat.tabs.splice(index, 1);
  if (controller?.isDirty?.() && removed.type === 'doc') controller.flush?.();
  if (removed.type === 'project' && chat.folder && dirtyCount(chat.folder)) toast('Unsaved file edits stay in this session. Reopen the project editor to save them.');
  unmountTab(id);
  chat.closedTargets.push(targetKey(tabTarget(removed)));
  if (chat.active === id) chat.active = chat.tabs[Math.min(index, chat.tabs.length - 1)]?.id || null;
  if (removed.type === 'project' && chat.editorExpanded) chat.editorExpanded = false;
  render();
}

function tabTarget(tab) {
  if (tab.type === 'doc') return { kind: 'doc', id: tab.path.at(-1) };
  if (tab.type === 'web') return { kind: 'web', url: tab.url };
  if (tab.type === 'project') return { kind: 'project' };
  if (tab.type === 'review') return { kind: 'review' };
  return { kind: 'chat', id: tab.sideChatId };
}
function targetKey(target) { return target.kind === 'doc' ? `doc:${target.id}` : target.kind === 'web' ? 'web:' + hostname(target.url || '') : target.kind === 'chat' ? `chat:${target.id}` : target.kind; }

function findTabForTarget(chat, target) {
  if (target.kind === 'doc') return chat.tabs.find(t => t.type === 'doc' && t.path.includes(target.id));
  if (target.kind === 'web') return chat.tabs.find(t => t.type === 'web' && hostname(t.url) === hostname(target.url));
  if (target.kind === 'chat') return chat.tabs.find(t => t.type === 'chat' && t.sideChatId === target.id);
  return chat.tabs.find(t => t.type === target.kind);
}

// Open (or reuse) the tab for a target. manual=true means the person asked for it; false means agent activity.
function openTarget(target, chat = currentChat(), manual = true, options = {}) {
  if (!chat) return null;
  savePositions();
  if (manual) pauseFollow(chat);
  let tab = findTabForTarget(chat, target);
  if (!tab && !manual && chat.closedTargets.includes(targetKey(target))) return null; // deliberately closed during this run
  if (!tab) {
    if (target.kind === 'doc') tab = newTab('doc', { title: target.title || documentSummary(target.id, target.source)?.title || 'Document', path: [target.id], source: target.source || 'local' });
    else if (target.kind === 'web') tab = newTab('web', { title: target.title || hostname(target.url), url: target.url });
    else if (target.kind === 'project') tab = newTab('project', { title: target.path ? basename(target.path) : 'Project', file: target.path || '', treeOpen: !target.path });
    else if (target.kind === 'review') tab = newTab('review', { title: 'Review', path: target.path || '' });
    else if (target.kind === 'chat') tab = newTab('chat', { title: target.title || 'New chat', sideChatId: target.id });
    else if (target.kind === 'terminal') tab = newTab('terminal', { title: 'Terminal' });
    chat.tabs.push(tab);
  } else {
    if (target.kind === 'doc' && tab.path.at(-1) !== target.id) tab.path = tab.path.slice(0, tab.path.indexOf(target.id) + 1);
    if (target.kind === 'web' && target.url && tab.url !== target.url) { tab.url = target.url; controllers.get(tab.id)?.navigate(target.url); }
    if (target.kind === 'project' && target.path) { tab.file = target.path; tab.title = basename(target.path); controllers.get(tab.id)?.openFile?.(target.path); }
    if (target.kind === 'review') controllers.get(tab.id)?.refresh();
  }
  const shouldFocus = manual || (chat.following && chat.id === state.current && state.mode === 'chat' && !userIsTyping());
  if (shouldFocus) { chat.active = tab.id; tab.unread = false; }
  else tab.unread = true;
  if (manual && state.mode !== 'chat' && chat.id !== DIRECT) state.mode = 'chat';
  if (options.expand) chat.editorExpanded = true;
  render();
  if (manual && shouldFocus) controllers.get(tab.id)?.focus?.();
  return tab;
}

function attachImages(files) { return mainComposer.attachImages(files); }

function userIsTyping() { const a = document.activeElement; return Boolean(a && a.closest('#bw-workspace') && (a.matches('textarea, input, [contenteditable="true"], .cm-content') || a.closest('.ProseMirror'))); }

function openDocTab(chat, id, source = 'local') { return openTarget({ kind: 'doc', id, source }, chat, true); }

function openNewTab(type) {
  const chat = currentChat();
  if (state.mode === 'document') { state.mode = 'chat'; }
  if (type === 'chat') { const side = newChat({ title: 'Side chat', folder: chat.folder, side: true, parent: chat.id }); Object.assign(side, { parentTitle: chat.title, provider: providerFor(chat), model: chat.model || null, effort: chat.effort || null }); return openTarget({ kind: 'chat', id: side.id, title: 'Side chat' }, chat, true); }
  if (type === 'doc') { savePositions(); pauseFollow(chat); const tab = newTab('doc', { title: 'Choose a document', path: [], source: 'local' }); chat.tabs.push(tab); chat.active = tab.id; render(); return openPalette('documents '); }
  if (type === 'web') { savePositions(); pauseFollow(chat); const tab = newTab('web', { title: 'Website', url: '' }); chat.tabs.push(tab); chat.active = tab.id; render(); controllers.get(tab.id)?.focus(); return tab; }
  if (type === 'project') return openProject(true);
  if (type === 'review') return openTarget({ kind: 'review' }, chat, true);
  if (type === 'terminal') return openTarget({ kind: 'terminal' }, chat, true);
}

function openProject(expand = false) {
  const chat = currentChat();
  if (!chat.folder) { toast('Give this chat a working folder first.'); return chooseFolder(); }
  return openTarget({ kind: 'project' }, chat, true, { expand });
}

function savePositions() {
  const chat = workspaceChat();
  for (const c of controllers.values()) c.savePosition?.();
  if (chat && chat.id !== DIRECT) { chat.chatScroll = q('#bw-transcript').scrollTop; chat.draft = q('#bw-prompt').value; }
}

// ---------- chats ----------
function switchChat(id) {
  if (!state.chats[id]) return;
  savePositions();
  pauseFollow();
  state.current = id;
  state.mode = 'chat';
  hideMenus();
  render();
  q('#bw-transcript').scrollTop = state.chats[id].chatScroll || 0;
}

function createChat({ folder = null, title = 'New chat' } = {}) {
  savePositions();
  const chat = newChat({ title, folder });
  state.current = chat.id;
  state.mode = 'chat';
  render();
  q('#bw-prompt').focus();
  return chat;
}

function startFolderChat(folder) {
  savePositions();
  const chat = createChat({ folder, title: 'New chat' });
  api.settings.set({ recentFolder: folder }).then(s => { state.settings = s; }).catch(() => {});
  toast(`New chat working in ${basename(folder)}`);
  return chat;
}

async function chooseFolder() { return mainComposer.chooseFolder(); }

const closedSteps = new Set();
function openConversationTarget(target, chat, manual = true) {
  if (state.current !== chat.id) switchChat(chat.id);
  return openTarget(target, chat, manual);
}
function bindTranscript(transcript, chat) {
  transcript.querySelectorAll('[data-event]').forEach(b => { b.onclick = () => { const [mi, ei] = b.dataset.event.split(':').map(Number); const entry = chat.messages[mi]?.events?.[ei]; if (entry) openConversationTarget(entry.target, chat, true); }; });
  transcript.querySelectorAll('[data-approval]').forEach(node => node.querySelectorAll('[data-approve]').forEach(b => { b.onclick = async () => { await respondApproval(chat, node.dataset.approval, b.dataset.approve === '1'); renderChatViews(chat); }; }));
  const latest = transcript.querySelector('#bw-latest');
  if (latest) latest.onclick = () => { const last = chat.events.at(-1); if (last) { chat.following = true; openConversationTarget(last.target, chat, false); focusTab(chat, findTabForTarget(chat, last.target)?.id || chat.active, false); chat.following = true; renderChat(); } };
  transcript.querySelectorAll('a[href]').forEach(a => { a.onclick = e => { e.preventDefault(); openConversationTarget({ kind: 'web', url: a.href, title: hostname(a.href) }, chat, true); }; });
  transcript.querySelectorAll('[data-view-file]').forEach(b => { b.onclick = () => openConversationTarget({ kind: 'project', path: b.dataset.viewFile, title: basename(b.dataset.viewFile) }, chat, true); });
  transcript.querySelectorAll('[data-view-doc]').forEach(b => { b.onclick = () => openConversationTarget({ kind: 'doc', id: b.dataset.viewDoc, source: b.dataset.docSource || 'local' }, chat, true); });
  transcript.querySelectorAll('[data-undo-file]').forEach(b => { b.onclick = async () => { const rel = b.dataset.undoFile; if (!chat.folder) { toast('No working folder on this chat.', 'error'); return; } if (!await askConfirm(`Undo the assistant's change to ${rel}? A tracked file goes back to the last commit; a new file is removed.`, { title: 'Undo this change?', confirm: 'Undo', danger: true })) return; try { const r = await api.git.revertFile(chat.folder, rel); toast(r.action === 'restored' ? `Restored ${r.path} from git` : r.action === 'removed' ? `Removed ${r.path}` : `${r.path} was already gone`); controllers.forEach(c => { if (c.type === 'project') c.refresh(rel); if (c.type === 'review') c.refresh(); }); } catch (error) { toast(errorMessage(error), 'error'); } }; });
  // Remember which steps the person opened across re-renders while a run streams.
  transcript.querySelectorAll('details.bw-step').forEach(d => { const key = chat.id + ':' + d.dataset.step; if (closedSteps.has(key)) d.open = false; d.addEventListener('toggle', () => { if (d.open) closedSteps.delete(key); else closedSteps.add(key); }); });
}
function renderChatViews(chat) {
  if (!chat || chat.id === state.current) renderChat();
  if (chat) for (const c of controllers.values()) if (c.type === 'chat' && c.tab.sideChatId === chat.id) c.render?.();
}
function renderChat() {
  const chat = currentChat();
  if (!chat) return;
  q('#bw-chat-title').textContent = chat.title;
  const transcript = q('#bw-transcript');
  const footer = chat.events.length && !chat.following ? `<button class="bw-follow-action" id="bw-latest">Go to latest activity →</button>` : '';
  const atBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 80;
  transcript.innerHTML = (chat.parent ? `<div class="bw-chat-parent"><button data-parent="${esc(chat.parent)}" ${state.chats[chat.parent] ? '' : 'disabled'}>From ${esc(state.chats[chat.parent]?.title || chat.parentTitle || 'deleted conversation')}</button></div>` : '') + transcriptHtml(chat, { initials: initials(), footer });
  transcript.querySelector('[data-parent]')?.addEventListener('click', () => switchChat(chat.parent));
  bindTranscript(transcript, chat);
  if (atBottom || chat.runId) transcript.scrollTop = transcript.scrollHeight;
  mainComposer?.render();
  q('#bw-run-state').hidden = !chat.runId;
}

function initials() { return 'FJ'; }

function renderSidebar() {
  seedTree();
  renderPages(q('#bw-documents'), {
    openKey: (id, source) => openDirect(id, source),
    openBeside: (id, source) => openDocTab(currentChat(), id, source),
    isOpen: key => { const chat = workspaceChat(); const tab = activeTab(chat); return tab?.type === 'doc' && pageKey(tab.path.at(-1), tab.source) === key; },
    onNewPage: parent => createDocument(parent),
    onNewSubpage: parent => createDocument(parent),
    onImport: async id => { try { const doc = await importPaper(id); openDirect(doc.id); toast('Imported as ' + doc.title); } catch (error) { toast(error.message, 'error'); } },
    onDelete: async id => { const d = state.documents.find(x => x.id === id); if (!d || !await askConfirm(`Delete "${d.title}"? This cannot be undone.`, { title: 'Delete page?', confirm: 'Delete', danger: true })) return; await api.docs.delete(id); for (const c of [...controllers.values()]) if (c.type === 'doc' && c.tab.path.at(-1) === id) closeTab(workspaceChat(), c.tab.id); refreshLibrary(); },
  });
  const recents = q('#bw-recent-chats');
  recents.innerHTML = state.order.map(id => state.chats[id]).filter(Boolean).slice(0, 30).map(c => `<button class="bw-nav ${c.id === state.current && state.mode === 'chat' ? 'selected' : ''}" data-context="${c.id}"><span>${esc(c.title)}<small>${c.parent ? '↳ ' + esc(state.chats[c.parent]?.title || c.parentTitle || 'deleted conversation') + ' · ' : ''}${esc(c.folder ? basename(c.folder) : 'no folder')}${c.runId ? ' · working' : ''} · ${esc(relativeTime(c.updatedAt))}</small></span></button>`).join('');
  recents.querySelectorAll('[data-context]').forEach(b => { b.onclick = () => switchChat(b.dataset.context); b.oncontextmenu = e => { e.preventDefault(); askConfirm(`Delete chat "${state.chats[b.dataset.context].title}"?`, { title: 'Delete chat?', confirm: 'Delete', danger: true }).then(ok => { if (ok) deleteChat(b.dataset.context); }); }; });
  q('#bw-connection').textContent = state.settings?.barkpark?.enabled ? `Barkpark${state.barkparkDocs.length ? ' · ' + state.barkparkDocs.length : ''}` : 'Local';
  q('#bw-connection').title = state.settings?.barkpark?.enabled ? state.settings.barkpark.effectiveServer || state.settings.barkpark.server || 'via bp CLI' : 'Local library';
}

function isOpenDoc(id) { const chat = workspaceChat(); const tab = activeTab(chat); return tab?.type === 'doc' && tab.path.at(-1) === id; }

function deleteChat(id) {
  const chat = state.chats[id];
  if (!chat) return;
  if (chat.tabs.some(t => controllers.get(t.id)?.canClose?.() === false)) return;
  for (const t of chat.tabs) unmountTab(t.id);
  for (const owner of Object.values(state.chats)) {
    const removed = owner.tabs.filter(t => t.type === 'chat' && t.sideChatId === id);
    for (const t of removed) unmountTab(t.id);
    owner.tabs = owner.tabs.filter(t => !removed.includes(t));
    if (removed.some(t => t.id === owner.active)) owner.active = owner.tabs.at(-1)?.id || null;
    if (owner.parent === id) owner.parentTitle = chat.title;
  }
  delete state.chats[id];
  state.order = state.order.filter(x => x !== id);
  if (state.current === id) state.current = state.order[0] || createChat().id;
  render();
}

function openDirect(id, source = 'local') {
  savePositions();
  const direct = directChat();
  direct.folder = currentChat()?.folder || null;
  let tab = direct.tabs.find(t => t.type === 'doc');
  if (!tab) { tab = newTab('doc', { title: 'Document', path: [id], source }); direct.tabs.push(tab); }
  else { tab.path = [id]; tab.source = source; controllers.get(tab.id)?.navigate(); }
  direct.active = tab.id;
  state.mode = 'document';
  state.directTab = tab.id;
  hideMenus();
  render();
}

// ---------- rendering ----------
function render() {
  const chat = currentChat();
  root.dataset.mode = state.mode === 'document' ? 'document' : chat?.editorExpanded ? 'editor' : 'chat';
  renderSidebar(); renderChat(); renderTabs(); renderWorkspace(); renderProjectMenu();
  save();
}

// ---------- menus ----------
// Every popup closes together: the menus (menus.js) and quick open.
function hideMenus() {
  closeMenus();
  const palette = q('#bw-palette');
  if (!palette.hidden) { palette.hidden = true; if (palette.contains(document.activeElement)) q('#bw-prompt').focus(); }
}

function renderNewMenu() {
  q('#bw-new-menu').innerHTML = `<h3>Open in this workspace</h3><button data-new="project">${iconHtml('folder-code')}Project editor</button><button data-new="chat">${iconHtml('message-circle')}New side chat</button><button data-new="web">${iconHtml('globe')}Website</button><button data-new="doc">${iconHtml('file-text')}Document</button><button data-new="review">${iconHtml('git-pull-request')}Code review</button><button data-new="terminal">${iconHtml('terminal')}Terminal</button><p class="bw-menu-hint"><kbd>Ctrl</kbd>+<kbd>K</kbd> quick open · <kbd>Alt</kbd>+<kbd>N</kbd> this menu · <kbd>Alt</kbd>+<kbd>1–9</kbd> switch tab</p>`;
  q('#bw-new-menu').querySelectorAll('[data-new]').forEach(b => { b.onclick = () => { hideMenus(); openNewTab(b.dataset.new); }; });
}

function renderProjectMenu() { mainComposer?.renderProjectMenu(); }

// ---------- favorites ----------
// A favorite is a bookmark for one tab: the document, website, file, review, terminal or side chat it
// showed. It reopens later in whatever chat is current (or in its own chat when it needs that
// chat's working folder), even after the tab was closed.
const FAVORITE_KIND = { doc: 'Document', web: 'Website', project: 'File', review: 'Review', chat: 'Side chat', terminal: 'Terminal' };
function favoriteFor(tab) { const key = favoriteKey(tabToTarget(tab)); return state.favorites.find(f => favoriteKey(f.target) === key); }

function renderFavorites() {
  const menu = q('#bw-fav-menu');
  menu.innerHTML = '<h3>Favorites</h3>' + (state.favorites.length ? state.favorites.map(f => `<div class="bw-fav-row"><button data-open="${f.id}" title="Open ${esc(f.label)}">${iconHtml(TYPE_ICON[f.target.kind] || 'sparkles', 12)}<span><span class="bw-fav-label">${esc(f.label)}</span><small>${esc(FAVORITE_KIND[f.target.kind] || f.target.kind)}${f.target.kind === 'chat' && f.chatTitle ? ' · from ' + esc(f.chatTitle) : f.target.kind === 'doc' && f.target.source === 'barkpark' ? ' · Barkpark' : ''}${f.target.url ? ' · ' + esc(hostname(f.target.url)) : f.target.path ? ' · ' + esc(f.target.path) : ''}</small></span></button><button data-rename="${f.id}" aria-label="Rename" title="Rename">${iconHtml('square-pen', 12)}</button><button data-unfav="${f.id}" aria-label="Remove from favorites" title="Remove">×</button></div>`).join('') : '<p class="bw-small bw-muted" style="padding:4px 9px">Star a tab to keep it here. Favorites reopen later in any chat, even after the tab is closed.</p>');
  menu.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => openFavorite(b.dataset.open); });
  menu.querySelectorAll('[data-rename]').forEach(b => { b.onclick = async () => { const f = state.favorites.find(x => x.id === b.dataset.rename); hideMenus(); const v = await askText({ title: 'Rename favorite', value: f?.label || '', confirm: 'Rename' }); if (f && v) { f.label = v; renderFavorites(); save(); } }; });
  menu.querySelectorAll('[data-unfav]').forEach(b => { b.onclick = () => { state.favorites = state.favorites.filter(f => f.id !== b.dataset.unfav); renderFavorites(); renderTabs(); save(); }; });
}

function toggleFavorite(tabId) {
  const chat = workspaceChat();
  const tab = chat?.tabs.find(t => t.id === tabId);
  if (!tab) return;
  const existing = favoriteFor(tab);
  if (existing) { state.favorites = state.favorites.filter(f => f.id !== existing.id); toast(`Removed “${existing.label}” from favorites`); }
  else {
    state.favorites.unshift({ id: crypto.randomUUID(), label: tab.title, target: tabToTarget(tab), chatId: chat.id, chatTitle: chat.title, folder: chat.folder || null, at: new Date().toISOString() });
    toast(`Added “${tab.title}” to favorites`);
  }
  renderTabs(); renderFavorites(); save();
}

function openFavorite(id) {
  const f = state.favorites.find(x => x.id === id);
  if (!f) return;
  const target = { ...f.target };
  let chat = currentChat();
  const needsFolder = ['project', 'review', 'terminal'].includes(target.kind);
  if (target.kind === 'chat' && !state.chats[target.id]) { toast('That side chat no longer exists.', 'error'); return; }
  if (needsFolder && (!chat?.folder || (f.folder && chat.folder !== f.folder))) {
    const home = state.chats[f.chatId];
    if (home) { state.current = home.id; state.mode = 'chat'; chat = home; }
    else if (!chat?.folder) { toast('This favorite needs a working folder. Choose one for the chat first.', 'error'); return; }
  }
  if (state.mode === 'document') state.mode = 'chat';
  const tab = openTarget(target, chat, true);
  if (tab && f.label) { tab.title = f.label; if (tab.type === 'chat' && state.chats[tab.sideChatId]) state.chats[tab.sideChatId].title = f.label; }
  hideMenus();
  render();
}

// Rename a tab in place (double-click its label). A side chat's rename is the chat's own title.
async function renameTab(chat, tabId, value) {
  const tab = chat?.tabs.find(t => t.id === tabId);
  const title = String(value || '').trim();
  if (!tab || !title || title === tab.title) return;
  tab.title = title;
  if (tab.type === 'chat' && state.chats[tab.sideChatId]) state.chats[tab.sideChatId].title = title;
  // A document tab's name is the document's title, so renaming the tab renames the document.
  if (tab.type === 'doc' && tab.path.at(-1)) {
    const id = tab.path.at(-1);
    try {
      if (tab.source === 'barkpark') await api.barkpark.patchTitle(id, title); else await api.docs.save({ id, title, actor: 'you', summary: 'Renamed' });
      refreshLibrary();
    } catch (error) { toast(errorMessage(error), 'error'); }
  }
  const key = favoriteKey(tabToTarget(tab));
  for (const f of state.favorites) if (favoriteKey(f.target) === key) f.label = title;
  controllers.get(tabId)?.refresh?.();
  render();
}

function startRenameTab(chat, tabId) {
  const label = q(`#bw-tabs [data-tab="${tabId}"] .bw-tab-label`);
  const tab = chat?.tabs.find(t => t.id === tabId);
  if (!label || !tab) return;
  const input = document.createElement('input');
  input.className = 'bw-tab-rename';
  input.value = tab.title;
  input.setAttribute('aria-label', 'Tab name');
  label.closest('.bw-tab')?.classList.add('renaming');
  label.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const finish = commit => { if (done) return; done = true; if (commit) renameTab(chat, tabId, input.value); else renderTabs(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } e.stopPropagation(); });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', e => e.stopPropagation());
}

// ---------- palette ----------
let paletteItems = [];
let paletteIndex = 0;
async function collectPalette(query) {
  const chat = currentChat();
  const items = [];
  const ws = workspaceChat();
  (ws?.tabs || []).forEach(t => items.push({ group: 'Work tabs', icon: TYPE_ICON[t.type], label: t.type === 'doc' ? t.path.map(id => documentSummary(id, t.source)?.title || id).join(' → ') : t.title, hint: t.id === ws.active ? 'Current' : 'Switch', run: () => focusTab(ws, t.id) }));
  state.documents.forEach(d => items.push({ group: 'Documents', icon: 'file-text', label: d.title, hint: 'Open beside chat', run: () => openDocTab(chat, d.id, 'local'), alt: { hint: 'Open alone', run: () => openDirect(d.id, 'local') } }));
  state.barkparkDocs.forEach(d => items.push({ group: 'Barkpark papers', icon: 'cloud', label: d.title, hint: 'Open', run: () => openDocTab(chat, d.id, 'barkpark') }));
  state.order.map(id => state.chats[id]).filter(Boolean).forEach(c => items.push({ group: 'Recent chats', icon: 'message-circle', label: c.title, hint: c.id === state.current ? 'Current' : (c.folder ? basename(c.folder) : 'Switch'), run: () => switchChat(c.id) }));
  items.push({ group: 'New', icon: 'message-circle-plus', label: 'New chat', hint: 'Ctrl+N', run: () => createChat() });
  items.push({ group: 'New', icon: 'file-plus', label: 'New document', hint: 'Ctrl+Shift+N', run: () => createDocument() });
  [['project', 'Project editor'], ['chat', 'Side chat'], ['web', 'Website'], ['review', 'Code review'], ['terminal', 'Terminal']].forEach(([type, label]) => items.push({ group: 'New work tab', icon: TYPE_ICON[type], label, hint: 'New', run: () => openNewTab(type) }));
  items.push({ group: 'Actions', icon: 'folder-open', label: chat?.folder ? 'Change working folder' : 'Choose working folder', hint: chat?.folder ? basename(chat.folder) : '', run: () => chooseFolder() });
  if (activeTab(ws)) items.push({ group: 'Actions', icon: 'star', label: favoriteFor(activeTab(ws)) ? 'Remove this tab from favorites' : 'Add this tab to favorites', hint: activeTab(ws).title, run: () => toggleFavorite(ws.active) });
  state.favorites.forEach(f => items.push({ group: 'Favorites', icon: TYPE_ICON[f.target.kind] || 'sparkles', label: f.label, hint: FAVORITE_KIND[f.target.kind] || f.target.kind, run: () => openFavorite(f.id) }));
  items.push({ group: 'Actions', icon: 'settings-2', label: 'Settings', hint: 'Ctrl+,', run: () => openSettings(applySettings) });
  items.push({ group: 'Actions', icon: 'columns-2', label: 'Reset conversation width to 40%', hint: (state.settings?.chatWidth || 40) + '% now', run: () => setChatWidth(40) });
  if (query.length >= 2 && chat?.folder) {
    try { const hits = await api.files.search(chat.folder, query); hits.slice(0, 8).forEach(h => items.push({ group: 'Files in ' + basename(chat.folder), icon: 'file-code', label: `${h.path}:${h.line}  ${h.text}`, hint: 'Open', run: () => openTarget({ kind: 'project', path: h.path, title: basename(h.path) }, chat, true), noFilter: true })); } catch {}
  }
  if (query.length >= 2) {
    try { const hits = await api.docs.search(query); hits.slice(0, 6).forEach(h => items.push({ group: 'Document text', icon: 'search', label: `${h.title}: ${h.snippet}`, hint: 'Open', run: () => openDocTab(chat, h.id, 'local'), noFilter: true })); } catch {}
  }
  return items;
}

async function renderPalette() {
  const input = q('#bw-palette-input');
  const list = q('#bw-palette-list');
  const query = input.value.trim().toLowerCase();
  const all = await collectPalette(query);
  if (q('#bw-palette').hidden) return;
  paletteItems = all.filter(i => i.noFilter || !query || (i.label + ' ' + i.group + ' ' + i.hint).toLowerCase().includes(query));
  paletteIndex = Math.min(paletteIndex, Math.max(0, paletteItems.length - 1));
  let group = '';
  list.innerHTML = paletteItems.length ? paletteItems.map((i, n) => (group === i.group ? '' : (group = i.group, `<div class="bw-palette-group">${esc(i.group)}</div>`)) + `<button type="button" role="option" data-palette="${n}" aria-selected="${n === paletteIndex}">${iconHtml(i.icon)}<span>${esc(i.label)}</span><small>${esc(i.hint || '')}</small></button>`).join('') : '<div class="bw-palette-empty">Nothing matches. Try a tab, document, chat, file, or action.</div>';
  list.querySelectorAll('[data-palette]').forEach(b => { b.onclick = () => runPalette(Number(b.dataset.palette)); b.onpointermove = () => { if (Number(b.dataset.palette) !== paletteIndex) { paletteIndex = Number(b.dataset.palette); list.querySelectorAll('[data-palette]').forEach(x => x.setAttribute('aria-selected', x === b)); } }; });
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}
function openPalette(prefill = '') { hideMenus(); const palette = q('#bw-palette'); palette.hidden = false; q('#bw-palette-input').value = prefill; paletteIndex = 0; renderPalette(); q('#bw-palette-input').focus(); }
function runPalette(n, alt = false) { const item = paletteItems[n]; if (!item) return; q('#bw-palette').hidden = true; (alt && item.alt ? item.alt.run : item.run)(); }

// ---------- documents ----------
async function refreshLibrary() {
  try { state.documents = await api.docs.list(); } catch (error) { toast(error.message, 'error'); }
  if (state.settings?.barkpark?.enabled) { try { state.barkparkDocs = await api.barkpark.list(); } catch (error) { state.barkparkDocs = []; toast('Barkpark: ' + error.message, 'error'); } } else state.barkparkDocs = [];
  renderSidebar(); renderTabs();
}

async function importPaper(id) {
  const doc = await api.barkpark.import(id);
  addPage(doc.id);
  await refreshLibrary();
  return doc;
}

async function createDocument(parent = null) {
  const title = await askText({ title: parent ? 'New sub-page' : 'New page', label: 'Title', value: 'Untitled', confirm: 'Create' });
  if (title === null) return;
  const doc = await api.docs.create({ title: title || 'Untitled', markdown: '' });
  addPage(doc.id, typeof parent === 'string' ? parent : null);
  await refreshLibrary();
  if (state.mode === 'document') openDirect(doc.id); else openDocTab(currentChat(), doc.id, 'local');
}

// ---------- agent events ----------
api.agent.onEvent(event => handleAgentEvent(event, {
  tool: (chat, ev) => controllers.forEach(c => { if (c.type === 'terminal' && c.chatId === chat.id) c.agentEvent(ev); }),
  render: chat => { renderChatViews(chat); renderSidebar(); },
  renderDelta: renderChatViews,
  activity: (chat, entry, event) => {
    const owner = chat;
    const target = event.target;
    if (target.kind === 'doc' && event.libraryChanged) refreshLibrary();
    if (target.kind === 'doc' && (target.source || 'local') === 'local' && /^Created/.test(event.label || '')) { addPage(target.id); renderSidebar(); }
    openTarget(target, owner, false);
    if (target.kind === 'doc') controllers.forEach(c => { if (c.type === 'doc' && c.tab.path.at(-1) === target.id) c.refresh(target.id); });
    if (target.kind === 'doc' && event.proposalId) setTimeout(() => controllers.forEach(c => { if (c.type === 'doc' && c.tab.path.at(-1) === target.id) c.refresh(target.id); }), 400);
    if (event.fileChanged) controllers.forEach(c => { if (c.type === 'project') c.refresh(event.fileChanged); if (c.type === 'review') c.refresh(); });
    if (target.kind === 'doc' && event.proposalId) refreshLibrary();
  },
  attention: chat => { if (chat.id !== state.current) toast(`"${chat.title}" needs your approval`); },
  libraryChanged: () => refreshLibrary(),
  runChanged: chat => { renderChat(); renderSidebar(); },
}));

// Resize the app-wide navigation independently of each conversation's work split.
function sidebarMaxWidth() { return Math.max(160, Math.min(420, root.clientWidth - 520)); }
function applySidebarWidth(value) {
  const width = Number.isFinite(value) ? Math.min(420, Math.max(160, Math.round(value))) : 200;
  root.style.setProperty('--bw-sidebar-preferred', width + 'px');
  const grip = q('#bw-sidebar-resizer');
  grip.setAttribute('aria-valuemax', sidebarMaxWidth());
  grip.setAttribute('aria-valuenow', Math.round(q('.bw-sidebar').getBoundingClientRect().width));
}
function wireSidebarResize() {
  const grip = q('#bw-sidebar-resizer');
  const width = () => q('.bw-sidebar').getBoundingClientRect().width;
  const change = value => {
    state.settings.sidebarWidth = Math.max(160, Math.min(sidebarMaxWidth(), Math.round(value)));
    applySidebarWidth(state.settings.sidebarWidth);
  };
  const save = () => api.settings.set({ sidebarWidth: state.settings.sidebarWidth }).catch(() => toast('Could not remember the sidebar width.'));
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const startX = e.clientX, startWidth = width();
    root.classList.add('sidebar-resizing');
    const move = ev => change(startWidth + ev.clientX - startX);
    const stop = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', stop);
      grip.removeEventListener('pointercancel', stop);
      grip.removeEventListener('lostpointercapture', stop);
      root.classList.remove('sidebar-resizing');
      if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
      save();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    grip.addEventListener('lostpointercapture', stop);
  });
  grip.addEventListener('dblclick', () => { change(200); save(); });
  grip.addEventListener('keydown', e => {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    change(delta ? width() + delta * (e.shiftKey ? 40 : 10) : e.key === 'Home' ? 200 : sidebarMaxWidth());
    save();
  });
  new ResizeObserver(() => applySidebarWidth(state.settings.sidebarWidth)).observe(root);
}

// ---------- splitter & settings ----------
function applyChatWidth(value) { root.style.setProperty('--bw-chat', value + 'fr'); root.style.setProperty('--bw-work', (100 - value) + 'fr'); q('#bw-splitter').setAttribute('aria-valuenow', value); }
function setChatWidth(value) { const width = Math.min(70, Math.max(30, Math.round(value))); state.settings.chatWidth = width; applyChatWidth(width); persistWidth(); }
let widthTimer = null;
function persistWidth() { clearTimeout(widthTimer); widthTimer = setTimeout(() => api.settings.set({ chatWidth: state.settings.chatWidth }).catch(() => {}), 500); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme === 'system' ? '' : theme; }
function applySettings(patch, live) { if (patch.chatWidth != null) { state.settings.chatWidth = patch.chatWidth; applyChatWidth(patch.chatWidth); } if (patch.theme) applyTheme(patch.theme); if (!live) { refreshLibrary(); renderChat(); for (const c of controllers.values()) if (c.type === 'chat') c.render?.(); } }

function wireSplitter() {
  const splitter = q('#bw-splitter');
  splitter.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); pauseFollow(); splitter.setPointerCapture(e.pointerId);
    const chat = q('.bw-chat').getBoundingClientRect(), right = root.getBoundingClientRect().right;
    root.classList.add('resizing');
    const move = ev => setChatWidth((ev.clientX - chat.left) / (right - chat.left) * 100);
    const stop = () => { splitter.removeEventListener('pointermove', move); root.classList.remove('resizing'); };
    splitter.addEventListener('pointermove', move); splitter.addEventListener('pointerup', stop, { once: true }); splitter.addEventListener('pointercancel', stop, { once: true });
  });
  splitter.addEventListener('dblclick', () => setChatWidth(60));
  splitter.addEventListener('keydown', e => { const d = { ArrowLeft: -5, ArrowRight: 5 }[e.key]; if (d) { e.preventDefault(); setChatWidth(state.settings.chatWidth + d); } else if (e.key === 'Home') setChatWidth(40); });
}

// ---------- events ----------
function wire() {
  wireSidebarResize();
  renderNewMenu();
  q('#bw-plus').onclick = () => toggleMenu('#bw-new-menu', '#bw-plus');
  q('#bw-open-work').onclick = () => toggleMenu('#bw-new-menu', '#bw-open-work');
  q('#bw-favorites').onclick = () => { renderFavorites(); toggleMenu('#bw-fav-menu', '#bw-favorites'); };
  q('#bw-settings').onclick = () => openSettings(applySettings);
  q('#bw-new-chat').onclick = () => createChat();
  q('#bw-new-doc').onclick = () => createDocument();
  mainComposer = mountComposer(q('#bw-compose'), currentChat, {
    render: () => { renderChat(); renderSidebar(); }, changed: renderSidebar,
    folderChanged: chat => { for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); },
    openProject: () => openProject(true), startFolderChat,
  }, true);
  q('#bw-go-chat').onclick = () => { pauseFollow(); root.classList.add('mobile-chat'); q('#bw-prompt').focus(); };
  q('#bw-mobile-back').onclick = () => { if (state.mode === 'document') { state.mode = 'chat'; render(); } root.classList.toggle('mobile-chat'); };
  document.addEventListener('click', e => { const img = e.target.closest('[data-lightbox]'); const box = q('#bw-lightbox'); if (img) { box.querySelector('img').src = img.dataset.lightbox; box.hidden = false; } else if (!box.hidden) box.hidden = true; });
  q('#bw-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const chat = workspaceChat(); if (b.dataset.tab) focusTab(chat, b.dataset.tab); else if (b.dataset.close) closeTab(chat, b.dataset.close); else if (b.dataset.fav) toggleFavorite(b.dataset.fav); });
  q('#bw-tabs').addEventListener('dblclick', e => { const b = e.target.closest('[data-tab]'); if (b) { e.preventDefault(); startRenameTab(workspaceChat(), b.dataset.tab); } });
  q('#bw-tabs').addEventListener('auxclick', e => { const b = e.target.closest('[data-tab]'); if (e.button === 1 && b) { e.preventDefault(); closeTab(workspaceChat(), b.dataset.tab); } });
  q('#bw-tabs').addEventListener('pointerdown', e => { if (e.button === 1) e.preventDefault(); });
  installMenuDismissal();
  setInterval(() => { document.querySelectorAll('.bw-elapsed[data-since]').forEach(n => { n.textContent = formatDuration(Date.now() - new Date(n.dataset.since).getTime()); }); }, 1000);
  root.addEventListener('pointerdown', e => { if (!e.target.closest('.bw-palette')) q('#bw-palette').hidden = true; });
  const paletteInput = q('#bw-palette-input');
  paletteInput.addEventListener('input', () => { paletteIndex = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!paletteItems.length) return; paletteIndex = (paletteIndex + (e.key === 'ArrowDown' ? 1 : paletteItems.length - 1)) % paletteItems.length; renderPalette(); } else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex, e.shiftKey); } else if (e.key === 'Escape') { hideMenus(); } });
  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    // Inside an editor the editor owns Ctrl+K (link) and friends; quick open stays available from everywhere else.
    const inEditor = e.target?.closest?.('bp-paper-canvas, .ProseMirror, .cm-content, textarea.bp-canvas-code-area');
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'k') { if (inEditor && q('#bw-palette').hidden) return; e.preventDefault(); q('#bw-palette').hidden ? openPalette() : hideMenus(); return; }
    if ((e.ctrlKey || e.metaKey) && key === ',') { e.preventDefault(); openSettings(applySettings); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'n') { e.preventDefault(); createChat(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'n') { e.preventDefault(); createDocument(); return; }
    if (e.key === 'Escape') { hideMenus(); return; }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const chat = workspaceChat();
    if (/^[1-9]$/.test(e.key)) { const t = e.key === '9' ? chat.tabs.at(-1) : chat.tabs[Number(e.key) - 1]; if (t) { e.preventDefault(); focusTab(chat, t.id); } }
    else if (key === 'w') { const t = activeTab(chat); if (t) { e.preventDefault(); closeTab(chat, t.id); } }
    else if (key === 'n') { e.preventDefault(); toggleMenu('#bw-new-menu', '#bw-plus'); }
  });
  api.onMenu(command => { if (command === 'new-chat') createChat(); if (command === 'new-document') createDocument(); if (command === 'palette') openPalette(); if (command === 'settings') openSettings(applySettings); if (command === 'close-tab') { const chat = workspaceChat(); if (chat?.active) { closeTab(chat, chat.active); render(); } } });
  window.addEventListener('beforeunload', () => { savePositions(); save.flush(); });
  wireSplitter();
}

// ---------- boot ----------
(async () => {
  renderIcons(root);
  state.settings = await api.settings.get();
  // When a Barkpark is connected, its canvas bundle starts loading now so the first paper tab finds
  // <bp-paper-canvas> defined; unconnected, the first paper tab resolves it (a custom element cannot
  // be redefined, so the bundle must not be pinned to the vendored copy before the connection is known).
  if (state.settings?.barkpark?.enabled) ensureCanvasBundle().catch(() => {});
  applySidebarWidth(state.settings.sidebarWidth);
  applyChatWidth(state.settings.chatWidth || 40);
  applyTheme(state.settings.theme || 'system');
  await load();
  if (!state.chats[DIRECT]) directChat();
  wire();
  await refreshLibrary();
  render();
  if (state.mode === 'chat') q('#bw-transcript').scrollTop = currentChat()?.chatScroll || 0;
  const p = state.settings.providers || {};
  if (!p.claude?.loggedIn && !p.codex?.loggedIn && !state.settings.hasApiKey) setTimeout(() => toast('No assistant sign-in found. Sign in to Claude Code or Codex, or add an API key in Settings (Ctrl+,).'), 800);
})();

// Test and debugging hooks (no UI depends on these).
window.__barkdown = { attachImages,  state, controllers, openTarget, render, refreshLibrary, expandArchive: () => { ensurePages().archiveOpen = true; ensurePages().cloudArchiveOpen = true; renderSidebar(); }, addPage, pagePath, setFolder: folder => { const chat = currentChat(); chat.folder = folder; chat.sessions = {}; for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); render(); }, openProject, openDirect, openPalette, createChat, switchChat };
