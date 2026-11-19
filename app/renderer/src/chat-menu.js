// The chat list in the sidebar and each chat's menu: right-click a row, or its "…" button (shown on hover or
// keyboard focus). Rename…, Pin to top / Unpin, Save as a note, Export as Markdown…, Delete…. The menu opens
// through menus.js, so Escape, arrows, outside clicks and the look match every other menu.
//
// - Rename sets `named`, so the first message never replaces a title the person chose (shared/chat-menu.js).
// - Pins are `pinnedAt` on the chat, saved with the workspace like its other fields; pinned chats list first
//   in the order they were pinned. A workspace saved before pins existed simply has none.
// - Save as a note keeps New page's rules through clip-note.js in its own slot: the request and its Markdown are
//   saved before main is asked, a retry reuses them, two quick presses make one note, and a result that lands
//   after a profile or library switch is dropped. A request main refuses for good is dropped with the reason;
//   an unconfirmed one shows in Pages with Retry and Discard. The note's Markdown is capped (shared/chat-menu.js).
// - Export as Markdown asks main for the save dialog; main writes only the file the person picked.
import { el, esc, iconHtml, toast, errorMessage, basename, relativeTime } from './ui.js';
import { toggleMenu, hideMenus } from './menus.js';
import { askText, askConfirm } from './dialogs.js';
import { createClipAction } from './clip-note.js';
import { chatMarkdown, sidebarOrder } from '../../shared/chat-menu.js';

const LIMIT = 30;
const REASONS = {
  empty: ['No messages', 'This chat has no messages to save yet.'],
  running: ['Replying…', 'Save or export once the reply has finished.'],
  library: ['Library off', 'Saving a chat as a note needs this profile’s local library. Turn it on in Settings › Barkpark.'],
};

