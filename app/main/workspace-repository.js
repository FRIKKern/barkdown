// The main process is the only writer of managed transcripts. Renderer snapshots
// own navigation/drafts; they cannot replace late provider output or goal attempts.
const crypto = require('node:crypto');
const clone = value => structuredClone(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const NAV = ['title', 'folder', 'tabs', 'active', 'draft', 'draftImages', 'following', 'editorExpanded', 'chatScroll', 'closedTargets', 'provider', 'model', 'effort', 'parent', 'parentTitle', 'side', 'createdAt', 'updatedAt'];
function identifier(id) {
  if (typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid conversation identity');
  return id;
}
function attemptId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new Error('Invalid attempt identity');
  return id;
}
function empty() { return { version: 1, chats: {}, order: [], favorites: [], pages: null, current: null, mode: 'chat', directTab: null }; }
function metadata(ws) {
  if (!ws.ownership) ws.ownership = { version: 1, revision: 0, attempts: {}, deletedChats: {} };
  if (ws.ownership.version !== 1 || !Number.isSafeInteger(ws.ownership.revision) || !object(ws.ownership.attempts) || !object(ws.ownership.deletedChats)) throw new Error('Invalid workspace ownership metadata');
  return ws.ownership;
}
function part(reply, kind) {
  reply.parts ||= [];
  const last = reply.parts.at(-1);
  if (last?.kind === kind && !last.closed) return last;
  const value = { kind, text: '' }; reply.parts.push(value); return value;
}
function closePart(reply) { const last = reply.parts?.at(-1); if (last && last.kind !== 'tool') last.closed = true; }
function applyEvent(chat, reply, event, at) {
  reply.tools ||= []; reply.events ||= []; reply.approvals ||= [];
  switch (event.type) {
    case 'text_delta': reply.text = (reply.text || '') + (event.text || ''); part(reply, 'text').text += event.text || ''; break;
    case 'text_replace': { const p = part(reply, 'text'); reply.text = (reply.text || '').slice(0, (reply.text || '').length - p.text.length) + event.text; p.text = event.text; break; }
    case 'text_break': if (reply.text && !reply.text.endsWith('\n')) reply.text += '\n\n'; closePart(reply); break;
    case 'thinking_delta': part(reply, 'thinking').text += event.text || ''; break;
    case 'thinking_replace': part(reply, 'thinking').text = event.text || ''; break;
    case 'thinking_break': closePart(reply); break;
    case 'status': if (event.model) reply.model = event.model; break;
    case 'usage': reply.usage = { ...(reply.usage || {}), ...clone(event) }; break;
    case 'error_note': reply.notes = [...(reply.notes || []), event.message]; break;
    case 'tool_start': reply.tools.push({ tool: event.tool, input: clone(event.input || {}), kind: event.kind, id: event.toolUseId, done: false }); closePart(reply); (reply.parts ||= []).push({ kind: 'tool', id: event.toolUseId }); break;
    case 'tool_result': { const tool = reply.tools.find(t => t.id === event.toolUseId); if (tool) Object.assign(tool, { done: true, ok: event.ok, preview: event.preview, ...(event.output != null ? { output: event.output } : {}) }); break; }
    case 'activity': { const entry = { label: event.label, detail: event.detail, target: clone(event.target), at }; reply.events.push(entry); (chat.events ||= []).push(entry); break; }
    case 'approval': reply.approvals.push({ approvalId: event.approvalId, runId: event.runId, request: clone(event.request), status: 'pending' }); break;
    case 'error': reply.streaming = false; reply.error = event.message; chat.workingLabel = ''; break;
    case 'done':
      reply.streaming = false; reply.provider = event.provider; reply.finishedAt = at;
      if (event.history) { chat.apiHistory = clone(event.history); chat.messages.filter(m => m.role === 'user').forEach(m => { m.sentInHistory = true; }); }
      if (event.offline) reply.offline = true;
      if (event.session && event.provider) { (chat.sessions ||= {})[event.provider] = event.session; (chat.sessionSeen ||= {})[event.provider] = chat.messages.length; }
      chat.workingLabel = '';
      break;
  }
  chat.updatedAt = at;
}

function createWorkspaceRepository({ registry, now = () => new Date().toISOString() }) {
  function read(profileId) {
    const ws = registry.storeFor(profileId).readJson('workspace.json', null) || empty();
    if (ws.version !== 1 || !object(ws.chats) || !Array.isArray(ws.order)) throw new Error('Invalid workspace; recovery required');
    for (const [id, chat] of Object.entries(ws.chats)) { identifier(id); if (!object(chat) || chat.id !== id || !Array.isArray(chat.messages)) throw new Error('Invalid workspace conversation'); }
    metadata(ws); return ws;
  }
  function write(profileId, ws) { metadata(ws).revision++; registry.storeFor(profileId).writeJson('workspace.json', ws); return clone(ws); }
  function load(profileId) { return clone(read(profileId)); }
  function saveView(profileId, snapshot) {
    if (!object(snapshot) || snapshot.version !== 1 || !object(snapshot.chats) || !Array.isArray(snapshot.order)) throw new Error('Invalid workspace snapshot');
    const ws = read(profileId), meta = metadata(ws);
    for (const [id, view] of Object.entries(snapshot.chats)) {
      identifier(id);
      if (!object(view) || view.id !== id || !Array.isArray(view.messages)) throw new Error('Invalid conversation snapshot');
      if (meta.deletedChats[id]) continue; // a delayed view cannot resurrect a deleted chat
      const chat = ws.chats[id] ||= { id, messages: [], events: [], apiHistory: [], runId: null };
      for (const key of NAV) if (Object.hasOwn(view, key)) chat[key] = clone(view[key]);
      if (chat.parent && !snapshot.chats[chat.parent] && !ws.chats[chat.parent]) chat.parentTitle ||= 'deleted conversation';
    }
    ws.order = [...new Set([...snapshot.order.filter(id => ws.chats[id]), ...ws.order.filter(id => ws.chats[id])])];
    for (const key of ['favorites', 'pages', 'current', 'mode', 'directTab']) if (Object.hasOwn(snapshot, key)) ws[key] = clone(snapshot[key]);
    if (ws.current && !ws.chats[ws.current]) ws.current = ws.order[0] || null;
    return write(profileId, ws);
  }
  function chatFor(ws, id) { identifier(id); const chat = ws.chats[id]; if (!chat) throw new Error('Conversation not found in this profile'); return chat; }
  function requestFingerprint(request) {
    return crypto.createHash('sha256').update(JSON.stringify({ profileId: request.profileId, chatId: request.chatId, coordinatorChatId: request.coordinatorChatId || null,
      goalId: request.goalId || null, taskId: request.taskId || null, prompt: request.prompt || '', images: request.images || [], provider: request.provider || null })).digest('hex');
  }
  function begin(request, resolved) {
    const { profileId, chatId } = request; attemptId(request.attemptId);
    if (resolved?.scope?.profileId !== profileId) throw new Error('Resolved run owner mismatch');
    const ws = read(profileId), meta = metadata(ws), fingerprint = requestFingerprint(request), existing = meta.attempts[request.attemptId];
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('Attempt identity reused for different work');
      return { history: clone(existing.history), fresh: false, assistantId: existing.assistantId, state: existing.status };
    }
    const chat = chatFor(ws, chatId);
    if (Object.values(meta.attempts).some(a => a.chatId === chatId && !a.driverFinished)) throw new Error('This conversation already has an unfinished attempt');
    if (request.coordinatorChatId && chat.parent !== request.coordinatorChatId) throw new Error('Worker parent does not match its coordinator');
    if (request.goalId && chat.goalId !== request.goalId) throw new Error('Worker goal does not match its assignment');
    const at = now(), userId = `user-${request.attemptId}`, assistantId = `assistant-${request.attemptId}`;
    const user = { id: userId, role: 'user', text: String(request.prompt || ''), images: clone(request.images || []), at, attemptId: request.attemptId };
    const reply = { id: assistantId, role: 'assistant', text: '', at, streaming: true, tools: [], events: [], approvals: [], attemptId: request.attemptId };
    chat.messages.push(user, reply);
    const history = chat.apiHistory?.length ? [...clone(chat.apiHistory), { role: 'user', content: user.text || 'See the attached image.' }]
      : chat.messages.filter(m => m.id !== assistantId && (m.text || m.role === 'user')).map(m => ({ role: m.role, content: m.text || 'See the attached image.' }));
    meta.attempts[request.attemptId] = { chatId, assistantId, userId, fingerprint, history, status: 'reserved', driverFinished: false, sequence: 0, runId: null,
      goalId: request.goalId || null, taskId: request.taskId || null, coordinatorChatId: request.coordinatorChatId || null };
    chat.runProvider = request.provider; chat.updatedAt = at;
    write(profileId, ws);
    return { history: clone(history), fresh: true, assistantId, state: 'reserved' };
  }
  function ownedAttempt(ws, request) {
    attemptId(request.attemptId);
    const attempt = metadata(ws).attempts[request.attemptId];
    if (!attempt || attempt.chatId !== request.chatId || attempt.fingerprint !== requestFingerprint(request)) throw new Error('Attempt owner mismatch');
    const chat = chatFor(ws, request.chatId), reply = chat.messages.find(m => m.id === attempt.assistantId);
    if (!reply) throw new Error('Attempt transcript is missing');
    return { attempt, chat, reply };
  }
  function event(request, value) {
    if (value.profileId !== request.profileId || value.chatId !== request.chatId || !value.runId) throw new Error('Provider event owner mismatch');
    const ws = read(request.profileId), { attempt, chat, reply } = ownedAttempt(ws, request);
    if (attempt.driverFinished) throw new Error('Attempt already finalized');
    if (attempt.runId && attempt.runId !== value.runId) throw new Error('Attempt run changed');
    if (!Number.isSafeInteger(value.sequence) || value.sequence < 1) throw new Error('Provider event requires a sequence');
    if (value.sequence <= attempt.sequence) return { accepted: false, revision: metadata(ws).revision };
    if (value.sequence !== attempt.sequence + 1) throw new Error('Provider event sequence gap');
    attempt.runId = value.runId; attempt.sequence = value.sequence; attempt.status = 'running'; chat.runId = value.runId;
    applyEvent(chat, reply, value, now());
    const saved = write(request.profileId, ws);
    return { accepted: true, revision: saved.ownership.revision };
  }
  function finish(request, result) {
    const ws = read(request.profileId), { attempt, chat, reply } = ownedAttempt(ws, request);
    if (attempt.driverFinished) return { fresh: false, state: attempt.status };
    if (attempt.runId && result.runId !== attempt.runId) throw new Error('Finalization run mismatch');
    if (result.driverFinished !== true) {
      if (result.driverFinished !== false || result.status !== 'interrupted') throw new Error('Driver finalization acknowledgement required');
      attempt.status = 'interrupted'; attempt.runId ||= result.runId || null; chat.runId = attempt.runId;
      reply.streaming = false; reply.notes = [...(reply.notes || []), String(result.text || 'Driver finalization is unconfirmed; reconcile before retry.')];
      write(request.profileId, ws); return { fresh: false, state: 'interrupted', driverFinished: false };
    }
    attempt.runId ||= result.runId || null; attempt.driverFinished = true; attempt.status = result.status || 'finished';
    reply.streaming = false; reply.finishedAt ||= now(); chat.runId = null; chat.workingLabel = '';
    // Never duplicate streamed text by appending a final summary. It only fills an empty reply.
    if (!reply.text && result.text) reply.text = String(result.text);
    write(request.profileId, ws); return { fresh: true, state: attempt.status };
  }
  function stageWorkerChats(goal, choices) {
    const goalId = goal.id || goal.goalId; attemptId(goalId);
    const ws = read(goal.profileId), parent = chatFor(ws, goal.coordinatorChatId || goal.chatId), at = now();
    const ids = [];
    for (const choice of choices) {
      identifier(choice.chatId);
      let chat = ws.chats[choice.chatId];
      if (metadata(ws).deletedChats[choice.chatId]) throw new Error('Worker conversation was deleted; choose a new identity');
      if (chat && (!chat.side || chat.parent !== parent.id || chat.goalId !== goalId)) throw new Error('Existing worker conversation has another parent or goal');
      if (!chat) {
        chat = ws.chats[choice.chatId] = { id: choice.chatId, title: choice.title || 'Side chat', side: true, parent: parent.id, parentTitle: parent.title, goalId,
          folder: choice.folder === undefined ? parent.folder || null : choice.folder, provider: choice.provider || parent.provider, model: choice.model || parent.model,
          effort: choice.effort || parent.effort, messages: [], events: [], tabs: [], draft: '', apiHistory: [], runId: null, createdAt: at, updatedAt: at };
        ws.order.push(chat.id);
      }
      ids.push(chat.id);
    }
    write(goal.profileId, ws); return ids;
  }
  function command(profileId, { chatId, type, messageId, text, expectedRevision }) {
    const ws = read(profileId), meta = metadata(ws), chat = chatFor(ws, chatId);
    if (expectedRevision !== meta.revision) throw new Error('Workspace changed; reload before editing the transcript');
    if (Object.values(meta.attempts).some(a => a.chatId === chatId && !a.driverFinished)) throw new Error('Wait for the conversation run to finish');
    if (type === 'delete-chat') { delete ws.chats[chatId]; meta.deletedChats[chatId] = now(); ws.order = ws.order.filter(id => id !== chatId); if (ws.current === chatId) ws.current = ws.order[0] || null; }
    else {
      const index = chat.messages.findIndex(m => m.id === messageId);
      if (index < 0) throw new Error('Message not found');
      if (type === 'edit-message') {
        const message = chat.messages[index]; message.text = String(text || '');
        // Timeline rendering prefers parts. Preserve tool/thinking evidence but
        // replace all displayed answer text with the explicit edited answer.
        if (message.role === 'assistant' && message.parts) message.parts = [...message.parts.filter(p => p.kind !== 'text'), { kind: 'text', text: message.text, closed: true }];
      }
      else if (type === 'delete-message') chat.messages.splice(index, 1);
      else if (type === 'truncate-after') chat.messages = chat.messages.slice(0, index + 1);
      else throw new Error('Unknown transcript command');
      chat.sessions = {}; chat.sessionSeen = {}; chat.apiHistory = [];
    }
    return write(profileId, ws);
  }
  function approval(profileId, runId, approvalId, approved) {
    const ws = read(profileId), attempt = Object.values(metadata(ws).attempts).find(a => a.runId === runId && !a.driverFinished);
    if (!attempt) throw new Error('Approval run is unavailable');
    const reply = chatFor(ws, attempt.chatId).messages.find(m => m.id === attempt.assistantId);
    const item = reply?.approvals?.find(a => a.approvalId === approvalId && a.status === 'pending');
    if (!item) throw new Error('Approval is no longer pending');
    item.status = approved ? 'approved' : 'declined'; write(profileId, ws); return true;
  }
  return Object.freeze({ load, saveView, begin, event, finish, stageWorkerChats, command, approval });
}
module.exports = { createWorkspaceRepository };
