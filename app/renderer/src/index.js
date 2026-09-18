// Barkdown desktop renderer: app-wide navigation, per-chat workspaces, agent runs, pins, quick open.
import { el, esc, iconHtml, renderIcons, toast, basename, relativeTime } from './ui.js';
import { state, load, save, newChat, newTab, currentChat, activeTab, touch, chatTitleFrom } from './state.js';
import { transcriptHtml, sendMessage, handleAgentEvent, respondApproval, cancelRun, PROVIDER_LABEL, providerFor } from './conversation.js';
import { mountDocument } from './tabs/document.js';
import { mountPaper } from './tabs/paper.js';
import { mountWebsite } from './tabs/website.js';
import { mountReview } from './tabs/review.js';
import { mountProject, buffers, dirtyCount } from './tabs/project.js';
import { mountSideChat } from './tabs/sidechat.js';
import { openSettings } from './settings.js';

const api = window.barkdown;
const root = document.getElementById('app');
const q = s => root.querySelector(s);
const TYPE_ICON = { doc: 'file-text', web: 'globe', review: 'git-pull-request', project: 'folder-code', chat: 'message-circle' };
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
    tabChanged: tab => { renderTabs(); save(); },
    documentSummary,
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
  const controller = tab.type === 'doc' ? (tab.source === 'barkpark' ? mountPaper(tab, host, ctx) : mountDocument(tab, host, ctx)) : tab.type === 'web' ? mountWebsite(tab, host, ctx) : tab.type === 'review' ? mountReview(tab, host, ctx) : tab.type === 'project' ? mountProject(tab, host, ctx) : mountSideChat(tab, host, ctx);
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
  q('#bw-splitter').hidden = state.mode !== 'chat' || Boolean(chat.editorExpanded);
}

