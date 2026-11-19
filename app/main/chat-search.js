// Quick open's search inside chats. Reads one profile's workspace.json (the caller passes that
// profile's store; this module never picks a profile) and finds words in the person's messages and
// the assistant's replies, side chats included. Read only: nothing here writes.
//
// A profile with many long chats has a large workspace.json (50 MB parses in about 300 ms), and a
// running reply rewrites it often. So the parsed text is kept per file and rebuilt only when the
// file's identity, size or time changed and the kept copy is older than REFRESH_MS; keystrokes
// that arrive while a rebuild is under way share it. What is kept, across all profiles, is capped at
// CACHE_BYTES (the oldest copy goes first); a single profile whose text is larger than that is not
// kept and is read again on each search. Results are capped. A hit names its message by id
// (shared/message-id.js), never by its place in the chat. Snippets are raw text with the match's
// offsets; the renderer escapes them. The internal 'direct' chat is not searched.
const fs = require('fs');

const MIN_QUERY = 2;
const SNIPPET_BEFORE = 40;
const SNIPPET_LENGTH = 150;
const CACHE_MAX = 4;
const CACHE_BYTES = 64 * 1024 * 1024;
const REFRESH_MS = 2000;
const DIRECT = 'direct';
// What a kept copy costs: two bytes a character for every kept string, plus each object's own size, so a
// profile of many tiny messages counts what it holds and not only its characters. Measured on Node 22 for
// one-character messages: about 100-125 bytes each besides the characters, and about 360 for each chat.
const MESSAGE_BYTES = 128;
const CHAT_BYTES = 512;
const chars = (...values) => values.reduce((n, value) => n + value.length, 0) * 2;
const bytesOf = chats => chats.reduce((sum, chat) => sum + CHAT_BYTES + chars(chat.id, chat.title, chat.parentTitle, chat.updatedAt)
  + chat.messages.reduce((n, m) => n + MESSAGE_BYTES + chars(m.id, m.text, m.lower), 0), 0);

function createChatSearch({ now = () => Date.now(), cacheBytes = CACHE_BYTES } = {}) {
  const cache = new Map(); // file path -> { key, chats, builtAt, bytes }, oldest first
  const building = new Map(); // file path -> { key, promise }

  async function index(store) {
    let file;
    try { file = store.filePath('workspace.json'); } catch { return []; }
    let stat;
    try { stat = await fs.promises.stat(file); } catch { return []; }
    const key = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
    const known = cache.get(file);
    if (known && (known.key === key || now() - known.builtAt < REFRESH_MS)) return known.chats;
    if (building.get(file)?.key === key) return building.get(file).promise;
    const promise = (async () => {
      let ws;
      try { ws = JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch { return known?.chats || []; }
      const chats = build(ws), bytes = bytesOf(chats);
      cache.delete(file);
      if (bytes <= cacheBytes) cache.set(file, { key, chats, builtAt: now(), bytes });
      let kept = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
      while (cache.size > CACHE_MAX || kept > cacheBytes) { const [oldest, entry] = cache.entries().next().value; kept -= entry.bytes; cache.delete(oldest); }
      return chats;
    })();
    building.set(file, { key, promise });
    try { return await promise; } finally { if (building.get(file)?.promise === promise) building.delete(file); }
  }

  function build(ws) {
    const all = ws && typeof ws.chats === 'object' && ws.chats ? ws.chats : {};
    const deleted = ws?.ownership?.deletedChats || {};
    return Object.values(all)
      .filter(c => c && typeof c.id === 'string' && c.id !== DIRECT && Array.isArray(c.messages) && !deleted[c.id])
      .map(c => ({
        id: c.id,
        title: String(c.title || 'Untitled chat'),
        side: Boolean(c.side),
        parentTitle: c.side ? String(all[c.parent]?.title || c.parentTitle || '') : '',
        updatedAt: String(c.updatedAt || ''),
        // A message without an id (saved before ids, and not loaded since) cannot be pointed at, so it is not a hit.
        messages: c.messages.map(m => {
          const role = m?.role === 'user' ? 'user' : m?.role === 'assistant' ? 'assistant' : null;
          const text = role && typeof m.text === 'string' && typeof m.id === 'string' && m.id ? m.text : '';
          return text ? { id: m.id, role, text, lower: text.toLowerCase() } : null;
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
        hits.push({ chatId: chat.id, title: chat.title, side: chat.side, parentTitle: chat.parentTitle, messageId: message.id, role: message.role, ...snippet(message, words[0]) });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  return { search, keptBytes: () => [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0), keptFiles: () => [...cache.keys()] };
}

module.exports = { createChatSearch, CACHE_BYTES, MESSAGE_BYTES, CHAT_BYTES };
