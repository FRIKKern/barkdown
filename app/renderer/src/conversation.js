// Conversation rendering and agent runs, shared by the main chat and side chats.
import { el, esc, iconHtml, inlineMarkdownHtml, relativeTime, toast } from './ui.js';
import { state, touch, save, serialise, chatTitleFrom } from './state.js';
import { lineDiff, summariseChanges, changeHeadline } from '../../shared/changes.js';

export const PROVIDER_LABEL = { claude: 'Claude Code', codex: 'Codex', api: 'Claude API key' };
export function providerFor(chat) { return chat.provider || state.settings?.provider || 'api'; }

const api = window.barkdown;
const TARGET_ICON = { doc: 'file-text', web: 'globe', review: 'git-pull-request', project: 'folder-code', chat: 'message-circle' };

export function transcriptHtml(chat, options = {}) {
  if (!chat.messages.length) {
    return `<div class="bw-byline"><span class="bw-avatar bw-agent">b</span>Barkdown</div><p class="bw-agent-copy">${esc(options.intro || 'Start with a question, a document, or a website. I can open documents beside this chat, propose edits for you to keep or discard, browse websites, and work in a folder you give me.')}</p>`;
  }
  return chat.messages.map((m, index) => {
    if (m.role === 'user') {
      const images = (m.images || []).length ? `<div class="bw-user-images">${m.images.map(i => `<img src="${esc(i.url)}" alt="${esc(i.name || 'Attached image')}" title="${esc(i.name || '')}" data-lightbox="${esc(i.url)}">`).join('')}</div>` : '';
      return `<div class="bw-user-message${m.text ? '' : ' bw-user-message--images'}" title="${esc(relativeTime(m.at))}">${images}${esc(m.text)}</div>`;
    }
    const steps = (m.tools || []).map((t, n) => stepHtml(t, index, n)).join('');
    const events = (m.events || []).map((e, n) => `<button class="bw-event" data-event="${index}:${n}">${iconHtml(TARGET_ICON[e.target?.kind] || 'sparkles')}<span>${esc(e.label)}<small>${esc(e.detail || '')}</small></span></button>`).join('');
    const approvals = (m.approvals || []).filter(a => a.status === 'pending').map(a => `<div class="bw-approval" data-approval="${esc(a.approvalId)}"><strong>${a.request.kind === 'command' ? 'Allow running a command?' : a.request.outside ? `Allow ${esc(a.request.tool)} outside the working folder: ${esc(a.request.path)}?` : `Allow writing ${esc(a.request.path || a.request.tool)}?`}</strong><span class="bw-muted">${esc(a.request.summary || '')}</span><pre>${esc(String(a.request.command || a.request.contents || '').slice(0, 4000))}</pre><div class="row"><button class="primary" data-approve="1">Allow</button><button data-approve="0">Decline</button></div></div>`).join('');
    const error = m.error ? `<p class="bw-error-line">${esc(m.error)}</p>` : '';
    const notes = (m.notes || []).map(n => `<p class="bw-error-line">${esc(n)}</p>`).join('');
    const changes = m.streaming ? '' : changeCardHtml(m, index);
    return `<div class="bw-byline"><span class="bw-avatar bw-agent">b</span>Barkdown<time>${esc(relativeTime(m.at))}</time></div>${timelineHtml(m, index, steps)}${events}${approvals}${changes}${notes}${error}${replyFootHtml(m, chat)}`;
  }).join('') + (options.footer || '');
}

// The reply as it happened: thinking, steps and text in order. Replies saved before the timeline existed
// (no parts) fall back to steps first, then the text. Tools a timeline does not mention still render.
function timelineHtml(m, index, legacySteps) {
  if (!m.parts?.length) return `${legacySteps}<div class="bw-agent-copy">${inlineMarkdownHtml(m.text || '')}${m.streaming && !m.text ? '<span class="bw-muted">Thinking…</span>' : ''}</div>`;
  const seen = new Set();
  const out = m.parts.map((p, i) => {
    const live = m.streaming && i === m.parts.length - 1;
    if (p.kind === 'tool') { const n = (m.tools || []).findIndex(t => t.id === p.id); if (n < 0) return ''; seen.add(n); return stepHtml(m.tools[n], index, n); }
    if (p.kind === 'thinking') return `<div class="bw-thought${live ? ' live' : ''}">${inlineMarkdownHtml(p.text || '')}</div>`;
    return `<div class="bw-agent-copy">${inlineMarkdownHtml(p.text || '')}</div>`;
  }).join('');
  const rest = (m.tools || []).map((t, n) => seen.has(n) ? '' : stepHtml(t, index, n)).join('');
  return out + rest;
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
export function formatTokens(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n); }

