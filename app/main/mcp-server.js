// Barkdown document tools as a stdio MCP server, so Claude Code and Codex (running on the person's own
// logins) can read the library and propose edits. Started by the main process with the store folder as argv[2].
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const store = require('./store');
const documents = require('./documents');
const agentEdits = require('./agent-edits');
const readRevisions = new Map();
const { docToMarkdown } = require('../shared/markdown');
const barkpark = require('./barkpark');
const conversations = require('./conversations');

// The main process keeps barkpark.json current (server, dataset, mode) and hands a stored token over as
// BARKDOWN_BP_TOKEN when it starts this server; published papers read fine without one.
const capturedConnection = process.env.BARKDOWN_RUN_CONNECTION ? Object.freeze(JSON.parse(process.env.BARKDOWN_RUN_CONNECTION)) : null;
function bpFlag() { return capturedConnection || store.readJson('barkpark.json', null) || {}; }
function barkparkOn() { const f = bpFlag(); return Boolean(f.enabled && (f.viaCli || f.server)); }
function bpConfig() { const f = bpFlag(); return { server: f.server, dataset: f.dataset || 'production', token: capturedConnection ? capturedConnection.token || '' : process.env.BARKDOWN_BP_TOKEN || '' }; }
const paper = {
  list: limit => bpFlag().viaCli ? barkpark.cliListPapers(limit) : barkpark.listPapers(bpConfig(), limit),
  get: id => bpFlag().viaCli ? barkpark.cliGetPaper(id) : barkpark.getPaper(bpConfig(), id),
  search: query => bpFlag().viaCli ? barkpark.cliSearch(query) : barkpark.search(bpConfig(), query),
};
const isPaper = id => typeof id === 'string' && id.startsWith('bp:');
const slugOf = id => id.slice(3);
async function paperListing() { if (!barkparkOn()) return []; try { return (await paper.list(60)).map(d => ({ id: 'bp:' + d.id, title: d.title, excerpt: d.excerpt, rev: d.rev, source: 'barkpark' })); } catch { return []; } }

const storeDir = process.argv[2];
if (!storeDir) { console.error('usage: mcp-server.js <storeDir>'); process.exit(2); }
store.init(storeDir);
documents.loadAll();

const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] });

function describe(doc) {
  const blocks = (doc.content?.content || []).map((block, n) => `[${n}] ${block.type}${block.attrs?.level ? ' h' + block.attrs.level : ''}`);
  return [`# ${doc.title}`, `id: ${doc.id} · rev ${doc.rev} · updated ${doc.updatedAt}`, `references: ${(doc.references || []).join(', ') || 'none'} · backlinks: ${(doc.backlinks || []).map(b => b.id).join(', ') || 'none'}`, '', 'Top-level blocks: ' + blocks.join(', '), '', docToMarkdown(doc.content)].join('\n');
}

const server = new McpServer({ name: 'barkdown', version: '0.6.0' });

server.registerTool('list_documents', { description: 'List the documents in the Barkdown library with ids, titles and excerpts. Ids starting with bp: are Barkpark papers on the connected server; the rest are local documents.', inputSchema: {} }, async () => {
  documents.loadAll();
  const local = documents.list().map(d => ({ id: d.id, title: d.title, excerpt: d.excerpt, rev: d.rev, source: 'local' }));
  return text([...local, ...(await paperListing())]);
});

server.registerTool('search_documents', { description: 'Search the Barkdown library and, when connected, Barkpark papers (ids starting with bp:). Returns ids, titles and snippets.', inputSchema: { query: z.string() } }, async ({ query }) => {
  documents.loadAll();
  const local = documents.search(query).map(d => ({ id: d.id, title: d.title, snippet: d.snippet, source: 'local' }));
  const papers = barkparkOn() ? (await paper.search(query).catch(() => [])).map(d => ({ id: 'bp:' + d.id, title: d.title, snippet: d.snippet, source: 'barkpark' })) : [];
  const needle = query.toLowerCase();
  const listed = barkparkOn() && !papers.length ? (await paperListing()).filter(d => (d.title + ' ' + d.excerpt).toLowerCase().includes(needle)).map(d => ({ id: d.id, title: d.title, snippet: d.excerpt, source: 'barkpark' })) : [];
  return text([...local, ...papers, ...listed]);
});

