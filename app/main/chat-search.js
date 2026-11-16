// Quick open's search inside chats. Reads one profile's workspace.json (the caller passes that
// profile's store; this module never picks a profile) and finds words in the person's messages and
// the assistant's replies, side chats included. Read only: nothing here writes.
//
// A profile with many long chats has a large workspace.json, so the parsed text is kept per file
// and rebuilt only when the file's identity, size or modification time changes. Results are
// capped. Snippets are raw text with the match's offsets; the renderer escapes them.
const fs = require('fs');

const MIN_QUERY = 2;
const SNIPPET_BEFORE = 40;
const SNIPPET_LENGTH = 150;
const CACHE_MAX = 4;

function createChatSearch() {
  const cache = new Map(); // file path -> { key, chats }

  async function index(store) {
    let file;
    try { file = store.filePath('workspace.json'); } catch { return []; }
    let stat;
    try { stat = await fs.promises.stat(file); } catch { return []; }
    const key = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
    const known = cache.get(file);
    if (known?.key === key) return known.chats;
    let ws;
    try { ws = JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch { return []; }
    const chats = build(ws);
    cache.delete(file); cache.set(file, { key, chats });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return chats;
  }

  function build(ws) {
    const all = ws && typeof ws.chats === 'object' && ws.chats ? ws.chats : {};
    const deleted = ws?.ownership?.deletedChats || {};
    return Object.values(all)
      .filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages) && !deleted[c.id])
      .map(c => ({
        id: c.id,
        title: String(c.title || 'Untitled chat'),
        side: Boolean(c.side),
        parentTitle: c.side ? String(all[c.parent]?.title || c.parentTitle || '') : '',
        updatedAt: String(c.updatedAt || ''),
        messages: c.messages.map((m, i) => {
          const role = m?.role === 'user' ? 'user' : m?.role === 'assistant' ? 'assistant' : null;
          const text = role && typeof m.text === 'string' ? m.text : '';
          return text ? { i, role, text, lower: text.toLowerCase() } : null;
        }).filter(Boolean),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  // Where the first word sits in the original text. toLowerCase can change a string's length
  // (rare letters such as İ); then the position is found again in the original.
  function locate(message, word) {
    const at = message.lower.indexOf(word);
    if (message.lower.length === message.text.length) return { at, length: word.length };
    const match = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').exec(message.text);
    return match ? { at: match.index, length: match[0].length } : { at: 0, length: 0 };
  }

  function snippet(message, word) {
    const { at, length } = locate(message, word);
    const text = message.text;
    let start = Math.max(0, at - SNIPPET_BEFORE);
    if (start > 0) { const space = text.lastIndexOf(' ', at); if (space > start) start = space + 1; }
    const end = Math.min(text.length, start + SNIPPET_LENGTH);
    const head = start > 0 ? '…' : '', tail = end < text.length ? '…' : '';
    // Whitespace collapses to one space before the match and inside it, so the offsets move with it.
    const squash = value => value.replace(/\s+/g, ' ');
    const before = head + squash(text.slice(start, at)), matched = squash(text.slice(at, at + length));
    const after = squash(text.slice(at + length, end)) + tail;
    return { snippet: before + matched + after, match: { start: before.length, length: matched.length } };
  }

  // Every word of the query must appear in the same message. Newest chat first, newest message first
  // inside a chat; at most `perChat` hits per chat and `limit` in all.
  async function search(store, query, { limit = 12, perChat = 3 } = {}) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (words.join(' ').length < MIN_QUERY) return [];
    const hits = [];
    for (const chat of await index(store)) {
      let found = 0;
      for (let n = chat.messages.length - 1; n >= 0 && found < perChat; n--) {
        const message = chat.messages[n];
        if (!words.every(word => message.lower.includes(word))) continue;
        found++;
        hits.push({ chatId: chat.id, title: chat.title, side: chat.side, parentTitle: chat.parentTitle, messageIndex: message.i, role: message.role, ...snippet(message, words[0]) });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  return { search };
}

module.exports = { createChatSearch };