// The line under a reply: while it runs, elapsed time and what it is doing; after, time, tokens, cost, provider.
function replyFootHtml(m, chat) {
  if (m.streaming) return `<div class="bw-reply-foot live">${iconHtml('asterisk', 12)}<span class="bw-elapsed" data-since="${esc(m.at)}">${formatDuration(Date.now() - new Date(m.at).getTime())}</span><span>· ${esc(chat.workingLabel || (m.parts?.length ? 'Writing…' : 'Thinking…'))}</span></div>`;
  if (m.offline) return '';
  const u = m.usage || {};
  const bits = [];
  const ms = u.durationMs || (m.finishedAt ? new Date(m.finishedAt) - new Date(m.at) : 0);
  if (ms > 0) bits.push(formatDuration(ms));
  const tokens = (u.tokens?.input || 0) + (u.tokens?.output || 0);
  if (tokens) bits.push(`${formatTokens(tokens)} tokens`);
  if (u.cost) bits.push('$' + u.cost.toFixed(3));
  if (m.provider) bits.push(PROVIDER_LABEL[m.provider] || m.provider);
  if (!bits.length) return '';
  return `<div class="bw-reply-foot">${iconHtml('asterisk', 12)}<span>${esc(bits.join(' · '))}</span></div>`;
}

