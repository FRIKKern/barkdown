import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
const { captureScope } = require('../main/providers/run-scope');
const { mcpServerSpec } = require('../main/providers/runs');
const { controller } = require('../main/writer-admission');

test('Node and Electron agree on the same durable store identity', () => {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-runtime-')));
  const control = controller(store), token = control.capture();
  control.run(token, 'test.initialize', () => {});
  const code = `const {createStore}=require(${JSON.stringify(require.resolve('../main/store'))});
    const {controller}=require(${JSON.stringify(require.resolve('../main/writer-admission'))});
    console.log(JSON.stringify(controller(createStore(process.argv[1],{create:false})).capture(JSON.parse(process.argv[2]))));`;
  const actual = JSON.parse(execFileSync(require('electron'), ['-e', code, store.dir(), JSON.stringify(token)], { encoding: 'utf8', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }));
  assert.deepEqual(actual, token);
});

test('a surviving real MCP child refuses stale create/edit and keeps original reads', { timeout: 15000 }, async () => {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-mcp-')));
  const documents = createDocuments(store), doc = documents.create({ title: 'Kept original', markdown: 'Original body' });
  const scope = captureScope({ storeDir: store.dir(), connection: { enabled: false } });
  const spec = mcpServerSpec(store.dir(), scope);
  assert.deepEqual(JSON.parse(spec.env.BARKDOWN_WRITER_TOKEN), scope.writerToken);
  const transport = new StdioClientTransport({ ...spec, stderr: 'pipe' });
  const client = new Client({ name: 'writer-fence-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const read = await client.callTool({ name: 'read_document', arguments: { id: doc.id } });
    assert.match(read.content[0].text, /Original body/);
    const before = fs.readFileSync(store.filePath(`documents/${doc.id}.json`));
    const control = controller(store), barrier = control.quiesce(scope.writerToken);
    // Legacy retirement R4: legacy writes are refused before the fence is consulted; the store stays as it was either way.
    // Without a library create_document is not offered at all (C089 F1): the stronger refusal.
    const response = await client.callTool({ name: 'edit_document', arguments: { id: doc.id, mode: 'append', markdown: 'Forbidden', summary: 'Stale' } });
    assert.equal(response.isError, true); assert.match(response.content[0].text, /earlier library generation|read-only|no local runtime/);
    const absent = await client.callTool({ name: 'create_document', arguments: { title: 'Forbidden', markdown: 'Stale' } });
    assert.equal(absent.isError, true); assert.match(absent.content[0].text, /not found/);
    const retained = await client.callTool({ name: 'read_document', arguments: { id: doc.id } });
    assert.match(retained.content[0].text, /Original body/);
    assert.deepEqual(fs.readFileSync(store.filePath(`documents/${doc.id}.json`)), before);
    assert.equal(documents.get('forbidden'), null);
    assert.equal(control.assertQuiescent(barrier).quiescent, true);
  } finally { await client.close(); }
});

test('a delayed real owned goal worker cannot recapture a newer generation', { timeout: 30000 }, async () => {
  const { launchOwnedWorker } = require('../main/goal-process');
  const { createGoalWorkerAgent } = require('../main/goal-worker-agent');
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-goal-')));
  const scope = captureScope({ profileId: randomUUID(), storeDir: store.dir(), connection: { enabled: false }, context: { chatId: 'worker' } });
  let release; const held = new Promise(resolve => release = resolve);
  const events = [];
  const worker = createGoalWorkerAgent({ launch: async options => {
    const host = await launchOwnedWorker(options);
    return { ...host, ready: host.ready.then(() => held) };
  } });
  const started = await worker.start({ scope, profileId: scope.profileId, chatId: 'worker', provider: 'api', attemptId: randomUUID(),
    settings: {}, prompt: 'Must not dispatch', messages: [], images: [], send: event => events.push(event) });
  const control = controller(store), barrier = control.quiesce(scope.writerToken);
  release();
  await worker.waitForRunFinish(started.runId);
  assert.ok(events.some(e => e.type === 'error' && /earlier library generation/.test(e.message)), JSON.stringify(events));
  assert.equal(events.some(e => e.type === 'text' || e.type === 'tool_start'), false);
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
});

test('a new read-only MCP child can list a quiescent empty legacy store without seeding it', { timeout: 15000 }, async () => {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-empty-')));
  const control = controller(store), barrier = control.quiesce(control.capture());
  const scope = captureScope({ storeDir: store.dir(), connection: { enabled: false } });
  const transport = new StdioClientTransport({ ...mcpServerSpec(store.dir(), scope), stderr: 'pipe' });
  const client = new Client({ name: 'writer-empty-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.callTool({ name: 'list_documents', arguments: {} });
    assert.deepEqual(JSON.parse(listed.content[0].text), []);
    // No library: create_document is not offered (C089 F1), so nothing can seed the store.
    const refused = await client.callTool({ name: 'create_document', arguments: { title: 'Forbidden', markdown: 'No seed' } });
    assert.equal(refused.isError, true); assert.match(refused.content[0].text, /not found/);
    assert.deepEqual(store.list('documents', '.json'), []);
    assert.equal(control.assertQuiescent(barrier).quiescent, true);
  } finally { await client.close(); }
});
