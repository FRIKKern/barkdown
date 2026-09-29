import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { controller, writerForStore } = require('../main/writer-admission');
const { createDocuments } = require('../main/documents');
const { createAgentEdits } = require('../main/agent-edits');
const { captureScope } = require('../main/providers/run-scope');
const fixture = () => { const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-'))); return { store, control: controller(store) }; };

test('real HTTP creation stays admitted through delayed acknowledgement, readback and durable receipt', { timeout: 10000 }, async () => {
  const { createDraftNotes } = require('../main/draft-notes');
  const { store, control } = fixture(), token = control.capture();
  let acknowledge, reached; const dispatched = new Promise(resolve => reached = resolve);
  let row, posts = 0;
  const server = http.createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST') {
      posts++; let body = ''; for await (const chunk of request) body += chunk;
      const d = JSON.parse(body).mutations[0].create;
      row = { ...d, _id: 'drafts.' + d._id, _publishedId: d._id, _draft: true, _rev: 'acknowledged' };
      acknowledge = () => response.end(JSON.stringify({ results: [{ document: row }] })); reached();
    } else response.end(JSON.stringify({ result: row }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const requestId = crypto.randomUUID();
  const notes = createDraftNotes({ store, profileId: crypto.randomUUID(), paperOwner: 'a'.repeat(64), assertOwned() {},
    config: { enabled: true, writes: true, server: 'http://127.0.0.1:' + server.address().port, dataset: 'test' } });
  const created = notes.create(requestId, { title: 'Delayed acknowledgement', markdown: 'Retain this' });
  try {
    await dispatched;
    assert.equal(store.readJson('paper-creation/' + requestId + '.json').status, 'sent');
    const barrier = control.quiesce(token);
    assert.throws(() => control.assertQuiescent(barrier), { code: 'writer_pending' });
    await assert.rejects(notes.create(crypto.randomUUID()), { code: 'writer_stale' });
    acknowledge(); await created;
    assert.equal(posts, 1);
    assert.equal(store.readJson('paper-creation/' + requestId + '.json').status, 'complete');
    assert.equal(control.assertQuiescent(barrier).quiescent, true);
  } finally { acknowledge?.(); await created.catch(() => {}); await new Promise(resolve => server.close(resolve)); }
});

test('quiescence keeps an async mutation admitted through its receipt and rejects successors', async () => {
  const { store, control } = fixture(), writer = writerForStore(store);
  let release; const held = new Promise(r => release = r);
  const write = writer.run('test.remote', async () => { await held; writer.run('test.receipt', () => store.writeJson('receipt.json', { acknowledged: true })); });
  assert.equal(control.inspect().pending.length, 1);
  const barrier = control.quiesce(writer.token);
  assert.throws(() => writer.run('test.new', () => assert.fail('stale action executed')), { code: 'writer_stale' });
  assert.throws(() => control.assertQuiescent(barrier), { code: 'writer_pending' });
  release(); await write;
  assert.equal(store.readJson('receipt.json').acknowledged, true);
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
  const fresh = writerForStore(store);
  assert.throws(() => fresh.run('test.closed', () => assert.fail()), { code: 'writer_closed' });
});

test('bound documents and captured API scopes retain the old generation; reads survive', async () => {
  const { store, control } = fixture(), documents = createDocuments(store);
  const doc = documents.create({ title: 'Original', markdown: 'Keep me' });
  const scope = captureScope({ storeDir: store.dir(), connection: { enabled: false } });
  const edits = createAgentEdits({ store, documents });
  const edit = await edits.apply({ id: doc.id, baseRev: doc.rev, mode: 'append', markdown: 'Agent', summary: 'Append' });
  await edits.undo(doc.id, edit.id);
  const before = fs.readFileSync(store.filePath('documents/' + doc.id + '.json'));
  const barrier = control.quiesce(documents.writer.token);
  for (const action of [() => documents.create({ title: 'Rejected' }), () => documents.save({ id: doc.id }), () => documents.remove(doc.id), () => scope.documents.create({ title: 'Rejected API' })]) assert.throws(action, { code: 'writer_stale' });
  await assert.rejects(edits.apply({ id: doc.id, baseRev: 3, mode: 'append', markdown: 'Rejected' }), { code: 'writer_stale' });
  assert.equal(documents.get(doc.id).title, 'Original');
  assert.deepEqual(fs.readFileSync(store.filePath('documents/' + doc.id + '.json')), before);
  assert.throws(() => captureScope({ storeDir: store.dir(), connection: { enabled: false }, writerToken: scope.writerToken }), { code: 'writer_stale' });
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
});

test('foreign tokens and nested owners refuse without changing either document store', () => {
  const a = fixture(), b = fixture(), wa = writerForStore(a.store), wb = writerForStore(b.store);
  assert.throws(() => writerForStore(b.store, { token: wa.token }), { code: 'writer_stale' });
  assert.throws(() => wa.run('test.outer', () => wb.run('test.foreign', () => assert.fail())), { code: 'writer_nested' });
  assert.equal(a.control.inspect().pending[0].status, 'uncertain');
  assert.equal(b.control.inspect().pending.length, 0);
});

test('failed or unawaited work cannot erase or reuse an admission', async () => {
  const { store, control } = fixture(), writer = writerForStore(store);
  let delayed;
  writer.run('test.parent', () => { delayed = new Promise(resolve => setImmediate(() => {
    assert.throws(() => writer.run('test.late', () => assert.fail()), { code: 'writer_nested' }); resolve();
  })); });
  await delayed;
  await assert.rejects(writer.run('test.uncertain', async () => { store.writeJson('partial.json', { changed: true }); throw new Error('Lost acknowledgement'); }), /Lost acknowledgement/);
  const barrier = control.quiesce(writer.token);
  assert.throws(() => control.assertQuiescent(barrier), { code: 'writer_pending' });
  assert.equal(control.inspect().pending[0].status, 'uncertain');
  assert.equal(store.readJson('partial.json').changed, true);
});

test('missing or malformed metadata is retained and never reset by a fresh handle', () => {
  for (const mode of ['missing', 'malformed', 'foreign']) {
    const { store, control } = fixture(), token = control.capture();
    control.run(token, 'test.initialize', () => {});
    const original = fs.readFileSync(store.filePath('writer-state.json'));
    if (mode === 'missing') fs.renameSync(store.filePath('writer-state.json'), store.filePath('writer-state.retained'));
    if (mode === 'malformed') fs.writeFileSync(store.filePath('writer-state.json'), '{broken');
    if (mode === 'foreign') { const other = fixture(); other.control.run(other.control.capture(), 'test.initialize', () => {}); fs.copyFileSync(other.store.filePath('writer-state.json'), store.filePath('writer-state.json')); }
    const damaged = mode === 'missing' ? null : fs.readFileSync(store.filePath('writer-state.json'));
    assert.throws(() => control.run(token, 'test.no-reset', () => assert.fail()));
    assert.throws(() => writerForStore(store));
    if (damaged) assert.deepEqual(fs.readFileSync(store.filePath('writer-state.json')), damaged);
    else assert.deepEqual(fs.readFileSync(store.filePath('writer-state.retained')), original);
  }
});

test('a killed admitted child remains unresolved after process exit and controller restart', { timeout: 15000 }, async () => {
  const { store, control } = fixture(), token = control.capture();
  const script = store.filePath('child.cjs');
  fs.writeFileSync(script, `const {createStore}=require(${JSON.stringify(require.resolve('../main/store'))});
    const {writerForStore}=require(${JSON.stringify(require.resolve('../main/writer-admission'))});
    const writer=writerForStore(createStore(process.argv[2],{create:false}),{token:JSON.parse(process.argv[3])});
    writer.run('test.child',async()=>{process.send({admitted:true});await new Promise(()=>{});});setInterval(()=>{},1000);`);
  const child = fork(script, [store.dir(), JSON.stringify(token)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
  try {
    const [message] = await once(child, 'message'); assert.equal(message.admitted, true);
    const barrier = control.quiesce(token);
    const exited = once(child, 'exit'); child.kill(); await exited;
    const restarted = controller(createStore(store.dir(), { create: false }));
    assert.equal(restarted.inspect().pending[0].pid, child.pid);
    assert.throws(() => restarted.assertQuiescent(barrier), { code: 'writer_pending' });
  } finally { if (child.exitCode === null) child.kill(); }
});

test('persisted transcript writers refuse after restart without rebinding an old attempt', () => {
  const { createProfileRegistry } = require('../main/profile-registry');
  const { createWorkspaceRepository } = require('../main/workspace-repository');
  const { captureChatContext } = require('../main/chat-context');
  const registry = createProfileRegistry(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-workspace-')));
  const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
  const repo = createWorkspaceRepository({ registry });
  const snapshot = title => ({ version: 1, chats: { same: { id: 'same', title, messages: [], tabs: [], draft: title + ' draft', folder: null } }, order: ['same'] });
  repo.saveView(a.id, snapshot('A')); repo.saveView(b.id, snapshot('B'));
  const store = createStore(registry.storeFor(a.id).storeDir, { create: false });
  const scope = captureScope({ profileId: a.id, storeDir: store.dir(), connection: { enabled: false } });
  const request = { profileId: a.id, chatId: 'same', attemptId: crypto.randomUUID(), prompt: 'Captured', provider: 'api', images: [] };
  repo.begin(request, { scope, chatContext: captureChatContext(repo.load(a.id).chats.same) });
  const before = fs.readFileSync(store.filePath('workspace.json'));
  const control = controller(store), barrier = control.quiesce(scope.writerToken);
  const restarted = createWorkspaceRepository({ registry });
  assert.throws(() => restarted.event(request, { profileId: a.id, chatId: 'same', runId: 'old', sequence: 1, type: 'text_delta', text: 'Forbidden' }), { code: 'writer_stale' });
  assert.throws(() => restarted.finish(request, { runId: 'old', driverFinished: true, status: 'completed' }), { code: 'writer_stale' });
  assert.throws(() => restarted.saveView(a.id, snapshot('Forbidden')), { code: 'writer_closed' });
  assert.deepEqual(fs.readFileSync(store.filePath('workspace.json')), before);
  restarted.saveView(b.id, snapshot('B still writable'));
  assert.equal(restarted.load(b.id).chats.same.draft, 'B still writable draft');
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
});

test('independent processes racing quiescence retain admitted receipts and reject successors', { timeout: 20000 }, async () => {
  const { store, control } = fixture(), token = control.capture();
  const script = store.filePath('race.cjs');
  fs.writeFileSync(script, `const {createStore}=require(${JSON.stringify(require.resolve('../main/store'))});
    const {writerForStore}=require(${JSON.stringify(require.resolve('../main/writer-admission'))});
    const store=createStore(process.argv[2],{create:false}), writer=writerForStore(store,{token:JSON.parse(process.argv[3])});
    let finish;
    process.on('message',async message=>{if(message==='finish'){finish();return;}
      try { await writer.run('test.race',async()=>{process.send({admitted:true});await new Promise(r=>finish=r);
        writer.run('test.receipt',()=>store.writeJson('receipt-'+process.pid+'.json',{acknowledged:true}));});process.send({finished:true});
      } catch(error){process.send({code:error.code,message:error.message});}});process.send({ready:true});`);
  const children = [0, 1].map(() => fork(script, [store.dir(), JSON.stringify(token)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true }));
  try {
    await Promise.all(children.map(child => once(child, 'message')));
    let response = once(children[0], 'message'); children[0].send('start'); assert.equal((await response)[0].admitted, true);
    response = once(children[1], 'message'); children[1].send('start');
    const barrier = control.quiesce(token), racing = (await response)[0];
    assert.ok(racing.admitted || racing.code === 'writer_stale', JSON.stringify(racing));
    assert.throws(() => control.assertQuiescent(barrier), { code: 'writer_pending' });
    const admitted = racing.admitted ? children : [children[0]];
    await Promise.all(admitted.map(async child => { const result = once(child, 'message'); child.send('finish'); assert.equal((await result)[0].finished, true); }));
    for (const child of admitted) assert.equal(store.readJson('receipt-' + child.pid + '.json').acknowledged, true);
    if (!racing.admitted) assert.equal(store.readJson('receipt-' + children[1].pid + '.json', null), null);
    assert.equal(control.assertQuiescent(barrier).quiescent, true);
  } finally {
    await Promise.all(children.map(async child => { if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } }));
  }
});

test('a write the server answered is settled; a write without an answer stays uncertain', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-answered-'))), store = createStore(root);
  const control = controller(store), token = control.capture();
  const refused = Object.assign(new Error('The library is held'), { status: 503, code: 'storage_unavailable' });
  await assert.rejects(control.run(token, 'barkpark:createNote', async () => { throw refused; }), /held/);
  await assert.rejects(control.run(token, 'barkpark:applyOps', async () => { throw new Error('Stale revision', { cause: Object.assign(new Error('ifRev did not match'), { status: 409 }) }); }), /Stale/);
  assert.deepEqual(control.inspect().pending, [], 'both were answered');
  await assert.rejects(control.run(token, 'barkpark:applyOps', async () => { throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }); }), /hang up/);
  assert.equal(control.inspect().pending.length, 1); assert.equal(control.inspect().pending[0].status, 'uncertain');
});
test('writes of a departed host are settled for runtime operations only, never for a live host', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-departed-'))), store = createStore(root);
  const control = controller(store), token = control.capture();
  await assert.rejects(control.run(token, 'barkpark:applyOps', async () => { throw new Error('timeout'); }));
  await assert.rejects(control.run(token, 'docs:update', async () => { throw new Error('disk'); }));
  // The same journal, read by a later host: the entries belong to another process.
  const file = path.join(root, 'writer-state.json'), state = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.pending = state.pending.map(p => ({ ...p, pid: 2147483600 })); fs.writeFileSync(file, JSON.stringify(state));
  const later = controller(createStore(root, { create: false }));
  assert.deepEqual(later.settleDeparted({ alive: () => true }), { settled: 0, remaining: 2 }, 'a host that still runs keeps its writes');
  assert.deepEqual(later.settleDeparted({ alive: () => false }), { settled: 1, remaining: 1 });
  assert.deepEqual(later.inspect().pending.map(p => p.operation), ['docs:update'], 'a local write stays for inspection');
});