// A shell command with its parts coloured: command names, flags, strings, operators.
function shellHtml(command) {
  return String(command || '').split('\n').map((line, i, lines) => {
    let expectCommand = i === 0 || /(\|\||&&|\||;|\\)\s*$/.test(lines[i - 1] || '');
    return line.replace(/("[^"]*"?|'[^']*'?|\S+)/g, token => {
      let cls = '';
      if (/^("|')/.test(token)) cls = 's';
      else if (/^(\|\||&&|\||;|>>?|2>&1|<<?|\\)$/.test(token)) { cls = 'o'; expectCommand = true; return `<span class="o">${esc(token)}</span>`; }
      else if (token.startsWith('-') && token.length > 1) cls = 'f';
      else if (expectCommand) { cls = 'c'; expectCommand = false; if (/^(sudo|npx|npm|node|python|git|bp|cd|time)$/.test(token) && !/^(cd)$/.test(token)) expectCommand = false; }
      if (cls === 'c' || cls === 's' || cls === 'f') expectCommand = false;
      return cls ? `<span class="${cls}">${esc(token)}</span>` : esc(token);
    });
  }).join('\n');
}

const OUTPUT_CAP = 6000;
function clipOut(text) { const s = String(text ?? ''); return s.length > OUTPUT_CAP ? s.slice(0, OUTPUT_CAP) + `\n… ${s.length - OUTPUT_CAP} more characters` : s; }
function diffHtml(lines) { return `<pre class="bw-diff">${lines.map(l => `<span class="${l.kind}">${l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '} ${esc(l.text)}</span>`).join('')}</pre>`; }
function kv(input, skip = []) { return Object.entries(input || {}).filter(([k]) => !skip.includes(k) && !k.startsWith('__')).map(([k, v]) => `<div class="bw-kv"><b>${esc(k)}</b> ${esc(typeof v === 'string' ? v : JSON.stringify(v))}</div>`).join(''); }

// One expandable step per tool call: what ran, what it printed, what it changed.
function stepHtml(t, mi, n) {
  const input = t.input || {};
  const state = t.ok === false ? 'error' : t.done ? 'done' : 'running';
  const icon = t.ok === false ? 'alert-triangle' : t.done ? 'circle-check' : 'wrench';
  let body = '';
  switch (t.tool) {
    case 'Bash': body = `<pre class="bw-cmd"><span class="p">$</span> ${shellHtml(input.command || '')}</pre>${t.output != null || t.preview ? `<pre class="bw-out">${esc(clipOut(t.output ?? t.preview))}</pre>` : ''}`; break;
    case 'Edit': body = `<div class="bw-kv"><b>file</b> ${esc(input.file_path || '')}</div>${diffHtml(lineDiff(input.old_string || '', input.new_string || ''))}`; break;
    case 'MultiEdit': body = `<div class="bw-kv"><b>file</b> ${esc(input.file_path || '')}</div>` + (input.edits || []).map(e => diffHtml(lineDiff(e.old_string || '', e.new_string || ''))).join(''); break;
    case 'Write': case 'write_file': { const text = input.content ?? input.contents ?? ''; body = `<div class="bw-kv"><b>file</b> ${esc(input.file_path || input.path || '')}</div>${diffHtml(String(clipOut(text)).split('\n').map(text => ({ kind: 'add', text })))}`; break; }
    case 'NotebookEdit': body = `<div class="bw-kv"><b>notebook</b> ${esc(input.notebook_path || '')}</div>${diffHtml(String(input.new_source || '').split('\n').map(text => ({ kind: 'add', text })))}`; break;
    // Barkdown's own tools: show the page or proposal as it will read, not as JSON.
    case 'create_document': body = `<div class="bw-kv"><b>page</b> ${esc(input.title || '')}</div><div class="bw-doc-preview">${inlineMarkdownHtml(String(input.markdown || ''))}</div>${t.output ? `<pre class="bw-out">${esc(clipOut(t.output))}</pre>` : ''}`; break;
    case 'propose_document_edit': body = `${kv({ document: input.id, mode: input.mode, block: input.blockIndex, summary: input.summary })}<div class="bw-doc-preview">${inlineMarkdownHtml(String(input.markdown || ''))}</div>${t.output ? `<pre class="bw-out">${esc(clipOut(t.output))}</pre>` : ''}`; break;
    default: body = kv(input) + (t.output != null || t.preview ? `<pre class="bw-out">${esc(clipOut(t.output ?? t.preview))}</pre>` : '');
  }
  return `<details class="bw-step ${state}" data-step="${mi}:${n}" open><summary>${iconHtml(icon, 12)}<span>${esc(t.done ? describeTool(t) : runningLabel(t))}</span>${state === 'running' ? '<i class="bw-pulse"></i>' : ''}${iconHtml('chevron-down', 12)}</summary><div class="bw-step-body">${body}</div></details>`;
}

// The change card under a reply: every file and document it touched, with counts, View and Undo.
function changeCardHtml(m, index) {
  const summary = summariseChanges(m.tools || [], m.events || []);
  if (!summary.total) return '';
  const files = summary.files.map(f => `<div class="bw-change"><span class="bw-change-icon">${iconHtml('file-code', 12)}</span><span class="bw-change-path" title="${esc(f.path)}">${esc(f.path)}</span><span class="bw-change-counts">${f.known ? `<b class="bw-positive">+${f.additions}</b> <b class="bw-negative">−${f.deletions}</b>` : `<span class="bw-muted">${esc(f.kinds.join(', ') || 'changed')}</span>`}</span><button data-view-file="${esc(f.path)}" title="Open the file in the project editor">View</button><button data-undo-file="${esc(f.path)}" title="Restore the file from git, or remove it if it is new">Undo</button></div>`).join('');
  const docs = summary.docs.map(d => `<div class="bw-change"><span class="bw-change-icon">${iconHtml('file-text', 12)}</span><span class="bw-change-path">${esc(d.title)}</span><span class="bw-change-counts"><span class="bw-muted">${d.kind === 'created' ? 'created' : 'proposal to review'}</span></span><button data-view-doc="${esc(d.id)}" data-doc-source="${esc(d.source)}" title="Open the document">${d.kind === 'created' ? 'View' : 'Review'}</button></div>`).join('');
  return `<div class="bw-changes" data-changes="${index}"><div class="bw-changes-head"><span>${esc(changeHeadline(summary))}</span>${summary.files.some(f => f.known) ? `<b class="bw-positive">+${summary.additions}</b><b class="bw-negative">−${summary.deletions}</b>` : ''}</div>${files}${docs}</div>`;
}

// What a step is doing while it runs, for the step row and the "Working…" indicator.
export function runningLabel(t) {
  const input = t.input || {};
  switch (t.tool) {
    case 'create_document': return `Creating page “${input.title || ''}”…`;
    case 'propose_document_edit': return `Proposing a change to ${input.id || 'a document'}…`;
    case 'read_document': return `Reading ${input.id || 'a document'}…`;
    case 'search_documents': return `Searching documents for “${input.query || ''}”…`;
    case 'list_documents': return 'Listing documents…';
    case 'list_conversations': return 'Looking at the other chats…';
    case 'read_conversation': return `Reading the chat ${input.id || ''}…`;
    case 'open_website': return `Opening ${input.url || 'a website'}…`;
    case 'open_project_file': return `Showing ${input.path || 'a file'}…`;
    case 'Bash': return input.description ? `${input.description}…` : `Running ${String(input.command || '').slice(0, 60)}…`;
    case 'Read': case 'read_file': return `Reading ${input.file_path || input.path || ''}…`;
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return `Editing ${input.file_path || input.notebook_path || ''}…`;
    case 'Write': case 'write_file': return `Writing ${input.file_path || input.path || ''}…`;
    case 'Glob': case 'Grep': case 'search_files': return `Searching files for ${input.pattern || input.query || ''}…`;
    case 'WebFetch': return `Fetching ${input.url || ''}…`;
    case 'WebSearch': return `Searching the web for ${input.query || ''}…`;
    case 'Task': return `Running a subagent: ${input.description || ''}…`;
    default: return `${t.tool}…`;
  }
}

function describeTool(t) {
  const input = t.input || {};
  switch (t.tool) {
    case 'Read': return `Read ${input.file_path || input.path || ''}`;
    case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit': return `${t.ok === false ? 'Could not edit' : t.tool === 'Write' ? 'Wrote' : 'Edited'} ${input.file_path || input.path || ''}`;
    case 'Bash': return input.description || `Ran ${String(input.command || '').slice(0, 80)}`;
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
    case 'create_document': return `${t.ok === false ? 'Could not create page' : 'Created page'} “${input.title}”`;
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
  if (last && !last.sentInHistory) history.push({ role: 'user', content: last.text || 'See the attached image.' });
  return history;
}

function userMessagesToApi(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text || 'See the attached image.' });
    else if (m.text) out.push({ role: 'assistant', content: m.text });
  }
  if (out.at(-1)?.role !== 'user') return out.filter((m, i, arr) => i < arr.length - 1 || m.role === 'user');
  return out;
}

export async function sendMessage(chat, text, hooks, images = []) {
  const clean = text.trim();
  const attached = (images || []).map(i => ({ id: i.id, path: i.path, url: i.url, name: i.name, mime: i.mime }));
  if ((!clean && !attached.length) || chat.runId) return false;
  const now = new Date().toISOString();
  chat.messages.push({ role: 'user', text: clean, at: now, images: attached });
  if (chat.messages.filter(m => m.role === 'user').length === 1 && (chat.title === 'New chat' || chat.title === 'Side chat' || chat.title === 'Shaping Barkdown' && !chat.side)) chat.title = chatTitleFrom(clean || (attached.length > 1 ? `${attached.length} images` : attached[0].name || 'Image'));
  chat.messages.push({ role: 'assistant', text: '', at: now, streaming: true, tools: [], events: [], approvals: [] });
  chat.following = true;
  chat.closedTargets = [];
  touch(chat);
  hooks.render();
  try {
    // The run reads the other conversations from workspace.json; write it now rather than after the debounce.
    try { await api.state.save(serialise()); } catch {}
    const messages = apiMessagesFor(chat);
    const provider = providerFor(chat);
    chat.sessions = chat.sessions || {};
    const { runId } = await api.agent.start(chat.id, messages, { folder: chat.folder || null, chatId: chat.id, title: chat.title }, provider, chat.sessions[provider] || null, clean, attached, { model: chat.model || undefined, effort: chat.effort || undefined });
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

// Timeline bookkeeping: the open part of a kind, or a fresh one once the previous was closed.
function part(reply, kind) {
  reply.parts ||= [];
  const last = reply.parts.at(-1);
  if (last && last.kind === kind && !last.closed) return last;
  const p = { kind, text: '' };
  reply.parts.push(p);
  return p;
}
function closePart(reply) { const last = reply.parts?.at(-1); if (last && last.kind !== 'tool') last.closed = true; }

export function handleAgentEvent(event, hooks) {
  const chat = state.chats[event.chatId];
  if (!chat) return;
  const reply = [...chat.messages].reverse().find(m => m.role === 'assistant');
  if (!reply) return;
  switch (event.type) {
    case 'text_delta': reply.text = (reply.text || '') + event.text; part(reply, 'text').text += event.text; hooks.renderDelta(chat); break;
    case 'text_replace': { const p = part(reply, 'text'); reply.text = (reply.text || '').slice(0, reply.text.length - p.text.length) + event.text; p.text = event.text; hooks.renderDelta(chat); break; }
    case 'thinking_delta': part(reply, 'thinking').text += event.text; hooks.renderDelta(chat); break;
    case 'thinking_replace': part(reply, 'thinking').text = event.text; hooks.renderDelta(chat); break;
    case 'thinking_break': closePart(reply); break;
    case 'status': {
      if (event.model) reply.model = event.model;
      // What the provider actually used tells the chips what "default" means.
      const seen = state.settings?.providers?.[chat.runProvider || providerFor(chat)];
      if (seen) { if (event.model) seen.modelSeen = event.model; if (event.effort) seen.effortSeen = event.effort; }
      break;
    }
    case 'usage': reply.usage = { ...(reply.usage || {}), ...event }; break;
    case 'error_note': reply.notes = [...(reply.notes || []), event.message]; hooks.render(chat); break;
    case 'library_changed': hooks.libraryChanged?.(); break;
    case 'text_break': if (reply.text && !reply.text.endsWith('\n')) reply.text += '\n\n'; closePart(reply); break;
    case 'tool_start': { const t = { tool: event.tool, input: event.input, kind: event.kind, id: event.toolUseId, done: false }; reply.tools.push(t); closePart(reply); (reply.parts ||= []).push({ kind: 'tool', id: t.id }); chat.workingLabel = runningLabel(t); hooks.tool?.(chat, event); hooks.render(chat); break; }
    case 'tool_result': { const t = reply.tools.find(t => t.id === event.toolUseId); if (t) { t.done = true; t.ok = event.ok; t.preview = event.preview; if (event.output != null) t.output = event.output; } const open = reply.tools.filter(t => !t.done).at(-1); chat.workingLabel = open ? runningLabel(open) : ''; hooks.tool?.(chat, event); hooks.render(chat); break; }
    case 'activity': {
      const entry = { label: event.label, detail: event.detail, target: event.target, at: new Date().toISOString(), proposalId: event.proposalId };
      reply.events.push(entry);
      chat.events.push(entry);
      hooks.activity(chat, entry, event);
      hooks.render(chat);
      break;
    }
    case 'approval': reply.approvals.push({ approvalId: event.approvalId, runId: event.runId, request: event.request, status: 'pending' }); hooks.render(chat); hooks.attention(chat); break;
    case 'error': reply.streaming = false; reply.error = event.message; chat.runId = null; chat.workingLabel = ''; hooks.render(chat); hooks.runChanged(chat); break;
    case 'done':
      reply.streaming = false;
      if (event.history) { chat.apiHistory = event.history; chat.messages.filter(m => m.role === 'user').forEach(m => { m.sentInHistory = true; }); }
      if (event.offline) reply.offline = true;
      if (event.session && event.provider) { chat.sessions = chat.sessions || {}; chat.sessions[event.provider] = event.session; }
      reply.provider = event.provider;
      reply.finishedAt = new Date().toISOString();
      chat.runId = null;
      chat.workingLabel = '';
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