// deps: state, api, serialise, render, refresh (library), pages, place(note), openNote(note, chatId), deleteChat(id), switchChat(id).
export function createChatMenu(deps) {
  const { state, api } = deps;
  let menu = null, rendered = '';
  const parentTitle = chat => state.chats[chat.parent]?.title || chat.parentTitle || null;
  const markdown = (chat, target) => chatMarkdown(chat, { target, parentTitle: parentTitle(chat) });
  const libraryReady = () => Boolean(state.profileId && state.settings?.barkpark?.local?.enabled);
  const blocked = (chat, act) => {
    if (act !== 'note' && act !== 'export') return null;
    if (!chat.messages?.length) return 'empty';
    if (chat.runId) return 'running';
    return act === 'note' && !libraryReady() ? 'library' : null;
  };

  // The request remembers its chat, so a retry from Pages opens the note beside the chat it came from; if that
  // chat is gone, beside the current one. A press on another chat while one chat's request is kept checks that
  // request quietly (it lands in Pages; the screen stays on the chat pressed), then saves the pressed chat.
  const named = id => state.chats[id]?.title ? `“${state.chats[id].title}”` : null;
  const saveNote = createClipAction({ state, api, serialise: deps.serialise, pages: deps.pages, refresh: deps.refresh, render: deps.render, place: deps.place,
    slot: 'chatNoteCreation', lenient: true, notice: 'chat-note', unavailable: () => libraryReady() ? null : REASONS.library[1], remember: chatId => (typeof chatId === 'string' ? { chatId } : {}),
    passOn: (intent, chatId) => typeof chatId === 'string' && intent.chatId !== chatId,
    words: { earlier: 'The earlier chat note', saving: 'Saving the chat as a note', notice: 'Chat note not confirmed.', dropped: 'Dropped the unconfirmed chat note. Save as a note makes a new one.',
      held: (intent, chatId, dropped) => `${named(chatId) || 'This chat'} was not saved. Press Save as a note on ${named(chatId) || 'it'} again${dropped ? '.' : `: it checks the earlier note${named(intent.chatId) ? ' of ' + named(intent.chatId) : ''} first, then saves ${named(chatId) || 'this chat'}.`}` },
    open: (note, chatId, intent) => deps.openNote(note, [intent?.chatId, chatId, state.current].find(id => id && state.chats[id])),
    done: (note, intent, earlier, retried, quiet) => toast(!earlier ? `Saved as a note: ${note.title || intent.title || 'Untitled'}`
      : quiet ? `Saved the earlier note of ${named(intent.chatId) || 'another chat'}, which was not confirmed: ${note.title || intent.title}. It is in Pages.`
      : retried ? `Saved the earlier chat note: ${note.title || intent.title}.`
      : `Saved this chat’s earlier note, which was not confirmed: ${note.title || intent.title}.`),
    report: message => toast(message, 'error', 8000) });

  async function rename(chat) {
    const title = await askText({ title: 'Rename chat', value: chat.title, confirm: 'Rename' });
    if (title === null || state.chats[chat.id] !== chat) return;
    if (!title) { toast('A chat needs a name. The old name is kept.', 'error'); return; }
    chat.title = title.slice(0, 120);
    chat.named = true;
    for (const other of Object.values(state.chats)) if (other.parent === chat.id) other.parentTitle = chat.title;
    for (const favorite of state.favorites) {
      if (favorite.chatId === chat.id) favorite.chatTitle = chat.title;
      if (favorite.target?.kind === 'chat' && favorite.target.id === chat.id) favorite.label = chat.title;
    }
    deps.render();
  }

  function togglePin(chat) {
    chat.pinnedAt = chat.pinnedAt ? null : new Date().toISOString();
    deps.render();
  }

  async function exportFile(chat) {
    try {
      const result = await api.chats.exportMarkdown({ title: chat.title, markdown: markdown(chat, 'file') });
      if (result) toast('Exported to ' + basename(result.filePath));
    } catch (error) { toast('Could not export: ' + errorMessage(error), 'error'); }
  }

  async function remove(chat) {
    if (await askConfirm(`Delete chat "${chat.title}"?`, { title: 'Delete chat?', confirm: 'Delete', danger: true })) deps.deleteChat(chat.id);
  }

  function run(chat, act) {
    const reason = blocked(chat, act);
    if (reason) return toast(REASONS[reason][1], 'error');
    if (act === 'rename') return rename(chat);
    if (act === 'pin') return togglePin(chat);
    if (act === 'note') return saveNote(async () => ({ title: chat.title, markdown: markdown(chat, 'paper') }), chat.id);
    if (act === 'export') return exportFile(chat);
    if (act === 'delete') return remove(chat);
  }

  function itemsHtml(chat) {
    const item = (act, icon, label, extra = '') => {
      const reason = blocked(chat, act);
      return `<button type="button" role="menuitem" data-chat-act="${act}" ${reason ? `disabled title="${esc(REASONS[reason][1])}"` : ''} ${extra}>${iconHtml(icon)}${esc(label)}${reason ? `<small>${esc(REASONS[reason][0])}</small>` : ''}</button>`;
    };
    return item('rename', 'square-pen', 'Rename…') + item('pin', chat.pinnedAt ? 'pin-off' : 'pin', chat.pinnedAt ? 'Unpin' : 'Pin to top')
      + '<hr>' + item('note', 'notebook-pen', 'Save as a note') + item('export', 'download', 'Export as Markdown…')
      + '<hr>' + item('delete', 'trash', 'Delete…', 'class="danger"');
  }

  // Open the menu for one chat against `anchor` (its "…" button). A right-click always opens it.
  function open(chatId, anchor, { reopen = false } = {}) {
    const chat = state.chats[chatId];
    if (!chat) return;
    if (!menu) { menu = el('<div class="bw-menu bw-chat-menu" role="menu" aria-label="Chat actions" hidden></div>'); document.getElementById('app').appendChild(menu); }
    if (reopen) hideMenus();
    menu.innerHTML = itemsHtml(chat);
    menu.dataset.chat = chatId;
    menu.querySelectorAll('[data-chat-act]').forEach(button => { button.onclick = () => { hideMenus(); run(chat, button.dataset.chatAct); }; });
    toggleMenu(menu, anchor);
  }

  // The rows. The list is redrawn only when it changed, so an open menu keeps its anchor; when it did change
  // under an open menu, the menu closes rather than point at a row that is gone.
  function renderList(host) {
    const html = sidebarOrder(state.order, state.chats).slice(0, LIMIT).map(chat => {
      const where = `${chat.parent ? '↳ ' + esc(parentTitle(chat) || 'deleted conversation') + ' · ' : ''}${esc(chat.folder ? basename(chat.folder) : 'no folder')}${chat.runId ? ' · working' : ''} · ${esc(relativeTime(chat.updatedAt))}`;
      const pin = chat.pinnedAt ? `<span class="bw-chat-pin" title="Pinned" aria-label="Pinned">${iconHtml('pin', 11)}</span>` : '';
      return `<div class="bw-chat-row${chat.pinnedAt ? ' pinned' : ''}"><button class="bw-nav ${chat.id === state.current && state.mode === 'chat' ? 'selected' : ''}" data-context="${esc(chat.id)}"><span>${esc(chat.title)}<small>${where}</small></span>${pin}</button><button type="button" class="bw-chat-more" data-chat-menu="${esc(chat.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(chat.title)}" title="Chat actions">${iconHtml('ellipsis', 13)}</button></div>`;
    }).join('');
    if (html === rendered && host.childElementCount) return;
    if (menu && !menu.hidden) hideMenus();
    rendered = html;
    host.innerHTML = html;
    host.querySelectorAll('[data-context]').forEach(row => {
      row.onclick = () => deps.switchChat(row.dataset.context);
      row.oncontextmenu = event => { event.preventDefault(); open(row.dataset.context, row.parentElement.querySelector('[data-chat-menu]'), { reopen: true }); };
    });
    host.querySelectorAll('[data-chat-menu]').forEach(button => { button.onclick = () => open(button.dataset.chatMenu, button); });
  }

  return { renderList, open, saveNote };
}
