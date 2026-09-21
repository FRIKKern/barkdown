import { recallComposer, resetComposerHistory } from '../composer-history.js';
// Side chat work tab: a separate conversation with its own transcript and run, inheriting the parent's working folder.
import { el, esc, iconHtml, basename } from '../ui.js';
import { state, save } from '../state.js';
import { transcriptHtml, sendMessage, respondApproval, cancelRun } from '../conversation.js';

export function mountSideChat(tab, host, ctx) {
  const chat = state.chats[tab.sideChatId];
  const pane = el(`<div class="bw-pane"><div class="bw-side-chat"><div><div class="bw-kicker">Side conversation</div><h1 id="title">Think this through.</h1><p class="bw-small bw-muted">A separate conversation beside your main chat, with its own run. It sees the main conversation's latest exchanges, and the main chat can read this one.</p><div class="bw-bound-context" id="ctx"></div></div><div class="bw-side-messages" id="messages"></div><form class="bw-side-compose" id="form"><textarea id="input" aria-label="Side chat message" placeholder="Explore an idea here…"></textarea><div class="row"><span class="bw-small bw-muted" id="state"></span><span class="bw-spacer"></span><button type="button" id="stop" hidden>Stop</button><button class="primary" type="submit">Send</button></div></form></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  if (!chat) { q('#messages').innerHTML = '<p class="bw-error">This side chat no longer exists.</p>'; return { el: pane, type: 'chat', tab, refresh() {}, navigate() {}, savePosition() {}, focus() {}, destroy() { pane.remove(); } }; }

  function render() {
    q('#title').textContent = chat.title && chat.title !== 'Side chat' ? chat.title : 'Think this through.';
    q('#ctx').innerHTML = `${iconHtml('folder-open')}${esc(chat.folder ? basename(chat.folder) : 'No working folder')}`;
    q('#ctx').title = chat.folder || '';
    q('#messages').innerHTML = transcriptHtml(chat, { intro: 'Explore an idea here while keeping the main conversation in place.' }).replaceAll('bw-user-message', 'question').replaceAll('bw-agent-copy', 'reply');
    q('#messages').querySelectorAll('[data-approval]').forEach(node => node.querySelectorAll('[data-approve]').forEach(b => { b.onclick = () => { respondApproval(chat, node.dataset.approval, b.dataset.approve === '1'); render(); }; }));
    q('#messages').querySelectorAll('[data-event]').forEach(b => { b.onclick = () => { const [mi, ei] = b.dataset.event.split(':').map(Number); const entry = chat.messages[mi]?.events?.[ei]; if (entry) ctx.openTarget(entry.target); }; });
    q('#state').textContent = chat.runId ? (chat.workingLabel || 'Working…') : '';
    q('#stop').hidden = !chat.runId;
    q('#input').value = chat.draft || '';
  }

  q('#form').onsubmit = e => { e.preventDefault(); const text = q('#input').value; if (!text.trim() || chat.runId) return; resetComposerHistory(chat); chat.draft = ''; q('#input').value = ''; sendMessage(chat, text, { render: () => { render(); tab.title = chat.title; ctx.tabChanged(tab); }, runChanged: render }); };
  q('#input').addEventListener('input', () => { chat.draft = q('#input').value; save(); });
  q('#input').addEventListener('keydown', e => { if (recallComposer(e, q('#input'), chat, save)) return; if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); q('#form').requestSubmit(); } });
  q('#stop').onclick = () => cancelRun(chat);
  render();

  return {
    el: pane, type: 'chat', tab,
    render,
    refresh() { render(); },
    navigate() { render(); },
    savePosition() { chat.draft = q('#input').value; },
    focus() { q('#input').focus(); },
    destroy() { chat.draft = q('#input').value; pane.remove(); },
  };
}
