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

// A note holds at most this much Markdown (UTF-8 bytes). Barkpark refuses a document over 10 MB and one whose
// searchable text passes Postgres' 1 MB full-text limit; a note's blocks run larger than its Markdown, so 512 KB
// keeps a saved chat well inside both. The exported file is not cut (main/chat-export.js caps it at 4 MB).
const NOTE_MAX_BYTES = 512 * 1024;
const encoder = new TextEncoder();
const bytes = text => encoder.encode(text).length;
const more = n => n === 1 ? '1 more message' : `${n} more messages`;

// The start of `text` in at most `room` bytes, ending at a line break when there is one past `keep` characters.
function head(text, room, keep) {
  let cut = text.slice(0, room); // a UTF-16 unit is at least one byte, so this is never short
  while (bytes(cut) > room) cut = cut.slice(0, cut.length - (bytes(cut) - room));
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1); // never half an emoji
  const line = cut.lastIndexOf('\n');
  return line > keep ? cut.slice(0, line) : cut;
}

// Whole messages from the start while they fit, and the note ends by saying how many were cut, so nothing is
// silently missing. A message over a quarter of the cap (a pasted log, a huge reply) that does not fit is cut
// inside, at a line, with its open code block closed: left out whole, it would take everything after it along.
function capNote(parts, intro) {
  const RESERVE = 200; // the cut line and a fence closer
  let size = bytes(intro) + 1;
  const kept = [];
  for (let i = 0; i < parts.length; i++) {
    const next = bytes(parts[i]) + 2;
    if (size + next <= NOTE_MAX_BYTES) { kept.push(parts[i]); size += next; continue; }
    const room = NOTE_MAX_BYTES - size - RESERVE - 2, label = parts[i].indexOf('\n\n') + 2;
    const rest = parts.length - i - 1;
    if (next > NOTE_MAX_BYTES / 4 && room > label + 1024) kept.push(closeFences(head(parts[i], room, label).trimEnd(), 'paper'), `*…(cut: the rest of this message${rest ? ` and ${more(rest)}` : ''})*`);
    else kept.push(`*…(cut: ${more(parts.length - i)})*`);
    break;
  }
  return kept;
}

// chat: { title, messages, parent? }. parentTitle names a side chat's parent. now: the date on the date line.
// The note's Markdown ('paper') is capped at NOTE_MAX_BYTES.
function chatMarkdown(chat, { target = 'file', parentTitle = null, now = new Date() } = {}) {
  const quote = target === 'file' ? escapeFile : text => String(text ?? '');
  const messages = chat.messages || [];
  const saved = `saved from Barkdown on ${day(now)} · ${count(messages.length)}`;
  const intro = chat.parent ? `Side chat from “${quote(parentTitle || 'deleted conversation')}” · ${saved}` : saved[0].toUpperCase() + saved.slice(1);
  const body = messages.map(message => messageMarkdown(message, quote, target));
  const parts = target === 'file' ? [`# ${quote(chat.title || 'Chat')}`, intro, ...body] : [intro, ...capNote(body, intro)];
  return parts.join('\n\n') + '\n';
}

module.exports = { sidebarOrder, mayAutoTitle, chatMarkdown, NOTE_MAX_BYTES };
