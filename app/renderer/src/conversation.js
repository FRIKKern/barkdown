// Conversation rendering and agent runs, shared by the main chat and side chats.
import { el, esc, iconHtml, inlineMarkdownHtml, relativeTime, toast } from './ui.js';
import { state, touch, save, chatTitleFrom } from './state.js';

export const PROVIDER_LABEL = { claude: 'Claude Code', codex: 'Codex', api: 'Claude API key' };
export function providerFor(chat) { return chat.provider || state.settings?.provider || 'api'; }

const api = window.barkdown;
const TARGET_ICON = { doc: 'file-text', web: 'globe', review: 'git-pull-request', project: 'folder-code', chat: 'message-circle' };

export function transcriptHtml(chat, options = {}) {
  if (!chat.messages.length) {
    return `<div class="bw-byline"><span class="bw-avatar bw-agent">b</span>Barkdown</div><p class="bw-agent-copy">${esc(options.intro || 'Start with a question, a document, or a website. I can open documents beside this chat, propose edits for you to keep or discard, browse websites, and work in a folder you give me.')}</p>`;
  }
  return chat.messages.map((m, index) => {
    if (m.role === 'user') return `<div class="bw-byline"><span class="bw-avatar">${esc(options.initials || 'FJ')}</span>You<time>${esc(relativeTime(m.at))}</time></div><div class="bw-user-message">${esc(m.text)}</div>`;
    const tools = (m.tools || []).map(t => `<div class="bw-tool ${t.ok === false ? 'error' : ''}">${iconHtml(t.ok === false ? 'alert-triangle' : t.done ? 'circle-check' : 'wrench', 12)}<span>${esc(describeTool(t))}</span></div>`).join('');
    const events = (m.events || []).map((e, n) => `<button class="bw-event" data-event="${index}:${n}">${iconHtml(TARGET_ICON[e.target?.kind] || 'sparkles')}<span>${esc(e.label)}<small>${esc(e.detail || '')}</small></span></button>`).join('');
    const approvals = (m.approvals || []).filter(a => a.status === 'pending').map(a => `<div class="bw-approval" data-approval="${esc(a.approvalId)}"><strong>${a.request.kind === 'command' ? 'Allow running a command?' : a.request.outside ? `Allow ${esc(a.request.tool)} outside the working folder: ${esc(a.request.path)}?` : `Allow writing ${esc(a.request.path || a.request.tool)}?`}</strong><span class="bw-muted">${esc(a.request.summary || '')}</span><pre>${esc(String(a.request.command || a.request.contents || '').slice(0, 4000))}</pre><div class="row"><button class="primary" data-approve="1">Allow</button><button data-approve="0">Decline</button></div></div>`).join('');
    const error = m.error ? `<p class="bw-error-line">${esc(m.error)}</p>` : '';
    const notes = (m.notes || []).map(n => `<p class="bw-error-line">${esc(n)}</p>`).join('');
    const meta = m.provider && !m.streaming ? `<span class="bw-small bw-muted"> · ${esc(PROVIDER_LABEL[m.provider] || m.provider)}${m.usage?.cost ? ' · $' + m.usage.cost.toFixed(3) : ''}</span>` : '';
    return `<div class="bw-byline"><span class="bw-avatar bw-agent">b</span>Barkdown${meta}<time>${esc(relativeTime(m.at))}</time></div>${tools}${events}${approvals}<div class="bw-agent-copy">${inlineMarkdownHtml(m.text || '')}${m.streaming && !m.text ? '<span class="bw-muted">Thinking…</span>' : ''}</div>${notes}${error}`;
  }).join('') + (options.footer || '');
}

function describeTool(t) {
  const input = t.input || {};
  switch (t.tool) {
    case 'Read': return `Read ${input.file_path || input.path || ''}`;
    case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit': return `${t.ok === false ? 'Could not edit' : t.tool === 'Write' ? 'Wrote' : 'Edited'} ${input.file_path || input.path || ''}`;
    case 'Bash': return `Ran ${String(input.command || '').slice(0, 80)}`;
    case 'Glob': case 'Grep': return `Searched files for ${input.pattern || ''}`;
    case 'WebFetch': return `Fetched ${input.url || ''}`;
    case 'WebSearch': return `Searched the web for ${input.query || ''}`;
    case 'Task': return `Ran a subagent: ${input.description || ''}`;
    case 'TodoWrite': return 'Updated the task list';
    case 'open_project_file': return `Showed ${input.path}`;
    case 'read_document': return `Read document ${input.id}`;
    case 'search_documents': return `Searched documents for “${input.query}”`;
    case 'list_documents': return 'Listed documents';
    case 'propose_document_edit': return `Proposed ${input.mode} in ${input.id}`;
    case 'create_document': return `Created document “${input.title}”`;
    case 'open_website': return `Opened ${input.url}`;
    case 'list_files': return `Listed files${input.dir ? ' in ' + input.dir : ''}`;
    case 'search_files': return `Searched files for “${input.query}”`;
    case 'read_file': return `Read ${input.path}`;
    case 'write_file': return `${t.ok === false ? 'Failed to write' : 'Wrote'} ${input.path}`;
    case 'git_diff': return 'Collected the git diff';
    default: return t.tool;
  }
}

