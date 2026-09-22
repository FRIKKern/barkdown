// The main process owns durable transcripts; an older response must still yield
// to renderer actions or stream events that happened while it was in flight.
const stamp = chat => JSON.stringify([chat.folder, chat.provider, chat.model, chat.effort, chat.sessions, chat.sessionSeen,
  chat.runId, chat.runProvider, chat.interruption, chat.messages.map(message => [message.id, message.runId, message.lastSequence, message.text, message.streaming])]);
const managed = ['messages', 'events', 'apiHistory', 'sessions', 'sessionSeen', 'runId', 'runProvider', 'workingLabel', 'goalId', 'interruption'];
export function captureManagedView(state) {
  return new Map(Object.entries(state.chats).map(([id, chat]) => [id, stamp(chat)]));
}
export function mergeManagedView(state, data, before) {
  for (const [id, saved] of Object.entries(data.chats)) {
    // A chat deleted during this request must not be resurrected by its response.
    if (!state.chats[id] && before.has(id)) continue;
    if (!state.chats[id]) state.chats[id] = saved;
    else if (before.get(id) === stamp(state.chats[id])) {
      for (const key of managed) if (Object.hasOwn(saved, key)) state.chats[id][key] = saved[key];
    }
    if (id !== 'direct' && !state.order.includes(id)) state.order.push(id);
  }
}
