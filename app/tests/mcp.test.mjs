// The Barkdown document MCP server, driven by a real MCP client over stdio against a throwaway store.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-mcp-'));

const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(here, '..', 'main', 'mcp-server.js'), storeDir] });
const client = new Client({ name: 'barkdown-test', version: '0.0.0' });
await client.connect(transport);

const tools = (await client.listTools()).tools.map(t => t.name).sort();
assert(['create_document', 'list_conversations', 'list_documents', 'open_project_file', 'open_website', 'propose_document_edit', 'read_conversation', 'read_document', 'search_documents'].every(t => tools.includes(t)), 'tools missing: ' + tools.join(','));
{
  fs.writeFileSync(path.join(storeDir, 'workspace.json'), JSON.stringify({ version: 1, chats: {
    main1: { id: 'main1', title: 'Trip to Bergen', side: false, parent: null, updatedAt: '2026-09-18T10:00:00Z', tabs: [{ title: 'Overview' }], messages: [{ role: 'user', text: 'Plan a weekend in Bergen.', at: '2026-09-18T09:58:00Z' }, { role: 'assistant', text: 'Two days: Bryggen and Fløyen first.', at: '2026-09-18T09:59:00Z', tools: [{ tool: 'read_document' }], events: [{ label: 'Opened Overview' }] }] },
    side1: { id: 'side1', title: 'Side chat', side: true, parent: 'main1', updatedAt: '2026-09-18T10:05:00Z', tabs: [], messages: [{ role: 'user', text: 'Is Fløyen worth it?', at: '2026-09-18T10:04:00Z' }] },
  }, order: ['main1'] }));
  const rows = JSON.parse((await client.callTool({ name: 'list_conversations', arguments: {} })).content[0].text);
  assert(rows.length === 2 && rows[0].id === 'side1' && rows[0].kind === 'side chat' && rows[0].parent?.id === 'main1', 'list_conversations rows wrong: ' + JSON.stringify(rows).slice(0, 200));
  const transcript = (await client.callTool({ name: 'read_conversation', arguments: { id: 'main1' } })).content[0].text;
  assert(transcript.includes('# Trip to Bergen') && transcript.includes('Bryggen') && transcript.includes('opened: Opened Overview'), 'read_conversation transcript wrong: ' + transcript.slice(0, 200));
  assert((await client.callTool({ name: 'read_conversation', arguments: { id: 'nope' } })).content[0].text.startsWith('No conversation'), 'unknown id should say so');
}
const list = JSON.parse((await client.callTool({ name: 'list_documents', arguments: {} })).content[0].text);
assert(list.length === 2, 'seeded library should have two documents');
const overview = list.find(d => d.title === 'Overview');
const read = (await client.callTool({ name: 'read_document', arguments: { id: overview.id } })).content[0].text;
assert(read.includes('# Overview') && read.includes('Top-level blocks'), 'read_document did not return markdown with block indexes');
const proposed = (await client.callTool({ name: 'propose_document_edit', arguments: { id: overview.id, mode: 'append', markdown: '## From MCP\n\nAdded via the tool.', summary: 'Add a section' } })).content[0].text;
assert(proposed.includes('Saved edit'), 'legacy alias did not apply directly');
const created = (await client.callTool({ name: 'create_document', arguments: { title: 'MCP made this', markdown: 'Hello from **MCP**.' } })).content[0].text;
assert(created.includes('Created document mcp-made-this'), 'create_document failed: ' + created);
const search = JSON.parse((await client.callTool({ name: 'search_documents', arguments: { query: 'hello' } })).content[0].text);
assert(search.some(d => d.id === 'mcp-made-this'), 'search did not find the new document');

// The main process reads the same files: proposals written by the MCP process are visible after reload().
const store = require('../main/store.js'); const documents = require('../main/documents.js');
store.init(storeDir); documents.loadAll();
assert(documents.get(overview.id).proposals.length === 0 && documents.get(overview.id).markdown.includes('Added via the tool.'), 'main process does not see the direct MCP edit');
const unseen = await client.callTool({name:'edit_document', arguments:{id:'interaction-notes',mode:'append',markdown:'unsafe',summary:'unsafe'}});
assert(unseen.isError, 'unread document accepted an edit');
const current = documents.get(overview.id);
documents.save({id:current.id,baseRev:current.rev,content:current.content,summary:'Concurrent user edit'});
const stale = await client.callTool({name:'edit_document', arguments:{id:overview.id,mode:'append',markdown:'stale edit',summary:'stale'}});
assert(stale.isError, 'stale agent edit was not rejected');
const edits = require('../main/agent-edits');
let blocked = false; try { await edits.undo(overview.id, edits.latest(overview.id).id); } catch { blocked = true; }
assert(blocked, 'Undo overwrote a later user edit');
assert(documents.get('mcp-made-this').markdown.includes('**MCP**'), 'main process does not see the MCP document');

await client.close();
fs.rmSync(storeDir, { recursive: true, force: true });
console.log('MCP server checks passed.');
