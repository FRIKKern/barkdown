// Barkdown document tools as a stdio MCP server, so Claude Code and Codex (running on the person's own
// logins) can read the library and propose edits. Started by the main process with the store folder as argv[2].
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const store = require('./store');
const documents = require('./documents');
const { docToMarkdown } = require('../shared/markdown');

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

server.registerTool('list_documents', { description: 'List the documents in the Barkdown library with ids, titles and excerpts.', inputSchema: {} }, async () => {
  documents.loadAll();
  return text(documents.list().map(d => ({ id: d.id, title: d.title, excerpt: d.excerpt, rev: d.rev })));
});

server.registerTool('search_documents', { description: 'Full-text search across the Barkdown document library. Returns ids, titles and snippets.', inputSchema: { query: z.string() } }, async ({ query }) => {
  documents.loadAll();
  return text(documents.search(query).map(d => ({ id: d.id, title: d.title, snippet: d.snippet })));
});

server.registerTool('read_document', { description: 'Read a Barkdown document as markdown with its revision, references, backlinks and block indexes. Opens it beside the chat for the person.', inputSchema: { id: z.string() } }, async ({ id }) => {
  documents.loadAll();
  const doc = documents.get(id);
  return text(doc ? describe(doc) : `No document with id ${id}. Use list_documents.`);
});

server.registerTool('propose_document_edit', { description: 'Propose a change to a Barkdown document. The person reviews it in the document tab and keeps or discards it; never assume it is applied. mode=append adds blocks at the end, mode=replace rewrites the whole document, mode=replace_block replaces one top-level block by index (0-based, as listed by read_document).', inputSchema: { id: z.string(), mode: z.enum(['append', 'replace', 'replace_block']), blockIndex: z.number().int().optional(), markdown: z.string(), summary: z.string().describe('One sentence describing the change') } }, async ({ id, mode, blockIndex, markdown, summary }) => {
  documents.loadAll();
  const doc = documents.get(id);
  if (!doc) return text(`No document with id ${id}.`);
  const proposal = documents.addProposal(id, { mode, blockIndex, markdown, summary, actor: 'agent' });
  return text(`Proposal ${proposal.id} added to "${doc.title}" (rev ${doc.rev}). The person can keep or discard it in the document tab.`);
});

server.registerTool('create_document', { description: 'Create a new document in the Barkdown library from markdown. It opens beside the chat.', inputSchema: { title: z.string(), markdown: z.string() } }, async ({ title, markdown }) => {
  documents.loadAll();
  const doc = documents.create({ title, markdown, actor: 'agent' });
  return text(`Created document ${doc.id} ("${doc.title}") at rev 1.`);
});

server.registerTool('open_website', { description: 'Open a website in a work tab beside the chat so the person can see it. Use your own web tools to read its content.', inputSchema: { url: z.string() } }, async ({ url }) => text(`Opened ${url} beside the chat.`));

server.registerTool('open_project_file', { description: 'Show a file from the working folder in the project editor tab beside the chat (relative path).', inputSchema: { path: z.string() } }, async ({ path }) => text(`Showing ${path} in the project editor.`));

const transport = new StdioServerTransport();
server.connect(transport).catch(error => { console.error(error); process.exit(1); });
