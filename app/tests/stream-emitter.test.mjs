import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./helpers/provider-tool-fixture.cjs');
const { createStreamEmitter } = require('../main/providers/stream-emitter');
const runs = require('../main/providers/runs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('text bursts retain order around thinking, tools, replacements and terminal events', () => {
  const output = [], stream = createStreamEmitter(event => output.push(event));
  stream.emit({ type: 'text_delta', text: 'Hello ' });
  stream.emit({ type: 'text_delta', text: 'world' });
  assert.equal(output.length, 1, 'first progress is immediate; following unnumbered chunks wait');
  stream.emit({ type: 'thinking_delta', text: 'Consider ' });
  stream.emit({ type: 'thinking_delta', text: 'this' });
  stream.emit({ type: 'tool_start', tool: 'read', toolUseId: 'one' });
  stream.emit({ type: 'text_delta', text: 'old' });
  stream.emit({ type: 'text_replace', text: 'replacement' });
  stream.emit({ type: 'text_delta', text: ' tail' });
  stream.emit({ type: 'done' }); stream.close();
  assert.deepEqual(output, [
    { type: 'text_delta', text: 'Hello ' }, { type: 'text_delta', text: 'world' },
    { type: 'thinking_delta', text: 'Consider ' }, { type: 'thinking_delta', text: 'this' },
    { type: 'tool_start', tool: 'read', toolUseId: 'one' }, { type: 'text_delta', text: 'old' },
    { type: 'text_replace', text: 'replacement' }, { type: 'text_delta', text: ' tail' }, { type: 'done' },
  ]);
  assert.equal(stream.emit({ type: 'text_delta', text: 'late' }), false);
});

test('sparse streams flush, character bounds and additional metadata never lose content', async () => {
  const output = [], stream = createStreamEmitter(event => output.push(event), { delayMs: 10, maxChars: 8 });
  stream.emit({ type: 'text_delta', text: 'one' });
  await wait(35); assert.equal(output[0].text, 'one');
  stream.emit({ type: 'text_delta', text: '12345' });
  stream.emit({ type: 'text_delta', text: '67890' });
  stream.emit({ type: 'text_delta', text: 'meta', partId: 'separate' });
  stream.emit({ type: 'text_delta', text: '123456789' }); stream.close();
  assert.equal(output.map(e => e.text).join(''), 'one1234567890meta123456789');
  assert.equal(output.find(e => e.partId)?.partId, 'separate');
});

test('timer sink failure is retained without replay or an unhandled exception', async () => {
  let calls = 0, error;
  const stream = createStreamEmitter(() => { if (++calls > 1) throw new Error('Disk refused'); }, { delayMs: 5, onError: e => { error = e; } });
  stream.emit({ type: 'text_delta', text: 'First acknowledged' });
  stream.emit({ type: 'text_delta', text: 'not acknowledged' });
  await wait(30); assert.equal(error.message, 'Disk refused');
  assert.throws(() => stream.emit({ type: 'done' }), /Disk refused/);
  assert.throws(() => stream.close(), /Disk refused/); assert.equal(calls, 2);
});

