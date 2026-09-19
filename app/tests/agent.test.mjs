// Unit checks for the agent loop with a fake Claude client: tool execution, proposals, approval gating, cancellation.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const store = require('../main/store.js');
const documents = require('../main/documents.js');
const agent = require('../main/agent.js');
const { markdownToDoc, docToMarkdown } = require('../shared/markdown.js');

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-agent-'));
store.init(tmp);
documents.loadAll();
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-agent-repo-'));
fs.writeFileSync(path.join(repo, 'notes.txt'), 'hello\n');

// A scripted client: each call to messages.stream pops the next scripted turn.
function fakeClient(turns) {
  return { messages: { stream(params) {
    const turn = turns.shift();
    if (!turn) throw new Error('no more scripted turns');
    const handlers = {};
    const message = typeof turn === 'function' ? turn(params) : turn;
    return { on(event, fn) { handlers[event] = fn; return this; }, async finalMessage() { for (const block of message.content) if (block.type === 'text') handlers.text?.(block.text); return message; } };
  } } };
}
const text = t => ({ type: 'text', text: t });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });

async function runScenario(turns, { context = {}, respond } = {}) {
  const events = [];
  agent.setClientFactory(() => fakeClient(turns));
  const done = new Promise(resolve => {
    agent.start({ chatId: 'c1', messages: [{ role: 'user', content: 'go' }], context, settings: { apiKey: 'test', model: 'claude-opus-5', forceOnline: true }, send: event => { events.push(event); if (respond) respond(event); if (event.type === 'done' || event.type === 'error') resolve(); } });
  });
  await done;
  return events;
}

// 1. Read a document, propose an edit, finish. The proposal is pending, not applied.
const overview = documents.list().find(d => d.title === 'Overview');
let events = await runScenario([
  { stop_reason: 'tool_use', content: [text('Looking.'), use('t1', 'read_document', { id: overview.id })] },
  params => { const last = params.messages.at(-1); assert(last.role === 'user' && last.content[0].type === 'tool_result' && last.content[0].content.includes('# Overview'), 'tool_result missing document markdown'); return { stop_reason: 'tool_use', content: [use('t2', 'propose_document_edit', { id: overview.id, mode: 'append', markdown: '## Added\n\nProposed text.', summary: 'Add a section' })] }; },
  { stop_reason: 'end_turn', content: [text('Proposed a section.')] },
]);
assert(events.some(e => e.type === 'activity' && e.target.kind === 'doc' && e.label.startsWith('Opened')), 'read_document did not emit an activity');
assert(events.some(e => e.type === 'activity' && e.proposalId), 'proposal activity missing');
const doc = documents.get(overview.id);
assert(doc.proposals.length === 1 && doc.rev === 1, 'proposal was applied instead of pending');
assert(events.at(-1).type === 'done' && events.at(-1).history.length === 6, 'history should contain user, assistant, tool_result, assistant, tool_result... turns');
const accepted = documents.resolveProposal(overview.id, doc.proposals[0].id, true);
assert(accepted.doc.rev === 2 && accepted.doc.markdown.includes('Proposed text.'), 'accepting the proposal did not create a new revision');
console.log('scenario 1 ok: read + propose + accept');

// 2. write_file waits for approval; declined writes do not touch disk; approved writes do.
events = await runScenario([
  { stop_reason: 'tool_use', content: [use('w1', 'write_file', { path: 'notes.txt', contents: 'changed\n', summary: 'Change notes' })] },
  params => { assert(params.messages.at(-1).content[0].content.includes('declined'), 'declined result not reported'); return { stop_reason: 'tool_use', content: [use('w2', 'write_file', { path: 'sub/new.txt', contents: 'created\n', summary: 'Create file' })] }; },
  { stop_reason: 'end_turn', content: [text('Done.')] },
], { context: { folder: repo }, respond: event => { if (event.type === 'approval') setTimeout(() => agent.respondApproval(event.runId, event.approvalId, event.request.path !== 'notes.txt'), 5); } });
assert(fs.readFileSync(path.join(repo, 'notes.txt'), 'utf8') === 'hello\n', 'declined write changed the file');
assert(fs.readFileSync(path.join(repo, 'sub', 'new.txt'), 'utf8') === 'created\n', 'approved write did not happen');
assert(events.filter(e => e.type === 'approval').length === 2, 'two approvals expected');
console.log('scenario 2 ok: approval gate');

// 3. Path confinement: the agent cannot read outside the working folder.
events = await runScenario([
  { stop_reason: 'tool_use', content: [use('r1', 'read_file', { path: '../../outside.txt' })] },
  params => { const result = params.messages.at(-1).content[0]; assert(result.is_error && /escapes/.test(result.content), 'path escape was not rejected'); return { stop_reason: 'end_turn', content: [text('Blocked.')] }; },
], { context: { folder: repo } });
console.log('scenario 3 ok: path confinement');

// 4. Cancellation stops the loop and resolves pending approvals as declined.
let cancelledEvents = [];
agent.setClientFactory(() => fakeClient([{ stop_reason: 'tool_use', content: [use('w3', 'write_file', { path: 'x.txt', contents: 'x', summary: 'x' })] }, { stop_reason: 'end_turn', content: [text('after cancel')] }]));
await new Promise(resolve => {
  let runId = null;
  agent.start({ chatId: 'c2', messages: [{ role: 'user', content: 'go' }], context: { folder: repo }, settings: { apiKey: 'test', forceOnline: true }, send: event => { cancelledEvents.push(event); runId = event.runId; if (event.type === 'approval') agent.cancel(runId); if (event.type === 'done' || event.type === 'error') resolve(); } });
});
assert(cancelledEvents.at(-1).type === 'done' && cancelledEvents.at(-1).cancelled, 'cancelled run did not finish as cancelled');
assert(!fs.existsSync(path.join(repo, 'x.txt')), 'cancelled approval still wrote the file');
console.log('scenario 4 ok: cancellation');

// 5. Offline mode still opens named targets.
events = await runScenario([], { context: { folder: repo } , respond: null });
// forceOnline was set, so this ran online with no turns -> error. Run the real offline branch:
const offline = [];
await new Promise(resolve => agent.start({ chatId: 'c3', messages: [{ role: 'user', content: 'Open the Overview and barkpark.cloud' }], context: {}, settings: { apiKey: '' }, send: e => { offline.push(e); if (e.type === 'done') resolve(); } }));
assert(offline.some(e => e.type === 'activity' && e.target.kind === 'doc') && offline.some(e => e.type === 'activity' && e.target.kind === 'web'), 'offline mode did not open targets');
assert(offline.at(-1).offline === true, 'offline done flag missing');
console.log('scenario 5 ok: offline fallback');

// 6. Markdown round trip keeps structure.
const md = '# Title\n\nPara with **bold**.\n\n- one\n- two\n\n- [x] done\n\n> quote\n\n| Mode | What it does |\n| --- | --- |\n| Append | Adds blocks at the end |\n| Replace | Rewrites it, a \\| escaped pipe |\n\n```js\ncode();\n```\n';
const table = markdownToDoc(md).content.find(n => n.type === 'table');
assert(table && table.content.length === 3 && table.content[0].content[0].type === 'tableHeader' && table.content[2].content[1].content[0].content[0].text === 'Rewrites it, a | escaped pipe', 'table parsed: ' + JSON.stringify(table));
assert(docToMarkdown(markdownToDoc(md)).trim() === md.trim(), 'markdown round trip changed the document');
console.log('scenario 6 ok: markdown round trip');

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(repo, { recursive: true, force: true });
console.log('Agent checks passed.');