// ---------- tabs ----------
function renderTabs() {
  const chat = workspaceChat();
  const nav = q('#bw-tabs');
  nav.innerHTML = (chat?.tabs || []).map(t => {
    const dirty = t.type === 'project' && chat.folder && dirtyCount(chat.folder) > 0;
    const title = t.type === 'doc' ? t.path.map(id => documentSummary(id, t.source)?.title || id).join(' → ') : t.type === 'web' ? t.url || t.title : t.title;
    return `<div class="bw-tab ${t.id === chat.active ? 'active' : ''}"><button data-tab="${t.id}" aria-current="${t.id === chat.active ? 'page' : 'false'}" title="${esc(title)}">${iconHtml(TYPE_ICON[t.type])}<span class="bw-tab-label">${esc(t.title)}</span>${t.unread ? '<span class="bw-dot" aria-label="Updated by the assistant"></span>' : dirty ? '<span class="bw-dot bw-dot-dirty" aria-label="Unsaved edits"></span>' : ''}</button><div class="bw-tab-actions"><button data-pin="${t.id}" aria-label="Pin ${esc(t.title)}">${iconHtml('pin', 12)}</button><button data-close="${t.id}" aria-label="Close ${esc(t.title)}">${iconHtml('x', 12)}</button></div></div>`;
  }).join('');
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
  const [removed] = chat.tabs.splice(index, 1);
  const controller = controllers.get(id);
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

function userIsTyping() { const a = document.activeElement; return Boolean(a && a.closest('#bw-workspace') && (a.matches('textarea, input, [contenteditable="true"], .cm-content') || a.closest('.ProseMirror'))); }

function openDocTab(chat, id, source = 'local') { return openTarget({ kind: 'doc', id, source }, chat, true); }

function openNewTab(type) {
  const chat = currentChat();
  if (state.mode === 'document') { state.mode = 'chat'; }
  if (type === 'chat') { const side = newChat({ title: 'Side chat', folder: chat.folder, side: true, parent: chat.id }); return openTarget({ kind: 'chat', id: side.id, title: 'Side chat' }, chat, true); }
  if (type === 'doc') { savePositions(); pauseFollow(chat); const tab = newTab('doc', { title: 'Choose a document', path: [], source: 'local' }); chat.tabs.push(tab); chat.active = tab.id; render(); return openPalette('documents '); }
  if (type === 'web') { savePositions(); pauseFollow(chat); const tab = newTab('web', { title: 'Website', url: '' }); chat.tabs.push(tab); chat.active = tab.id; render(); controllers.get(tab.id)?.focus(); return tab; }
  if (type === 'project') return openProject(true);
  if (type === 'review') return openTarget({ kind: 'review' }, chat, true);
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

async function chooseFolder() {
  const folder = await api.app.pickFolder();
  if (!folder) return null;
  const chat = currentChat();
  chat.folder = folder;
  chat.sessions = {};
  state.settings = await api.settings.set({ recentFolder: folder }).catch(() => state.settings);
  for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.();
  render();
  toast(`This chat's agent now works in ${basename(folder)}`);
  return folder;
}

function renderChat() {
  const chat = currentChat();
  if (!chat) return;
  q('#bw-chat-title').textContent = chat.title;
  const transcript = q('#bw-transcript');
  const footer = chat.events.length && !chat.following ? `<button class="bw-follow-action" id="bw-latest">Go to latest activity →</button>` : '';
  const atBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 80;
  transcript.innerHTML = transcriptHtml(chat, { initials: initials(), footer });
  transcript.querySelectorAll('[data-event]').forEach(b => { b.onclick = () => { const [mi, ei] = b.dataset.event.split(':').map(Number); const entry = chat.messages[mi]?.events?.[ei]; if (entry) openTarget(entry.target, chat, true); }; });
  transcript.querySelectorAll('[data-approval]').forEach(node => node.querySelectorAll('[data-approve]').forEach(b => { b.onclick = async () => { await respondApproval(chat, node.dataset.approval, b.dataset.approve === '1'); renderChat(); }; }));
  const latest = transcript.querySelector('#bw-latest');
  if (latest) latest.onclick = () => { const last = chat.events.at(-1); if (last) { chat.following = true; openTarget(last.target, chat, false); focusTab(chat, findTabForTarget(chat, last.target)?.id || chat.active, false); chat.following = true; renderChat(); } };
  transcript.querySelectorAll('a[href]').forEach(a => { a.onclick = e => { e.preventDefault(); openTarget({ kind: 'web', url: a.href, title: hostname(a.href) }, chat, true); }; });
  if (atBottom || chat.runId) transcript.scrollTop = transcript.scrollHeight;
  q('#bw-prompt').value = chat.draft || '';
  q('#bw-folder-label').textContent = chat.folder ? basename(chat.folder) : 'No working folder';
  q('#bw-folder-context').title = chat.folder || 'Choose an agent working folder for this chat';
  const provider = providerFor(chat);
  const available = state.settings?.providers || {};
  const ready = provider === 'claude' ? available.claude?.loggedIn : provider === 'codex' ? available.codex?.loggedIn : available.api?.hasKey;
  q('#bw-provider-label').textContent = (PROVIDER_LABEL[provider] || provider) + (ready ? '' : ' · not signed in');
  q('#bw-provider').classList.toggle('off', !ready);
  q('#bw-provider').title = ready ? `Runs on ${PROVIDER_LABEL[provider]} using your local login. Click to switch.` : `${PROVIDER_LABEL[provider]} is not available. Click to switch or open Settings.`;
  q('#bw-working').hidden = !chat.runId;
  q('#bw-run-state').hidden = !chat.runId;
  q('#bw-stop').hidden = !chat.runId;
}

function initials() { return 'FJ'; }

function renderSidebar() {
  const docs = q('#bw-documents');
  const localRows = state.documents.map(d => `<button class="bw-nav ${isOpenDoc(d.id) ? 'selected' : ''}" data-direct="${esc(d.id)}" data-source="local" title="${esc(d.excerpt)}">${iconHtml('file-text')}<span>${esc(d.title)}</span>${d.proposals ? '<span class="bw-dot" title="Pending proposal"></span>' : ''}</button>`);
  const bpRows = state.barkparkDocs.map(d => `<button class="bw-nav ${isOpenDoc(d.id) ? 'selected' : ''}" data-direct="${esc(d.id)}" data-source="barkpark" title="${esc(d.excerpt)}">${iconHtml('cloud')}<span>${esc(d.title)}</span><span class="bw-src">bp</span></button>`);
  docs.innerHTML = [...localRows, ...bpRows].join('') || '<p class="bw-small bw-muted" style="padding:6px 8px">No documents yet.</p>';
  docs.querySelectorAll('[data-direct]').forEach(b => { b.onclick = () => openDirect(b.dataset.direct, b.dataset.source); });
  const recents = q('#bw-recent-chats');
  recents.innerHTML = state.order.map(id => state.chats[id]).filter(Boolean).slice(0, 30).map(c => `<button class="bw-nav ${c.id === state.current && state.mode === 'chat' ? 'selected' : ''}" data-context="${c.id}"><span>${esc(c.title)}<small>${esc(c.folder ? basename(c.folder) : 'no folder')}${c.runId ? ' · working' : ''} · ${esc(relativeTime(c.updatedAt))}</small></span></button>`).join('');
  recents.querySelectorAll('[data-context]').forEach(b => { b.onclick = () => switchChat(b.dataset.context); b.oncontextmenu = e => { e.preventDefault(); if (confirm(`Delete chat "${state.chats[b.dataset.context].title}"?`)) deleteChat(b.dataset.context); }; });
  q('#bw-connection').textContent = state.settings?.barkpark?.enabled ? 'Barkpark' : 'Local';
  q('#bw-connection').title = state.settings?.barkpark?.enabled ? state.settings.barkpark.server || 'via bp CLI' : 'Local library';
}

function isOpenDoc(id) { const chat = workspaceChat(); const tab = activeTab(chat); return tab?.type === 'doc' && tab.path.at(-1) === id; }

function deleteChat(id) {
  const chat = state.chats[id];
  if (!chat) return;
  for (const t of chat.tabs) unmountTab(t.id);
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
function hideMenus() {
  ['#bw-new-menu', '#bw-pin-menu', '#bw-project-menu'].forEach(s => { q(s).hidden = true; });
  ['#bw-plus', '#bw-pins', '#bw-folder-context'].forEach(s => q(s).setAttribute('aria-expanded', 'false'));
  const palette = q('#bw-palette');
  if (!palette.hidden) { palette.hidden = true; if (palette.contains(document.activeElement)) q('#bw-prompt').focus(); }
}
function toggleMenu(menu, button) { const open = q(menu).hidden; hideMenus(); q(menu).hidden = !open; q(button).setAttribute('aria-expanded', String(open)); }

function renderNewMenu() {
  q('#bw-new-menu').innerHTML = `<h3>Open in this workspace</h3><button data-new="project">${iconHtml('folder-code')}Project editor</button><button data-new="chat">${iconHtml('message-circle')}New side chat</button><button data-new="web">${iconHtml('globe')}Website</button><button data-new="doc">${iconHtml('file-text')}Document</button><button data-new="review">${iconHtml('git-pull-request')}Code review</button><p class="bw-menu-hint"><kbd>Ctrl</kbd>+<kbd>K</kbd> quick open · <kbd>Alt</kbd>+<kbd>N</kbd> this menu · <kbd>Alt</kbd>+<kbd>1–9</kbd> switch tab</p>`;
  q('#bw-new-menu').querySelectorAll('[data-new]').forEach(b => { b.onclick = () => { hideMenus(); openNewTab(b.dataset.new); }; });
}

function renderProjectMenu() {
  const chat = currentChat();
  if (!chat) return;
  const menu = q('#bw-project-menu');
  const recent = (state.settings?.recentFolders || []).filter(f => f !== chat.folder).slice(0, 5);
  menu.innerHTML = `<h3>Agent working folder</h3><div class="bw-project-location"><b>${esc(chat.folder ? basename(chat.folder) : 'No working folder')}</b>${esc(chat.folder || 'File tools are unavailable until this chat has a folder.')}</div><button data-act="choose">${iconHtml('folder-open')}${chat.folder ? 'Change folder…' : 'Choose folder…'}</button>${chat.folder ? `<button data-act="open">${iconHtml('folder-code')}Open project in editor</button><button data-act="new-chat">${iconHtml('message-circle-plus')}New chat with this folder</button><button data-act="clear">${iconHtml('x')}Remove folder from this chat</button>` : ''}${recent.length ? `<h3>Recent folders</h3>${recent.map(f => `<button data-folder="${esc(f)}" title="${esc(f)}">${iconHtml('folder-open')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(basename(f))}</span></button>`).join('')}` : ''}`;
  menu.querySelector('[data-act="choose"]').onclick = () => { hideMenus(); chooseFolder(); };
  menu.querySelector('[data-act="open"]') && (menu.querySelector('[data-act="open"]').onclick = () => { hideMenus(); openProject(true); });
  menu.querySelector('[data-act="new-chat"]') && (menu.querySelector('[data-act="new-chat"]').onclick = () => { hideMenus(); startFolderChat(chat.folder); });
  menu.querySelector('[data-act="clear"]') && (menu.querySelector('[data-act="clear"]').onclick = () => { hideMenus(); chat.folder = null; render(); });
  menu.querySelectorAll('[data-folder]').forEach(b => { b.onclick = () => { hideMenus(); chat.folder = b.dataset.folder; chat.sessions = {}; for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); render(); }; });
}

// ---------- pins ----------
function renderPins() {
  const menu = q('#bw-pin-menu');
  menu.innerHTML = '<h3>Saved workspaces</h3>' + (state.pins.length ? state.pins.map(p => `<div class="bw-pin-row"><button data-restore="${p.id}">${esc(p.label)}<small>${esc(p.rootTitle)} · ${esc(p.summary)}</small></button><button data-unpin="${p.id}" aria-label="Remove pin">×</button></div>`).join('') : '<p class="bw-small bw-muted" style="padding:4px 9px">Pin a tab to save the chat, its tabs, the focused tab and the document paths.</p>');
  menu.querySelectorAll('[data-restore]').forEach(b => { b.onclick = () => restorePin(b.dataset.restore); });
  menu.querySelectorAll('[data-unpin]').forEach(b => { b.onclick = () => { state.pins = state.pins.filter(p => p.id !== b.dataset.unpin); renderPins(); save(); }; });
}

function addPin(tabId) {
  savePositions();
  const chat = workspaceChat();
  const tab = chat.tabs.find(t => t.id === tabId);
  if (!tab) return;
  const pin = { id: crypto.randomUUID(), label: tab.title, rootTitle: chat.title, chatId: chat.id, mode: state.mode, folder: chat.folder, editorExpanded: chat.editorExpanded, active: tabId, chatScroll: chat.chatScroll, at: new Date().toISOString(),
    tabs: chat.tabs.map(t => ({ ...t, unread: false })), summary: chat.tabs.map(t => t.type === 'doc' ? t.path.map(id => documentSummary(id, t.source)?.title || id).join(' → ') : t.title).join(' / ') };
  state.pins.unshift(pin);
  hideMenus(); renderPins(); q('#bw-pin-menu').hidden = false; q('#bw-pins').setAttribute('aria-expanded', 'true');
  save();
}

function restorePin(id) {
  const pin = state.pins.find(p => p.id === id);
  if (!pin) return;
  const chat = state.chats[pin.chatId];
  if (!chat) { toast('The chat for this pin no longer exists.', 'error'); return; }
  savePositions();
  const restoredTabs = pin.tabs.map(t => ({ ...t, id: chat.tabs.find(x => x.id === t.id)?.id || t.id }));
  // Keep controllers for tabs that still exist; drop the rest.
  for (const t of chat.tabs) if (!restoredTabs.some(r => r.id === t.id)) unmountTab(t.id);
  for (const r of restoredTabs) { const existing = chat.tabs.find(t => t.id === r.id); if (existing) Object.assign(existing, r); }
  chat.tabs = restoredTabs.map(r => chat.tabs.find(t => t.id === r.id) || r);
  chat.active = chat.tabs.some(t => t.id === pin.active) ? pin.active : chat.tabs[0]?.id || null;
  chat.editorExpanded = Boolean(pin.editorExpanded);
  chat.following = false;
  if (pin.mode === 'document') { state.mode = 'document'; } else { state.current = chat.id; state.mode = 'chat'; }
  for (const t of chat.tabs) controllers.get(t.id)?.navigate?.();
  hideMenus();
  render();
  toast('Pin restored. Navigation only; content is whatever it is now.');
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
  [['project', 'Project editor'], ['chat', 'Side chat'], ['web', 'Website'], ['review', 'Code review']].forEach(([type, label]) => items.push({ group: 'New work tab', icon: TYPE_ICON[type], label, hint: 'New', run: () => openNewTab(type) }));
  items.push({ group: 'Actions', icon: 'folder-open', label: chat?.folder ? 'Change working folder' : 'Choose working folder', hint: chat?.folder ? basename(chat.folder) : '', run: () => chooseFolder() });
  if (activeTab(ws)) items.push({ group: 'Actions', icon: 'pin', label: 'Pin this workspace', hint: activeTab(ws).title, run: () => addPin(ws.active) });
  items.push({ group: 'Actions', icon: 'settings-2', label: 'Settings', hint: 'Ctrl+,', run: () => openSettings(applySettings) });
  items.push({ group: 'Actions', icon: 'columns-2', label: 'Reset conversation width to 60%', hint: (state.settings?.chatWidth || 60) + '% now', run: () => setChatWidth(60) });
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

async function createDocument() {
  const title = prompt('Document title', 'Untitled');
  if (title === null) return;
  const doc = await api.docs.create({ title: title.trim() || 'Untitled', markdown: '' });
  await refreshLibrary();
  if (state.mode === 'document') openDirect(doc.id); else openDocTab(currentChat(), doc.id, 'local');
}

// ---------- agent events ----------
api.agent.onEvent(event => handleAgentEvent(event, {
  render: chat => { if (!chat || chat.id === state.current) renderChat(); if (chat?.side) controllers.forEach(c => { if (c.type === 'chat' && c.tab.sideChatId === chat.id) c.render?.(); }); renderSidebar(); },
  renderDelta: chat => { if (chat.id === state.current) { const copy = q('#bw-transcript').querySelectorAll('.bw-agent-copy'); const last = copy[copy.length - 1]; if (last) { renderChat(); } } else if (chat.side) controllers.forEach(c => { if (c.type === 'chat' && c.tab.sideChatId === chat.id) c.render?.(); }); },
  activity: (chat, entry, event) => {
    const owner = chat.side ? state.chats[chat.parent] || chat : chat;
    const target = event.target;
    if (target.kind === 'doc' && event.libraryChanged) refreshLibrary();
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

// ---------- splitter & settings ----------
function applyChatWidth(value) { root.style.setProperty('--bw-chat', value + 'fr'); root.style.setProperty('--bw-work', (100 - value) + 'fr'); q('#bw-splitter').setAttribute('aria-valuenow', value); }
function setChatWidth(value) { const width = Math.min(70, Math.max(40, Math.round(value))); state.settings.chatWidth = width; applyChatWidth(width); persistWidth(); }
let widthTimer = null;
function persistWidth() { clearTimeout(widthTimer); widthTimer = setTimeout(() => api.settings.set({ chatWidth: state.settings.chatWidth }).catch(() => {}), 500); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme === 'system' ? '' : theme; }
function applySettings(patch, live) { if (patch.chatWidth != null) { state.settings.chatWidth = patch.chatWidth; applyChatWidth(patch.chatWidth); } if (patch.theme) applyTheme(patch.theme); if (!live) { refreshLibrary(); renderChat(); } }

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
  splitter.addEventListener('keydown', e => { const d = { ArrowLeft: -5, ArrowRight: 5 }[e.key]; if (d) { e.preventDefault(); setChatWidth(state.settings.chatWidth + d); } else if (e.key === 'Home') setChatWidth(60); });
}

// ---------- events ----------
function wire() {
  renderNewMenu();
  q('#bw-plus').onclick = () => toggleMenu('#bw-new-menu', '#bw-plus');
  q('#bw-pins').onclick = () => { renderPins(); toggleMenu('#bw-pin-menu', '#bw-pins'); };
  q('#bw-settings').onclick = () => openSettings(applySettings);
  q('#bw-new-chat').onclick = () => createChat();
  q('#bw-new-doc').onclick = () => createDocument();
  q('#bw-folder-context').onclick = () => { renderProjectMenu(); toggleMenu('#bw-project-menu', '#bw-folder-context'); };
  q('#bw-provider').onclick = () => { const chat = currentChat(); const order = ['claude', 'codex', 'api']; const current = providerFor(chat); chat.provider = order[(order.indexOf(current) + 1) % order.length]; renderChat(); save(); toast(`This chat now uses ${PROVIDER_LABEL[chat.provider]}`); };
  q('#bw-go-chat').onclick = () => { pauseFollow(); root.classList.add('mobile-chat'); q('#bw-prompt').focus(); };
  q('#bw-mobile-back').onclick = () => { if (state.mode === 'document') { state.mode = 'chat'; render(); } root.classList.toggle('mobile-chat'); };
  q('#bw-stop').onclick = () => cancelRun(currentChat());
  q('#bw-compose').onsubmit = e => { e.preventDefault(); const chat = currentChat(); const text = q('#bw-prompt').value; if (!text.trim()) return; if (chat.runId) { toast('Wait for the current run to finish, or stop it.'); return; } chat.draft = ''; q('#bw-prompt').value = ''; sendMessage(chat, text, { render: () => { renderChat(); renderSidebar(); }, runChanged: () => { renderChat(); renderSidebar(); } }); };
  q('#bw-prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); q('#bw-compose').requestSubmit(); } });
  q('#bw-prompt').addEventListener('input', () => { const chat = currentChat(); if (chat) { chat.draft = q('#bw-prompt').value; save(); } });
  q('#bw-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const chat = workspaceChat(); if (b.dataset.tab) focusTab(chat, b.dataset.tab); else if (b.dataset.close) closeTab(chat, b.dataset.close); else if (b.dataset.pin) addPin(b.dataset.pin); });
  q('#bw-tabs').addEventListener('auxclick', e => { const b = e.target.closest('[data-tab]'); if (e.button === 1 && b) { e.preventDefault(); closeTab(workspaceChat(), b.dataset.tab); } });
  q('#bw-tabs').addEventListener('pointerdown', e => { if (e.button === 1) e.preventDefault(); });
  root.addEventListener('pointerdown', e => { if (!e.target.closest('.bw-menu') && !e.target.closest('#bw-plus') && !e.target.closest('#bw-pins') && !e.target.closest('#bw-folder-context') && !e.target.closest('.bw-palette')) { ['#bw-new-menu', '#bw-pin-menu', '#bw-project-menu'].forEach(s => { q(s).hidden = true; }); if (!e.target.closest('.bw-palette')) q('#bw-palette').hidden = true; } });
  const paletteInput = q('#bw-palette-input');
  paletteInput.addEventListener('input', () => { paletteIndex = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!paletteItems.length) return; paletteIndex = (paletteIndex + (e.key === 'ArrowDown' ? 1 : paletteItems.length - 1)) % paletteItems.length; renderPalette(); } else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex, e.shiftKey); } else if (e.key === 'Escape') { hideMenus(); } });
  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'k') { e.preventDefault(); q('#bw-palette').hidden ? openPalette() : hideMenus(); return; }
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
  api.onMenu(command => { if (command === 'new-chat') createChat(); if (command === 'new-document') createDocument(); if (command === 'palette') openPalette(); if (command === 'settings') openSettings(applySettings); });
  window.addEventListener('beforeunload', () => { savePositions(); save.flush(); });
  wireSplitter();
}

// ---------- boot ----------
(async () => {
  renderIcons(root);
  state.settings = await api.settings.get();
  applyChatWidth(state.settings.chatWidth || 60);
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
window.__barkdown = { state, controllers, openTarget, render, refreshLibrary, setFolder: folder => { const chat = currentChat(); chat.folder = folder; chat.sessions = {}; for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); render(); }, openProject, openDirect, openPalette, createChat, switchChat };