export function apiMessagesFor(chat) {
  // Prefer the exact history returned by the last run (it includes tool calls); append messages sent since.
  const history = chat.apiHistory?.length ? [...chat.apiHistory] : [];
  const seen = history.length;
  const userMessages = chat.messages.filter(m => m.role === 'user');
  if (!history.length) return userMessagesToApi(chat.messages);
  const last = userMessages.at(-1);
  if (last && !last.sentInHistory) history.push({ role: 'user', content: last.text });
  return history;
}

function userMessagesToApi(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.text) out.push({ role: 'assistant', content: m.text });
  }
  if (out.at(-1)?.role !== 'user') return out.filter((m, i, arr) => i < arr.length - 1 || m.role === 'user');
  return out;
}

export async function sendMessage(chat, text, hooks) {
  const clean = text.trim();
  if (!clean || chat.runId) return false;
  const now = new Date().toISOString();
  chat.messages.push({ role: 'user', text: clean, at: now });
  if (chat.messages.filter(m => m.role === 'user').length === 1 && (chat.title === 'New chat' || chat.title === 'Shaping Barkdown' && !chat.side)) chat.title = chatTitleFrom(clean);
  chat.messages.push({ role: 'assistant', text: '', at: now, streaming: true, tools: [], events: [], approvals: [] });
  chat.following = true;
  chat.closedTargets = [];
  touch(chat);
  hooks.render();
  try {
    const messages = apiMessagesFor(chat);
    const provider = providerFor(chat);
    chat.sessions = chat.sessions || {};
    const { runId } = await api.agent.start(chat.id, messages, { folder: chat.folder || null, chatId: chat.id, title: chat.title }, provider, chat.sessions[provider] || null, clean);
    chat.runProvider = provider;
    chat.runId = runId;
    hooks.runChanged(chat);
  } catch (error) {
    const reply = chat.messages.at(-1);
    reply.streaming = false;
    reply.error = error.message;
    hooks.render();
  }
  save();
  return true;
}

export function handleAgentEvent(event, hooks) {
  const chat = state.chats[event.chatId];
  if (!chat) return;
  const reply = [...chat.messages].reverse().find(m => m.role === 'assistant');
  if (!reply) return;
  switch (event.type) {
    case 'text_delta': reply.text = (reply.text || '') + event.text; hooks.renderDelta(chat); break;
    case 'text_replace': reply.text = event.text; hooks.renderDelta(chat); break;
    case 'status': if (event.model) reply.model = event.model; break;
    case 'usage': reply.usage = event; break;
    case 'error_note': reply.notes = [...(reply.notes || []), event.message]; hooks.render(chat); break;
    case 'library_changed': hooks.libraryChanged?.(); break;
    case 'text_break': if (reply.text && !reply.text.endsWith('\n')) reply.text += '\n\n'; break;
    case 'tool_start': reply.tools.push({ tool: event.tool, input: event.input, id: event.toolUseId, done: false }); hooks.render(chat); break;
    case 'tool_result': { const t = reply.tools.find(t => t.id === event.toolUseId); if (t) { t.done = true; t.ok = event.ok; } hooks.render(chat); break; }
    case 'activity': {
      const entry = { label: event.label, detail: event.detail, target: event.target, at: new Date().toISOString(), proposalId: event.proposalId };
      reply.events.push(entry);
      chat.events.push(entry);
      hooks.activity(chat, entry, event);
      hooks.render(chat);
      break;
    }
    case 'approval': reply.approvals.push({ approvalId: event.approvalId, runId: event.runId, request: event.request, status: 'pending' }); hooks.render(chat); hooks.attention(chat); break;
    case 'error': reply.streaming = false; reply.error = event.message; chat.runId = null; hooks.render(chat); hooks.runChanged(chat); break;
    case 'done':
      reply.streaming = false;
      if (event.history) { chat.apiHistory = event.history; chat.messages.filter(m => m.role === 'user').forEach(m => { m.sentInHistory = true; }); }
      if (event.offline) reply.offline = true;
      if (event.session && event.provider) { chat.sessions = chat.sessions || {}; chat.sessions[event.provider] = event.session; }
      reply.provider = event.provider;
      chat.runId = null;
      touch(chat);
      hooks.render(chat);
      hooks.runChanged(chat);
      break;
  }
  save();
}

export async function respondApproval(chat, approvalId, approved) {
  const reply = [...chat.messages].reverse().find(m => m.role === 'assistant');
  const approval = reply?.approvals.find(a => a.approvalId === approvalId);
  if (!approval) return;
  approval.status = approved ? 'approved' : 'declined';
  try { await api.agent.approve(approval.runId, approvalId, approved); } catch (error) { toast(error.message, 'error'); }
}

export async function cancelRun(chat) {
  if (!chat.runId) return;
  try { await api.agent.cancel(chat.runId); } catch {}
}
