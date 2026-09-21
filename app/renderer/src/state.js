import { composerDraft } from './composer-history.js';
// Workspace state: app-wide navigation plus one workspace per chat. Persisted as a whole to userData/workspace.json.
import { uid, debounce } from './ui.js';

const api = window.barkdown;

export const state = {
  chats: {},
  order: [],
  favorites: [],
  pages: null,
  current: null,
  mode: 'chat', // chat | document | editor
  directTab: null,
  settings: null,
  documents: [],
  barkparkDocs: [],
  loaded: false,
};

export function newChat({ title = 'New chat', folder = null, side = false, parent = null } = {}) {
  const now = new Date().toISOString();
  const chat = { id: uid(), title, createdAt: now, updatedAt: now, folder, messages: [], apiHistory: [], events: [], tabs: [], active: null, draft: '', following: true, editorExpanded: false, chatScroll: 0, side, parent, runId: null, closedTargets: [] };
  state.chats[chat.id] = chat;
  if (!side) state.order.unshift(chat.id);
  return chat;
}

export function newTab(type, extra = {}) {
  const titles = { doc: 'Document', web: 'Website', review: 'Review', project: 'Project', chat: 'New chat', terminal: 'Terminal' };
  return { id: uid(), type, title: titles[type] || 'Tab', path: [], url: '', file: '', treeOpen: false, scroll: 0, unread: false, ...extra };
}

// A work tab as the target that reopens it later, in any chat: the thing, not the tab record.
export function tabToTarget(t) {
  if (t.type === 'doc') return { kind: 'doc', id: t.path.at(-1), source: t.source || 'local', title: t.title };
  if (t.type === 'web') return { kind: 'web', url: t.url, title: t.title };
  if (t.type === 'project') return { kind: 'project', path: t.file || '', title: t.title };
  if (t.type === 'review') return { kind: 'review', path: t.path || '', title: t.title };
  if (t.type === 'chat') return { kind: 'chat', id: t.sideChatId, title: t.title };
  return { kind: t.type, title: t.title };
}
export function favoriteKey(target) { return `${target.kind}:${target.source || ''}:${target.id || target.url || target.path || ''}`; }

export function currentChat() { return state.chats[state.current] || null; }
export function activeTab(chat = currentChat()) { return chat?.tabs.find(t => t.id === chat.active) || null; }

export function touch(chat) { chat.updatedAt = new Date().toISOString(); }

export function serialise() {
  const chats = {};
  for (const [id, chat] of Object.entries(state.chats)) chats[id] = { ...chat, draft: composerDraft(chat), runId: null };
  return { version: 1, chats, order: state.order, favorites: state.favorites, pages: state.pages, current: state.current, mode: state.mode, directTab: state.directTab };
}

export const save = debounce(() => { api.state.save(serialise()).catch(error => console.warn('save failed', error)); }, 400);

export async function load() {
  const data = await api.state.load();
  if (data && data.version === 1) {
    state.chats = data.chats || {};
    state.order = (data.order || []).filter(id => state.chats[id]);
    state.favorites = data.favorites || (data.pins || []).map(pin => { const tab = (pin.tabs || []).find(t => t.id === pin.active) || (pin.tabs || [])[0]; return tab ? { id: pin.id, label: pin.label || tab.title, target: tabToTarget(tab), chatId: pin.chatId, chatTitle: pin.rootTitle, folder: pin.folder, at: pin.at } : null; }).filter(Boolean);
    state.pages = data.pages || null;
    state.current = state.chats[data.current] ? data.current : state.order[0] || null;
    state.mode = data.mode === 'document' && data.directTab ? 'document' : 'chat';
    state.directTab = data.directTab || null;
    for (const chat of Object.values(state.chats)) { chat.runId = null; chat.closedTargets = chat.closedTargets || []; chat.apiHistory = chat.apiHistory || []; }
  }
  if (!state.order.length) {
    const chat = newChat({ title: 'Shaping Barkdown' });
    state.current = chat.id;
  }
  state.loaded = true;
  return state;
}

export function chatTitleFrom(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 42 ? clean.slice(0, 40).replace(/\s+\S*$/, '') + '…' : clean;
}
