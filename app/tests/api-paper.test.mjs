// Actual API tool loop and HTTP adapter; deterministic provider/server fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const agent = require('../main/agent');
const store = require('../main/store');
const documents = require('../main/documents');
const { captureScope } = require('../main/providers/run-scope');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-api-paper-'));
store.init(path.join(root, 'A')); documents.loadAll();
const localId = documents.list()[0].id;
const original = [{ id: 'one', type: 'paragraph', content: [{ type: 'text', value: 'Original A' }] }, { id: 'table', type: 'table', rows: [['Headerless', 'Keep\nnewline']] }];
let paper = { _id: 'same', title: 'Paper A', rev: 1, blocks: structuredClone(original) }, writes = 0, failRead = false;
const requests = [];
const server = http.createServer(async (req, res) => {
  requests.push({ url: req.url, token: req.headers.authorization });
  res.setHeader('content-type', 'application/json');
  if (failRead) { res.writeHead(503); return res.end(JSON.stringify({ error: { message: 'Paper server unavailable' } })); }
  if (req.url.startsWith('/v1/data/query/owned/')) return res.end(JSON.stringify({ documents: [paper] }));
  if (req.url.startsWith('/v1/data/search/owned?')) return res.end(JSON.stringify({ documents: [paper] }));
  if (req.url.startsWith('/v1/data/doc/owned/paper/same')) return res.end(JSON.stringify(paper));
  if (req.url === '/v1/plugins/bulldocs/papers/same/ops') {
    let body = ''; for await (const part of req) body += part;
    const input = JSON.parse(body);
    if (input.ifRev !== paper.rev) { res.writeHead(412); return res.end(JSON.stringify({ error: { message: 'Stale revision' } })); }
    writes++;
    for (const op of input.ops) {
      if (op.op === 'append-block') paper.blocks.push(op.block);
      else if (op.op === 'remove-block') paper.blocks = paper.blocks.filter(b => b.id !== op.id);
      else if (op.op === 'patch-block') Object.assign(paper.blocks.find(b => b.id === op.id), op.patch);
      else throw new Error('Unexpected fixture operation ' + op.op);
    }
    paper.rev++; return res.end(JSON.stringify({ rev: paper.rev }));
  }
  res.writeHead(404); res.end('{}');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const config = { enabled: true, writes: true, server: `http://127.0.0.1:${server.address().port}`, token: 'fixture-A', dataset: 'owned' };
const scope = captureScope({ storeDir: store.dir(), profileId: '11111111-1111-4111-8111-111111111111', connection: config, context: { chatId: 'a' } });
const call = (name, input = {}) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tool-' + Math.random(), name, input }] });
const done = () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] });
const result = params => params.messages.at(-1).content[0];
async function run(turns, ownedScope = scope) {
  const events = [];
  agent.setClientFactory(() => ({ messages: { stream(params) {
    const turn = turns.shift(); if (!turn) throw new Error('Unexpected extra provider turn');
    const message = typeof turn === 'function' ? turn(params) : turn;
    return { on() { return this; }, async finalMessage() { return message; } };
  } } }));
  const { runId } = await agent.start({ scope: ownedScope, chatId: 'a', provider: 'api', messages: [{ role: 'user', content: 'Work on my paper.' }], settings: { apiKey: 'fixture', forceOnline: true }, send: event => events.push(event) });
  await agent.waitForRunFinish(runId);
  assert(!events.some(e => e.type === 'error'), JSON.stringify(events.filter(e => e.type === 'error')));
  assert.equal(turns.length, 0); return events;
}
try {
  const events = await run([
    call('list_documents'),
    p => { const rows = JSON.parse(result(p).content); assert(rows.some(d => d.id === localId)); assert(rows.some(d => d.id === 'bp:same')); return call('search_documents', { query: 'Paper' }); },
    p => { assert(JSON.parse(result(p).content).some(d => d.id === 'bp:same')); return call('read_document', { id: 'bp:same' }); },
    p => {
      assert.match(result(p).content, /Markdown representation unavailable/); assert.match(result(p).content, /Headerless/);
      // Mutating the ambient store/connection after launch must not rebind A.
      store.init(path.join(root, 'B')); documents.loadAll(); config.server = 'http://127.0.0.1:1'; config.token = 'fixture-B';
      return call('edit_document', { id: 'bp:same', mode: 'append', markdown: 'Agent addition', summary: 'Add a note' });
    },
    p => { assert.match(result(p).content, /Saved edit.*revision 2/); return done(); },
  ]);
  assert.equal(writes, 1); assert.deepEqual(paper.blocks.slice(0, 2), original);
  assert(events.some(e => e.agentEdit && e.target.id === 'same' && e.target.source === 'barkpark' && e.profileId === scope.profileId));
  const receipt = scope.edits.latest('bp:same'); assert.equal(receipt.afterRev, 2);
  assert.equal(require('../main/agent-edits').latest('bp:same'), null);
  assert(requests.every(r => r.token === 'Bearer fixture-A'));
  await scope.edits.undo('bp:same', receipt.id, scope.connection); assert.deepEqual(paper.blocks, original);
  const tableEvents = await run([
    call('read_document', { id: 'bp:same', format: 'structured' }),
    p => { assert.match(result(p).content, /"id": "table"/); return call('edit_table', { id: 'bp:same', blockId: 'table', cells: [{ row: 0, column: 0, text: 'First\nSecond', align: 'center' }], summary: 'Clarify cell' }); },
    p => { assert.match(result(p).content, /Saved table edit/); return done(); },
  ]);
  assert(tableEvents.some(e => e.agentEdit && e.target.id === 'same' && e.target.source === 'barkpark'));
  assert.deepEqual(paper.blocks[1].rows[0][0], { content: [{ type: 'text', value: 'First\nSecond' }], align: 'center' });
  assert.equal(paper.blocks[1].rows[0][1], original[1].rows[0][1]);
  await scope.edits.undo('bp:same', scope.edits.latest('bp:same').id, scope.connection);
  assert.deepEqual(paper.blocks, original);
  let before = writes;
  await run([call('edit_document', { id: 'bp:same', mode: 'append', markdown: 'No read', summary: 'No' }), p => { assert(result(p).is_error); assert.match(result(p).content, /Read the document/); return done(); }]);
  assert.equal(writes, before);
  await run([call('read_document', { id: 'bp:same' }), () => { paper.rev++; return call('edit_document', { id: 'bp:same', mode: 'append', markdown: 'Stale', summary: 'No' }); }, p => { assert(result(p).is_error); assert.match(result(p).content, /changed since/); return done(); }]);
  assert.equal(writes, before);
  const readOnly = captureScope({ storeDir: scope.storeDir, profileId: scope.profileId, connection: { ...scope.connection, writes: false } });
  await run([call('read_document', { id: 'bp:same' }), call('edit_document', { id: 'bp:same', mode: 'append', markdown: 'Disabled', summary: 'No' }), p => { assert(result(p).is_error); assert.match(result(p).content, /editing is off/); return done(); }], readOnly);
  assert.equal(writes, before);
  const offline = captureScope({ storeDir: scope.storeDir, connection: { enabled: false } });
  await run([call('read_document', { id: 'bp:same' }), p => { assert(result(p).is_error); assert.match(result(p).content, /not connected/); return done(); }], offline);
  failRead = true;
  await run([call('list_documents'), p => { assert(result(p).is_error); assert.match(result(p).content, /unavailable/); return done(); }]);
  console.log('PASS actual API loop: local+Paper discovery/search, structured read, captured A connection, remote receipt/Undo, unread/stale/disabled refusal and explicit server errors');
} finally { await new Promise(resolve => server.close(resolve)); }