test('real run sequencing persists combined text before forwarding and survives repository restart', async () => {
  const { createProfileRegistry } = require('../main/profile-registry');
  const { createWorkspaceRepository } = require('../main/workspace-repository');
  const { captureScope } = require('../main/providers/run-scope');
  const { captureChatContext } = require('../main/chat-context');
  const registry = createProfileRegistry(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-stream-durable-')));
  const profile = registry.createProfile({ name: 'Stream' }), repo = createWorkspaceRepository({ registry });
  repo.saveView(profile.id, { version: 1, chats: { chat: { id: 'chat', title: 'Chat', messages: [], tabs: [], draft: '', folder: null } }, order: ['chat'] });
  const scope = captureScope({ profileId: profile.id, storeDir: registry.storeFor(profile.id).storeDir, connection: { enabled: false } });
  const request = { profileId: profile.id, chatId: 'chat', attemptId: randomUUID(), prompt: 'Hello', provider: 'api', images: [] };
  repo.begin(request, { scope, chatContext: captureChatContext(repo.load(profile.id).chats.chat) });
  const visible = [];
  const run = runs.createRun({ chatId: 'chat', provider: 'api', scope, batchText: true, send(event) {
    repo.event(request, event);
    const persisted = createWorkspaceRepository({ registry }).load(profile.id).chats.chat.messages.find(m => m.role === 'assistant');
    assert.equal(persisted.lastSequence, event.sequence); visible.push(event);
  } });
  for (let i = 0; i < 100; i++) run.emit({ type: 'text_delta', text: 'chunk ' });
  assert.equal(visible.length, 1);
  run.emit({ type: 'done' }); await runs.finish(run);
  repo.finish(request, { runId: run.id, driverFinished: true, status: 'completed' });
  assert.deepEqual(visible.map(e => e.sequence), [1, 2, 3]);
  assert.equal(repo.load(profile.id).chats.chat.messages.find(m => m.role === 'assistant').text, 'chunk '.repeat(100));
});

test('cancel and completion flush each owned run separately before releasing it', async () => {
  const { captureScope } = require('../main/providers/run-scope');
  const scope = captureScope({ storeDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bd-stream-lifecycle-')), connection: { enabled: false } });
  const output = [];
  const a = runs.createRun({ chatId: 'a', provider: 'api', scope, batchText: true, send: e => output.push(e), onFinish() { assert.ok(output.some(e => e.chatId === 'a' && e.text === 'A')); } });
  const b = runs.createRun({ chatId: 'b', provider: 'api', scope, batchText: true, send: e => output.push(e) });
  a.emit({ type: 'text_delta', text: 'A' }); b.emit({ type: 'text_delta', text: 'B' });
  a.emit({ type: 'text_delta', text: 'A tail' }); b.emit({ type: 'text_delta', text: 'B tail' });
  runs.cancel(a.id); assert.deepEqual(output.map(e => e.text), ['A', 'B', 'A tail']);
  await runs.finish(a); await runs.finish(b);
  assert.deepEqual(output.map(e => [e.chatId, e.text, e.sequence]), [['a', 'A', 1], ['b', 'B', 1], ['a', 'A tail', 2], ['b', 'B tail', 2]]);
});

test('failed buffered persistence cannot become a successful terminal acknowledgement', async () => {
  const { captureScope } = require('../main/providers/run-scope');
  const scope = captureScope({ storeDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bd-stream-fault-')), connection: { enabled: false } });
  let released = 0, calls = 0;
  const run = runs.createRun({ chatId: 'fault', provider: 'api', scope, batchText: true,
    send() { if (++calls > 1) throw new Error('Persistence unavailable'); }, onFinish() { released++; } });
  run.emit({ type: 'text_delta', text: 'First acknowledged' });
  run.emit({ type: 'text_delta', text: 'Retain failure' });
  await wait(140); assert.equal(run.cancelled, true);
  assert.throws(() => run.emit({ type: 'done' }), /Persistence unavailable/);
  await runs.finish(run);
  const result = await runs.waitForRunFinish(run.id);
  assert.equal(result.status, 'failed'); assert.equal(released, 1); assert.equal(calls, 2);
});

test('quiescence before a buffered chunk is admitted refuses it without forwarding or rebinding', async () => {
  const { createStore } = require('../main/store');
  const { captureScope } = require('../main/providers/run-scope');
  const { controller } = require('../main/writer-admission');
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-stream-quiescent-')));
  const scope = captureScope({ storeDir: store.dir(), connection: { enabled: false } });
  const visible = [];
  const run = runs.createRun({ chatId: 'old', provider: 'api', scope, batchText: true,
    send(event) { scope.writer.run('test.stream', () => { store.writeJson('received.json', event); }); visible.push(event); } });
  run.emit({ type: 'text_delta', text: 'Before preparation' });
  run.emit({ type: 'text_delta', text: 'Old generation' });
  const control = controller(store), barrier = control.quiesce(scope.writerToken);
  assert.throws(() => run.emit({ type: 'done' }), { code: 'writer_stale' });
  await runs.finish(run);
  assert.equal((await runs.waitForRunFinish(run.id)).status, 'failed');
  assert.equal(visible.length, 1); assert.equal(store.readJson('received.json', null).text, 'Before preparation');
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
});

const agent = require('../main/agent');
for (const provider of ['api', 'claude', 'codex']) {
  for (const failure of ['buffered-text', 'error-report']) {
    test(`${provider} finalizes once when ${failure} persistence refuses`, async t => {
      const transport = provider === 'api' ? null : require(`../main/providers/${provider}`);
      const sdkFailure = new Error('Synthetic provider failure');
      async function* chunks() {
        yield 'first';
        if (failure === 'error-report') throw sdkFailure;
        yield 'pending'; await wait(150);
      }
      if (provider === 'api') agent.setClientFactory(() => ({ messages: { stream() {
        let text;
        return { on(name, fn) { if (name === 'text') text = fn; return this; }, async finalMessage() {
          for await (const chunk of chunks()) text(chunk);
          return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: 'firstpending' }] };
        } };
      } } }));
      if (provider === 'claude') transport.setSdkLoader(async () => ({ query() {
        const iterator = (async function* () { for await (const text of chunks()) yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } }; })();
        iterator.interrupt = async () => {}; return iterator;
      } }));
      if (provider === 'codex') transport.setSdkLoader(async () => ({ Codex: class {
        startThread() { return { id: 'fixture', async runStreamed() { return { events: (async function* () {
          let text = ''; for await (const chunk of chunks()) { text += chunk; yield { type: 'item.updated', item: { id: 'reply', type: 'agent_message', text } }; }
        })() }; } }; }
      } }));
      t.after(() => { agent.setClientFactory(null); transport?.setSdkLoader(null); });
      let calls = 0, released = 0; const visible = [];
      const started = await agent.start({ provider, chatId: 'refusal', prompt: 'test', messages: [{ role: 'user', content: 'test' }], context: { folder: null }, settings: { forceOnline: true, apiKey: 'fixture' }, connection: { enabled: false }, storeDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bd-driver-refusal-')), onFinish() { released++; }, send(event) {
        calls++; if ((failure === 'buffered-text' && calls > 1) || event.type === 'error') throw Error('Durable sink refused');
        visible.push(event);
      } });
      const result = await runs.waitForRunFinish(started.runId);
      await wait(20);
      assert.equal(result.status, 'failed'); assert.equal(result.message, 'Durable sink refused');
      assert.equal(released, 1); assert.equal(calls, 2); assert.equal(runs.runs.has(started.runId), false);
      assert.deepEqual(visible.map(e => e.text), ['first']);
    });
  }
}
