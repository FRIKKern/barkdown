// Pure pieces of the chat list's menu (renderer/src/chat-menu.js), shared so tests run them without a window:
// the sidebar order with pinned chats first, the rule that a title the person set is never auto-replaced,
// and a conversation as Markdown for Save as a note (target 'paper') and Export as Markdown (target 'file').
//
// The two targets carry the same messages. A file is ordinary Markdown: it opens with the title as a heading
// and escapes the titles it quotes. Paper's converter (shared/markdown.js) has no escapes, so the note's
// body quotes titles as they are and leaves the title to the note's own locked title block.

// Pinned chats first, in the order they were pinned (the first pin stays on top), then the rest in the
// workspace's recent order. A chat without `pinnedAt` (every chat in an older workspace) is unpinned.
function sidebarOrder(order, chats) {
  const list = (order || []).map(id => chats[id]).filter(Boolean);
  const pinned = list.filter(chat => chat.pinnedAt).sort((a, b) => String(a.pinnedAt).localeCompare(String(b.pinnedAt)));
  return [...pinned, ...list.filter(chat => !chat.pinnedAt)];
}

// The first message names a chat only while it still has a default title and nobody renamed it.
function mayAutoTitle(chat) {
  if (chat.named) return false;
  return chat.title === 'New chat' || chat.title === 'Side chat' || (chat.title === 'Shaping Barkdown' && !chat.side);
}

const escapeFile = text => String(text ?? '').replace(/[\\`*_[\]<~|]/g, '\\$&');
const day = now => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const count = n => n === 0 ? 'no messages' : n === 1 ? '1 message' : `${n} messages`;

// A message can end inside a code block (a reply stopped mid-block, a paste with one ``` line). Close it, or
// every later message becomes code. Each target closes by its reader's rule: a file by CommonMark's (a fence
// of ``` or ~~~, closed by the same character at least as long, indented up to three spaces), a note by
// shared/markdown.js's (a line starting ``` toggles code). The file's closer keeps the opener's indent: a fence
// in a list item ("1. Step\n\n   ```bash") must close inside that item, where a column-0 closer would end the
// item and open a new fence instead. A fence indented four or more closes with its list item on its own.
function closeFences(text, target) {
  const lines = text.split('\n');
  if (target === 'paper') return lines.filter(line => /^```/.test(line)).length % 2 ? `${text}\n\`\`\`` : text;
  let open = null; // { indent, fence }
  for (const line of lines) {
    if (!open) {
      const m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
      if (m && !(m[2][0] === '`' && m[3].includes('`'))) open = { indent: m[1], fence: m[2] };
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.fence[0] && m[1].length >= open.fence.length) open = null;
    }
  }
  return open ? `${text}\n${open.indent}${open.fence}` : text;
}

function messageMarkdown(message, quote, target) {
  const parts = [];
  if (message.role === 'user') {
    if (String(message.text || '').trim()) parts.push(closeFences(String(message.text).trim(), target));
    for (const image of message.images || []) parts.push(`*Image: ${quote(image.name || 'attached image')}*`);
    if (!parts.length) parts.push('*Empty message*');
    return `## You\n\n${parts.join('\n\n')}`;
  }
  const text = String(message.text || '').trim();
  if (text) parts.push(closeFences(text, target));
  if (message.error) parts.push(`*${text ? 'Stopped' : 'No reply'}: ${quote(String(message.error).replace(/\s+/g, ' ').trim())}*`);
  else if (!text) parts.push(message.streaming ? '*Reply in progress*' : '*No text in this reply*');
  return `## Barkdown\n\n${parts.join('\n\n')}`;
}

// chat: { title, messages, parent? }. parentTitle names a side chat's parent. now: the date on the date line.
function chatMarkdown(chat, { target = 'file', parentTitle = null, now = new Date() } = {}) {
  const quote = target === 'file' ? escapeFile : text => String(text ?? '');
  const messages = chat.messages || [];
  const saved = `saved from Barkdown on ${day(now)} · ${count(messages.length)}`;
  const intro = chat.parent ? `Side chat from “${quote(parentTitle || 'deleted conversation')}” · ${saved}` : saved[0].toUpperCase() + saved.slice(1);
  const parts = [...(target === 'file' ? [`# ${quote(chat.title || 'Chat')}`] : []), intro, ...messages.map(message => messageMarkdown(message, quote, target))];
  return parts.join('\n\n') + '\n';
}

module.exports = { sidebarOrder, mayAutoTitle, chatMarkdown };
