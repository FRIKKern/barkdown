// A saved conversation shown beside another, using the same composer and transcript actions.
import { el, esc } from '../ui.js';
import { state } from '../state.js';
import { transcriptHtml } from '../conversation.js';
import { cloneComposer, mountComposer } from '../composer.js';

export function mountSideChat(tab, host, ctx) {
  const chat = state.chats[tab.sideChatId];
  const pane = el(`<div class="bw-pane bw-chat-pane"><div class="bw-side-chat"><header class="bw-side-heading"><span id="title"></span><button id="open-chat" title="Open as the main conversation">Open chat ↗</button></header><div class="bw-chat-parent" id="parent"></div><div class="bw-transcript bw-side-messages" id="messages"></div></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  if (!chat) { q('#messages').textContent = 'This conversation no longer exists.'; return {el:pane,type:'chat',tab,render(){},destroy(){pane.remove();}}; }
  const form = cloneComposer(); q('.bw-side-chat').append(form);
  const composer = mountComposer(form, () => chat, {
    render: () => { render(); tab.title = chat.title; ctx.chatChanged(chat); },
    changed: () => ctx.chatChanged(chat),
    folderChanged: ctx.folderChanged,
    openProject: owner => ctx.openChatTarget(owner, {kind:'project'}),
    startFolderChat: ctx.startFolderChat,
  });
  q('#open-chat').onclick = () => ctx.switchChat(chat.id);
  function render() {
    q('#title').textContent = chat.title;
    const parent = state.chats[chat.parent];
    q('#parent').innerHTML = chat.parent ? `<button ${parent ? '' : 'disabled'}>From ${esc(parent?.title || chat.parentTitle || 'deleted conversation')}</button>` : '';
    if (parent) q('#parent button').onclick = () => ctx.switchChat(parent.id);
    const messages = q('#messages'), atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
    const footer = chat.events.length && !chat.following ? '<button class="bw-follow-action" id="bw-latest">Go to latest activity →</button>' : '';
    messages.innerHTML = transcriptHtml(chat, { initials: ctx.initials(), footer });
    ctx.bindTranscript(messages, chat);
    if (atBottom) messages.scrollTop = messages.scrollHeight;
    composer.render();
  }
  render();
  q('#messages').scrollTop = chat.chatScroll || 0;
  return {
    el:pane,type:'chat',tab,render,refresh:render,navigate:render,
    savePosition() { if (!pane.hidden) chat.chatScroll = q('#messages').scrollTop; },
    focus() { form.querySelector('textarea').focus(); },
    destroy() { composer.destroy(); pane.remove(); },
  };
}
