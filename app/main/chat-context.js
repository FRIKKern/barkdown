const crypto = require('node:crypto');

// Dispatch authority excludes draft/navigation changes. Keep the raw saved
// provider here; an effective settings default belongs to the captured settings.
function captureChatContext(chat) {
  if (!chat || typeof chat.id !== 'string') return null;
  const version = chat.contextVersion || 0;
  const sorted = value => Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b));
  const value = { id: chat.id, version, folder: chat.folder || null, provider: chat.provider || null,
    model: chat.model || null, effort: chat.effort || null, parent: chat.parent || null, goalId: chat.goalId || null,
    sessions: sorted(chat.sessions), sessionSeen: sorted(chat.sessionSeen),
    messages: (chat.messages || []).map(m => ({ id: m.id || null, role: m.role, text: m.text || '', images: m.images || [] })), apiHistory: chat.apiHistory || [] };
  return Object.freeze({ version, fingerprint: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') });
}
function assertChatContext(expected, chat) {
  const actual = captureChatContext(chat);
  if (!expected || !actual || expected.version !== actual.version || expected.fingerprint !== actual.fingerprint) {
    throw Object.assign(new Error('Conversation context changed before this turn started. Review the current folder and conversation, then send again.'), { code: 'BARKDOWN_SEND_NOT_STARTED' });
  }
}
module.exports = { captureChatContext, assertChatContext };
