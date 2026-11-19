// One id scheme for transcript messages: `<role>-<turn>`. A turn is the attempt id when the message belongs to a
// provider attempt (main/workspace-repository.js#reserve, renderer/src/conversation.js#sendMessage), else a fresh
// UUID. Search hits and anything else that points at a message use this id, never its place in the array, so a
// message deleted or added above it cannot move the pointer to a neighbour.
const turnId = () => globalThis.crypto.randomUUID();

function messageId(role, turn = turnId()) {
  return `${role === 'user' ? 'user' : 'assistant'}-${turn}`;
}

// Messages written before every message had an id get one the same way. True when something changed, so the
// caller saves the workspace once and the ids stay the same from then on.
function assignMessageIds(chats) {
  let changed = false;
  for (const chat of Object.values(chats && typeof chats === 'object' ? chats : {})) {
    for (const message of Array.isArray(chat?.messages) ? chat.messages : []) {
      if (!message || typeof message !== 'object' || (typeof message.id === 'string' && message.id)) continue;
      message.id = messageId(message.role);
      changed = true;
    }
  }
  return changed;
}

module.exports = { messageId, assignMessageIds };
