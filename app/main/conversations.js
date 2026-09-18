// Cross-chat awareness. Every chat (the main conversation and its side chats) is persisted by the
// renderer in workspace.json; this module reads that file so a run can see the other conversations:
// a side chat gets the main conversation's latest exchanges as context, the main chat can list and
// read its side chats, and the document tools expose the same through list_conversations and
// read_conversation. Read-only; nothing here writes.
const store = require('./store');

const LIST_MAX = 30;

function workspace() { return store.readJson('workspace.json', null) || { chats: {}, order: [] }; }

function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function ago(iso) {
  const ms = Date.now() - new Date(iso || 0).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function describe(chat, all) {
  const messages = chat.messages || [];
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const lastReply = [...messages].reverse().find(m => m.role === 'assistant' && m.text);
  const parent = chat.parent ? all[chat.parent] : null;
  return {
    id: chat.id,
    title: chat.title,
    kind: chat.side ? 'side chat' : 'main chat',
    parent: parent ? { id: parent.id, title: parent.title } : undefined,
    sideChats: Object.values(all).filter(c => c.side && c.parent === chat.id).map(c => ({ id: c.id, title: c.title })),
    folder: chat.folder || null,
    updated: chat.updatedAt,
    messages: messages.length,
    running: Boolean(chat.runId),
    tabs: (chat.tabs || []).map(t => t.title).filter(Boolean),
    lastQuestion: lastUser ? clip(lastUser.text || (lastUser.images?.length ? '(image)' : ''), 160) : '',
    lastReply: lastReply ? clip(lastReply.text, 200) : '',
  };
}

// Every conversation, newest first, with a one-line summary of where it stands.
function listConversations() {
  const ws = workspace();
  const all = ws.chats || {};
  return Object.values(all)
    .filter(c => c && Array.isArray(c.messages))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, LIST_MAX)
    .map(c => describe(c, all));
}

function messageLine(m, perMessage) {
  if (m.role === 'user') return `You (${ago(m.at)}): ${clip(m.text || '', perMessage)}${m.images?.length ? ` [${m.images.length} image(s) attached]` : ''}`;
  const tools = (m.tools || []).map(t => t.tool).filter(Boolean);
  const events = (m.events || []).map(e => e.label).filter(Boolean);
  const notes = [];
  if (tools.length) notes.push(`tools: ${[...new Set(tools)].slice(0, 8).join(', ')}`);
  if (events.length) notes.push(`opened: ${[...new Set(events)].slice(0, 6).join('; ')}`);
  const body = clip(m.text || (m.streaming ? '(still writing)' : ''), perMessage);
  return `Barkdown (${ago(m.at)}): ${body}${notes.length ? ` [${notes.join(' · ')}]` : ''}`;
}

// One conversation as a readable transcript: the last `limit` messages, each trimmed.
function readConversation(id, { limit = 24, perMessage = 1500 } = {}) {
  const ws = workspace();
  const all = ws.chats || {};
  const chat = all[id];
  if (!chat) return null;
  const head = describe(chat, all);
  const messages = (chat.messages || []).slice(-limit);
  const lines = [
    `# ${chat.title} (${head.kind}${head.parent ? `, opened from "${head.parent.title}"` : ''})`,
    `id: ${chat.id} · ${head.messages} message(s) · updated ${ago(chat.updatedAt)}${chat.folder ? ` · working folder ${chat.folder}` : ''}${head.running ? ' · a run is in progress' : ''}`,
    head.tabs.length ? `open beside it: ${head.tabs.join(', ')}` : '',
    head.sideChats.length ? `side chats: ${head.sideChats.map(s => `${s.title} (${s.id})`).join(', ')}` : '',
    '',
    ...messages.map(m => messageLine(m, perMessage)),
  ].filter(line => line !== undefined);
  return lines.join('\n');
}

// The note a run receives about the conversations around it. A side chat hears the main
// conversation's latest exchanges; a main chat hears what its side chats are doing. Bounded so it
// never crowds the person's own message. Empty when there is nothing to tell.
function contextNote(chatId, { budget = 3500 } = {}) {
  const ws = workspace();
  const all = ws.chats || {};
  const chat = all[chatId];
  if (!chat) return '';
  const parts = [];
  if (chat.side && all[chat.parent]) {
    const parent = all[chat.parent];
    const recent = (parent.messages || []).filter(m => m.text || m.images?.length).slice(-6);
    parts.push(`This is a side chat opened from the main conversation "${parent.title}" (id ${parent.id}). Its latest exchanges:`);
    parts.push(...recent.map(m => '  ' + messageLine(m, 500)));
    if ((parent.tabs || []).length) parts.push(`  Open beside it: ${parent.tabs.map(t => t.title).filter(Boolean).join(', ')}.`);
    parts.push('Use read_conversation with that id for the full transcript. Other side chats of the same conversation appear in list_conversations.');
  } else {
    const sides = Object.values(all).filter(c => c.side && c.parent === chat.id && (c.messages || []).length);
    if (sides.length) {
      parts.push(`Side chats open beside this conversation (read one with read_conversation):`);
      for (const side of sides.slice(-4)) {
        const d = describe(side, all);
        parts.push(`  ${side.title} (id ${side.id}, ${d.messages} messages, ${ago(side.updatedAt)}): last question "${d.lastQuestion}"${d.lastReply ? ` · last reply "${clip(d.lastReply, 160)}"` : ''}`);
      }
    }
  }
  if (!parts.length) return '';
  let note = parts.join('\n');
  if (note.length > budget) note = note.slice(0, budget - 1) + '…';
  return note;
}

module.exports = { listConversations, readConversation, contextNote };
