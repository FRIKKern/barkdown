import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const require = createRequire(import.meta.url);
const store = require('../main/store');
const documents = require('../main/documents');
const { runs, cancel, captureScope, createRun, finish, waitForRunFinish, activityForTool, mcpServerSpec } = require('../main/providers/runs');
const agent = require('../main/agent');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-run-owners-'));
const rootA = path.join(root, 'a'), rootB = path.join(root, 'b');
// Fixture tools (C088 S4): a provider finds and checks its tool before the SDK; these answer like the real ones.
const toolsDir = path.join(root, 'tools'); fs.mkdirSync(toolsDir, { recursive: true });
const fixtureTool = (name, answer) => { const file = path.join(toolsDir, name); fs.writeFileSync(file, `#!/bin/sh\necho "${answer}"\n`); fs.chmodSync(file, 0o755); return file; };
const providerBinary = { claude: fixtureTool('claude', '9.9.9 (Claude Code)'), codex: fixtureTool('codex', 'codex-cli 9.9.9') };
const idA = crypto.randomUUID(), idB = crypto.randomUUID();
const oldToken = process.env.BARKDOWN_BP_TOKEN;
const checks = [];
try {
  store.init(rootA); documents.loadAll();
  store.createStore(rootB);
  const context = { folder: path.join(root, 'folder-a'), nested: { intent: 'A' } };
  const connection = { server: 'http://127.0.0.1:12345', enabled: true, writes: true, token: 'test-A', dataset: 'production' };
  const a = captureScope({ profileId: idA, storeDir: rootA, context, connection });
  const b = captureScope({ profileId: idB, storeDir: rootB, context: { folder: null }, connection: { enabled: false, token: 'test-B' } });
  const docA = a.documents.create({ title: 'Same title', markdown: 'owner A' });
  const docB = b.documents.create({ title: 'Same title', markdown: 'owner B' });
  assert.equal(docA.id, docB.id);
  a.store.writeJson('workspace.json', { chats: { same: { id: 'same', title: 'Chat A', messages: [{ role: 'user', text: 'A secret' }] } } });
  b.store.writeJson('workspace.json', { chats: { same: { id: 'same', title: 'Chat B', messages: [{ role: 'user', text: 'B secret' }] } } });
  assert.match(a.conversations.readConversation('same'), /A secret/);
  assert.doesNotMatch(a.conversations.readConversation('same'), /B secret/);
  context.folder = 'changed'; context.nested.intent = 'B'; connection.token = 'test-B';
  process.env.BARKDOWN_BP_TOKEN = 'ambient-B';
  store.init(rootB); documents.loadAll();
  assert.equal(a.context.nested.intent, 'A');
  assert.equal(a.context.folder, path.join(root, 'folder-a'));
  assert.equal(a.connection.token, 'test-A');
  assert.equal(a.env.BARKDOWN_BP_TOKEN, 'test-A');
  assert.equal(a.env.BARKPARK_API_TOKEN, 'test-A');
  assert.throws(() => a.store.init(rootB), /cannot change/);
  checks.push('captured nested context, connection, store and same-ID conversations');

  const events = [];
  const run = createRun({ chatId: 'same', scope: a, provider: 'codex', send: e => events.push(e) });
  run.emit({ type: 'status', profileId: idB, chatId: 'other', runId: 'fake', provider: 'fake' });
  assert.equal(events[0].profileId, idA); assert.equal(events[0].chatId, 'same');
  assert.equal(events[0].runId, run.id); assert.equal(events[0].provider, 'codex');
  const readActivity = activityForTool(run, 'mcp__barkdown__read_document', { id: docA.id });
  assert.equal(readActivity.target.id, docA.id);
  const duplicate = a.documents.create({ title: 'Same title', markdown: 'second A' });
  const created = activityForTool(run, 'mcp__barkdown__create_document', { title: 'Same title' }, `Created document ${duplicate.id} ("Same title") at rev 1.`);
  assert.equal(created.target.id, duplicate.id);
  assert.equal(activityForTool(run, 'mcp__barkdown__create_document', { title: 'Same title' }), null);
  assert.equal(documents.get(docA.id).markdown.trim(), 'owner B');
  finish(run);
  const legacyEvents = [], legacyRun = createRun({ chatId: 'legacy', context: {}, send: e => legacyEvents.push(e), provider: 'api' });
  legacyRun.emit({ type: 'status', profileId: idB });
  assert.equal(legacyEvents[0].profileId, null);
  store.init(rootA);
  assert.equal(legacyRun.scope.storeDir, rootB);
  finish(legacyRun);
  checks.push('authoritative event envelope and exact acknowledged create identity');

  // Legacy retirement R4: the app's edit service refuses a legacy note before any writer or receipt.
  await assert.rejects(a.edits.apply({ id: docA.id, baseRev: 1, mode: 'append', markdown: 'changed A' }), /read-only/);
  assert.equal(a.edits.latest(docA.id), null); assert.equal(b.edits.latest(docB.id), null);
  assert.equal(a.documents.reload(docA.id).markdown.trim(), 'owner A'); assert.equal(b.documents.reload(docB.id).markdown.trim(), 'owner B');
  checks.push('a legacy edit is refused by the bound scope and neither same-slug store changes');

  for (const name of ['../b/workspace.json', path.join(rootB, 'workspace.json'), 'documents/../../b/workspace.json', 'documents/alternate:stream']) {
    assert.throws(() => a.store.readJson(name, null), /path/);
    assert.throws(() => a.store.writeJson(name, {}), /path/);
  }
  assert.throws(() => a.documents.reload('../../b/workspace'), /Invalid local/);
  assert.throws(() => a.documents.save({ id: '../../b/workspace' }), /Invalid local/);
  fs.symlinkSync(rootB, path.join(rootA, 'junction'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => a.store.readJson('junction/workspace.json', null), /symbolic link/);
  assert.throws(() => a.store.writeJson('junction/new.json', {}), /symbolic link/);
  checks.push('path traversal, alternate stream and junction escape rejected');

  const spec = mcpServerSpec(rootA, a);
  assert.equal(JSON.parse(spec.env.BARKDOWN_RUN_CONNECTION).token, 'test-A');
  assert.equal(spec.args.at(-1), rootA);
  assert.throws(() => captureScope({ profileId: idA, storeDir: rootA, connection: { viaCli: true } }), /shared CLI/);
  const localScope = captureScope({ profileId: idA, storeDir: rootA, connection: { enabled: false } });
  const client = new Client({ name: 'run-ownership', version: '1.0.0' });
  await client.connect(new StdioClientTransport(mcpServerSpec(rootA, localScope)));
  try {
    a.store.writeJson('barkpark.json', { enabled: true, server: 'http://127.0.0.1:1', token: 'wrong' });
    const foreign = await client.callTool({ name: 'read_document', arguments: { id: '../../b/workspace' } });
    assert(foreign.isError || foreign.content.some(c => /No document|Invalid local/.test(c.text || '')));
    const remote = await client.callTool({ name: 'read_document', arguments: { id: 'bp:same' } });
    assert.match(remote.content[0].text, /not connected/);
    const transcript = await client.callTool({ name: 'read_conversation', arguments: { id: 'same' } });
    assert.match(transcript.content[0].text, /A secret/);
    assert.doesNotMatch(transcript.content[0].text, /B secret/);
  } finally { await client.close(); }
  checks.push('real stdio MCP retains captured disabled connection and owner after flag change');

  const emptyRoot = path.join(root, 'empty'); fs.mkdirSync(emptyRoot);
  fs.writeFileSync(path.join(emptyRoot, 'workspace.json'), '{incomplete');
  const beforeEmpty = fs.readdirSync(emptyRoot);
  captureScope({ storeDir: emptyRoot, connection: { enabled: false } });
  assert.deepEqual(fs.readdirSync(emptyRoot), beforeEmpty, 'capture must not seed or create directories');
  assert.throws(() => captureScope({ storeDir: path.join(root, 'missing') }), /unavailable/);
  assert(!fs.existsSync(path.join(root, 'missing')));
  checks.push('capture is read-only for empty/corrupt fixtures and rejects missing roots');

  // A real API tool loop waits while the active legacy root changes to B.
  let releaseApi, calls = 0;
  agent.setClientFactory(() => ({ messages: { stream() {
    const first = ++calls === 1;
    return {
      on() { return this; },
      async finalMessage() { if (first) await new Promise(resolve => { releaseApi = resolve; }); return first ? { content: [{ type: 'tool_use', id: 'read-A', name: 'read_document', input: { id: docA.id } }], stop_reason: 'tool_use' }
        : { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' }; },
    };
  } } }));
  const apiEvents = [];
  const apiDone = new Promise(resolve => {
    agent.start({ profileId: idA, storeDir: rootA, chatId: 'same', context: { folder: null }, provider: 'api',
      connection: { enabled: false }, settings: { apiKey: 'fixture', forceOnline: true }, messages: [{ role: 'user', content: 'read' }],
      send: event => { apiEvents.push(event); if (event.type === 'done' || event.type === 'error') resolve(); } });
  });
  store.init(rootB); documents.loadAll(); releaseApi(); await apiDone;
  assert(apiEvents.every(event => event.profileId === idA));
  assert.match(apiEvents.find(event => event.type === 'tool_result').output, /owner A/);
  assert.doesNotMatch(apiEvents.find(event => event.type === 'tool_result').output, /owner B/);
  checks.push('delayed real API tool loop reads A after foreground store changes to B');

  // Shared dispatch is synchronous through scope creation; transport proceeds later.
  for (const provider of ['claude', 'codex']) {
    const transport = require('../main/providers/' + provider), original = transport.start;
    let resume, observed;
    transport.start = async params => { await new Promise(resolve => { resume = resolve; }); observed = params; return { runId: 'captured-test' }; };
    const ctx = { folder: 'folder-A' }, settings = { model: 'A', effort: 'high' };
    try {
      const pending = agent.start({ chatId: 'same', provider, profileId: idA, storeDir: rootA, context: ctx, settings, connection: { enabled: false, token: 'A' }, prompt: 'Where am I?', messages: [] });
      ctx.folder = 'folder-B'; settings.model = 'B'; store.init(rootB); process.env.BARKDOWN_BP_TOKEN = 'B'; resume(); await pending;
      assert.equal(observed.context.folder, 'folder-A');
      assert.equal(observed.scope.storeDir, rootA);
      assert.equal(observed.scope.connection.token, 'A');
      assert.equal(observed.settings.model, 'A');
      assert.match(observed.prompt, /folder-A/);
    } finally { transport.start = original; }
  }
  checks.push('shared Claude/Codex dispatch captures before delayed transport');

  for (const provider of ['claude', 'codex']) {
    const transport = require('../main/providers/' + provider);
    let releaseSdk, observed, threadOptions;
    transport.setSdkLoader(() => new Promise(resolve => { releaseSdk = resolve; }));
    const settings = { claudeModel: 'model-A', codexModel: 'model-A', effort: 'high', providerBinary };
    const ctx = { folder: path.join(root, 'folder-A') }, captured = [];
    const finished = new Promise(resolve => {
      transport.start({ chatId: 'same', profileId: idA, storeDir: rootA, context: ctx, settings,
        connection: { enabled: true, server: 'http://127.0.0.1:12345', token: 'captured-A' }, prompt: 'hello',
        send: event => { captured.push(event); if (event.type === 'done' || event.type === 'error') resolve(); } });
    });
    ctx.folder = 'folder-B'; settings.claudeModel = 'model-B'; settings.codexModel = 'model-B'; settings.effort = 'low';
    process.env.BARKDOWN_BP_TOKEN = 'ambient-B';
    const fakeSdk = provider === 'claude' ? { query({ options }) {
      observed = options;
      return { async *[Symbol.asyncIterator]() { yield { type: 'result', subtype: 'success', result: 'done' }; } };
    } } : { Codex: class {
      constructor(options) { observed = options; }
      startThread(options) { threadOptions = options; return { id: 'test', async runStreamed() { return { events: (async function* () { yield { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'done' } }; })() }; } }; }
    } };
    try {
      releaseSdk(fakeSdk); await finished;
      assert(!captured.some(event => event.type === 'error'), JSON.stringify(captured));
      const mcp = provider === 'claude' ? observed.mcpServers.barkdown : observed.config.mcp_servers.barkdown;
      assert.equal(JSON.parse(mcp.env.BARKDOWN_RUN_CONNECTION).token, 'captured-A');
      assert.equal(observed.env.BARKDOWN_BP_TOKEN, 'captured-A');
      assert.equal(observed.env.BARKPARK_API_TOKEN, 'captured-A');
      assert.equal(provider === 'claude' ? observed.model : threadOptions.model, 'model-A');
      assert.equal(provider === 'claude' ? observed.cwd : threadOptions.workingDirectory, path.join(root, 'folder-A'));
    } finally { transport.setSdkLoader(null); }
  }
  checks.push('actual provider SDK launch after delayed load retains model, cwd and private MCP/environment owner');
  for (const provider of ['claude', 'codex']) {
    const transport = require('../main/providers/' + provider);
    let releaseSdk, cleanupCalls = 0, launched = false;
    transport.setSdkLoader(() => new Promise(resolve => { releaseSdk = resolve; }));
    try {
      const { runId } = transport.start({ chatId: 'cancel-loading', scope: a, prompt: 'cancel me', settings: { providerBinary }, send() {}, onFinish: async () => { cleanupCalls++; } });
      const completion = waitForRunFinish(runId);
      cancel(runId);
      releaseSdk(provider === 'claude' ? { query() { launched = true; throw Error('should not launch'); } } : { Codex: class { constructor() { launched = true; throw Error('should not launch'); } } });
      const result = await completion;
      assert.equal(launched, false); assert.equal(cleanupCalls, 1); assert.equal(result.status, 'cancelled');
      assert.deepEqual(await waitForRunFinish(runId), result);
    } finally { transport.setSdkLoader(null); }
  }
  checks.push('cancelling delayed SDK load prevents launch and acknowledges driver finalization');
  let released = 0, releaseLease;
  const owned = createRun({ chatId: 'lease', scope: a, provider: 'api', send() {}, onFinish: async owner => {
    assert.equal(owner.profileId, idA); assert.equal(owner.cancelled, true);
    released++; await new Promise(resolve => { releaseLease = resolve; });
  } });
  cancel(owned.id); assert.equal(released, 0, 'cancellation cannot release a still-running transport');
  let acknowledged = false;
  const acknowledgement = waitForRunFinish(owned.id).then(result => { acknowledged = true; return result; });
  const firstFinish = finish(owned), secondFinish = finish(owned);
  await Promise.resolve();
  assert.equal(released, 1); assert(runs.has(owned.id)); assert.equal(acknowledged, false); releaseLease();
  assert.deepEqual(await firstFinish, { ok: true }); assert.deepEqual(await secondFinish, { ok: true });
  assert(!runs.has(owned.id));
  assert.equal((await acknowledgement).status, 'cancelled');
  const failedEvents = [], failed = createRun({ chatId: 'lease-fail', scope: a, provider: 'api', send: e => failedEvents.push(e), onFinish: async () => { throw new Error('fixture cleanup failure'); } });
  assert.equal((await finish(failed)).ok, false); assert(!runs.has(failed.id));
  assert(failedEvents.some(e => e.cleanupFailed && e.profileId === idA));
  assert.equal((await waitForRunFinish(failed.id)).status, 'cleanup-failed');
  await assert.rejects(waitForRunFinish('unknown'), /Unknown/);
  checks.push('exactly-once awaited cleanup retains cancelled lease until transport finally and reports failure');
  console.log(JSON.stringify({ checks, root, retained: true }));
} finally {
  if (oldToken === undefined) delete process.env.BARKDOWN_BP_TOKEN; else process.env.BARKDOWN_BP_TOKEN = oldToken;
}