server.registerTool('read_document', { description: 'Read a Barkdown document (or a Barkpark paper, id bp:<slug>) as markdown with its revision and block indexes. Opens it beside the chat for the person.', inputSchema: { id: z.string(), format: z.enum(['markdown', 'structured']).optional().describe('Structured returns exact PortableDoc blocks and revision for Paper export and table edits.') } }, async ({ id, format }) => {
  if (isPaper(id)) {
    if (!barkparkOn()) return text('Barkpark is not connected.');
    const p = await paper.get(slugOf(id));
    readRevisions.set(id, p.rev);
    if (format === 'structured') return text(barkpark.readablePaper(p, format));
    const blocks = (p.blocks || []).map((b, n) => `[${n}] ${b.type}${b.level ? ' h' + b.level : ''}`);
    return text([`# ${p.title}`, `id: ${id} · rev ${p.rev} · updated ${p.updatedAt} · Barkpark paper`, '', 'Top-level blocks: ' + (blocks.join(', ') || '(HTML body, no blocks)'), '', barkpark.readablePaper(p)].join('\n'));
  }
  documents.loadAll();
  const doc = documents.get(id);
  if (doc) readRevisions.set(id, doc.rev);
  return text(doc ? describe(doc) : `No document with id ${id}. Use list_documents.`);
});

// Keep the old tool name as an alias for resumed provider sessions.
for (const name of ['edit_document', 'propose_document_edit']) server.registerTool(name, { description: 'Apply a document edit directly and save it, with Undo available in the document. Read the document first. No Keep step. Prefer replace_block for targeted edits; append adds blocks, replace rewrites the document.', inputSchema: { id: z.string(), mode: z.enum(['append', 'replace', 'replace_block']), blockIndex: z.number().int().optional(), markdown: z.string(), summary: z.string() } }, async input => {
  try {
    const edit = await agentEdits.apply({ ...input, baseRev: readRevisions.get(input.id) }, { ...bpFlag(), ...bpConfig() });
    readRevisions.set(input.id, edit.afterRev);
    return text(`Saved edit to ${input.id} at revision ${edit.afterRev}. Applied directly; Undo is available in the document.`);
  } catch (error) { return { ...text(error.message), isError: true }; }
});

server.registerTool('edit_table', { description: 'Edit existing cells in a Barkpark table without replacing its structure. Read_document first (format=structured gives exact blocks). Use the stable table blockId; row/column are zero-based, header=true addresses its header row (row=0). Text may contain newlines; content accepts PortableDoc text/code and strong/em/underline/strikethrough/link nodes. Omitted content/alignment stays unchanged. Saves directly with Undo.', inputSchema: {
  id: z.string(), blockId: z.string(), summary: z.string(), cells: z.array(z.object({ row: z.number().int().nonnegative(), column: z.number().int().nonnegative(), header: z.boolean().optional(), text: z.string().optional(), content: z.array(z.record(z.unknown())).optional(), align: z.enum(['left', 'center', 'right']).optional() }).strict()).min(1).max(1000),
} }, async input => {
  try {
    const edit = await agentEdits.applyTable({ ...input, baseRev: readRevisions.get(input.id) }, { ...bpFlag(), ...bpConfig() });
    readRevisions.set(input.id, edit.afterRev);
    return text(`Saved table edit to ${input.id} at revision ${edit.afterRev}. Undo is available in the document.`);
  } catch (error) { return { ...text(error.message), isError: true }; }
});

server.registerTool('create_document', { description: 'Create a new document in the Barkdown library from markdown. It opens beside the chat.', inputSchema: { title: z.string(), markdown: z.string() } }, async ({ title, markdown }) => {
  documents.loadAll();
  const doc = documents.create({ title, markdown, actor: 'agent' });
  readRevisions.set(doc.id, doc.rev);
  return text(`Created document ${doc.id} ("${doc.title}") at rev 1.`);
});

server.registerTool('list_conversations', { description: 'List the conversations in this Barkdown workspace: the main chat and its side chats, each with its last question and reply, open tabs and working folder. Use it to see what another chat is doing.', inputSchema: {} }, async () => text(conversations.listConversations()));

server.registerTool('read_conversation', { description: 'Read another conversation\'s transcript (the main chat from a side chat, or a side chat from the main chat) by id from list_conversations. Returns the last messages with what each reply opened or used.', inputSchema: { id: z.string(), limit: z.number().int().optional().describe('How many latest messages to include (default 24)') } }, async ({ id, limit }) => {
  const transcript = conversations.readConversation(id, { limit: limit || 24 });
  return text(transcript || `No conversation with id ${id}. Use list_conversations for the ids.`);
});

server.registerTool('open_website', { description: 'Open a website in a work tab beside the chat so the person can see it. Use your own web tools to read its content.', inputSchema: { url: z.string() } }, async ({ url }) => text(`Opened ${url} beside the chat.`));

server.registerTool('open_project_file', { description: 'Show a file from the working folder in the project editor tab beside the chat (relative path).', inputSchema: { path: z.string() } }, async ({ path }) => text(`Showing ${path} in the project editor.`));

const transport = new StdioServerTransport();
server.connect(transport).catch(error => { console.error(error); process.exit(1); });
