import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGoalProvider } = require('../main/goal-provider');
const { captureScope } = require('../main/providers/runs');
const { createStore } = require('../main/store');
const agent = require('../main/agent');
const flush = () => new Promise(r => setImmediate(r));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

function setup({ release } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goal-provider-'));
  const profileId = randomUUID(), goalId = randomUUID();
  const store = createStore(root);
  const record = [];
  const requests = [1,2,3].map(i => ({ profileId, goalId, coordinatorChatId: 'main', chatId: `worker${i}`, taskId: `task${i}`,
    attemptId: randomUUID(), deadline: Date.now() + 60000, prompt: `Return result ${i}`, context: { profileId, chatId: `worker${i}`, folder: null, provider: 'api', model: 'test-model', effort: null, session: null } }));
  const transcripts = {
    begin(request) { const fresh = !record.some(r => r.kind === 'begin' && r.attempt === request.attemptId); if (fresh) { record.push({ kind: 'begin', attempt: request.attemptId }); store.writeJson('transcript-test.json', record); } return { history: [{ role: 'user', content: request.prompt }], fresh }; },
    event(request, event) { record.push({ kind: 'event', attempt: request.attemptId, event }); store.writeJson('transcript-test.json', record); },
    finish(request, result) { record.push({ kind: 'finish', attempt: request.attemptId, result }); store.writeJson('transcript-test.json', record); },
  };
  const resolve = (_profile, chatId) => ({ scope: captureScope({ profileId, storeDir: root, context: { folder: null, chatId }, connection: { enabled: false } }),
    chat: { parent: 'main', goalId, provider: 'api', sessions: {}, model: 'test-model' }, settings: { apiKey: 'fake-test-key', forceOnline: true }, release });
  return { root, store, record, requests, transcripts, resolve, adapter: createGoalProvider({ resolve, transcripts }) };
}

test('real agent.start runs three owned API loops and persists their independent transcripts', async () => {
  const f = setup(); const gate = deferred(); let active = 0, max = 0, reached = 0;
  agent.setClientFactory(() => ({ messages: { stream(params) {
    active++; max = Math.max(max, active); if (++reached === 3) gate.resolve();
    const handlers = {};
    const match = /Return result (\d)/.exec(params.messages.at(-1).content);
    return { on(name, fn) { handlers[name] = fn; return this; }, async finalMessage() { await gate.promise; const text = `Observed result ${match[1]}`; handlers.text(text); active--; return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text }] }; } };
  } } }));
  const results = await Promise.all(f.requests.map(request => f.adapter.execute(request, { signal: new AbortController().signal, progress() {} })));
  assert.equal(max, 3); assert.deepEqual(results.map(r => r.text), ['Observed result 1', 'Observed result 2', 'Observed result 3']);
  assert.ok(results.every(r => r.status === 'succeeded'));
  const persisted = f.store.readJson('transcript-test.json');
  assert.equal(persisted.filter(r => r.kind === 'finish').length, 3);
  for (const row of persisted.filter(r => r.kind === 'event')) assert.equal(row.event.profileId, f.requests[0].profileId);
  // Real agent/tool-loop/registry, deterministic transport: not authenticated network evidence.
});

test('done event does not release worker before trusted driver cleanup completes', async () => {
  const gate = deferred(); const f = setup({ release: () => gate.promise });
  agent.setClientFactory(() => ({ messages: { stream() { const handlers = {}; return { on(n,fn) { handlers[n]=fn; return this; }, async finalMessage() { handlers.text('Done'); return { stop_reason: 'end_turn', usage: {}, content: [{type:'text',text:'Done'}] }; } }; } } }));
  let finished = false;
  const execution = f.adapter.execute(f.requests[0], { signal: new AbortController().signal, progress() {} }).then(result => { finished = true; return result; });
  await flush(); assert.ok(f.record.some(r => r.event?.type === 'done')); assert.equal(finished, false);
  await assert.rejects(f.adapter.execute(f.requests[0], { signal: new AbortController().signal, progress() {} }), /already executing/);
  gate.resolve(); assert.equal((await execution).status, 'succeeded');
});

test('changed context or mismatched profile fails before a transcript or provider starts', async () => {
  const f = setup();
  await assert.rejects(f.adapter.execute({ ...f.requests[0], context: { ...f.requests[0].context, folder: '/different' } }, { signal: new AbortController().signal, progress() {} }), /folder changed/);
  const wrong = createGoalProvider({ resolve: f.resolve, transcripts: f.transcripts });
  await assert.rejects(wrong.execute({ ...f.requests[0], profileId: randomUUID() }, { signal: new AbortController().signal, progress() {} }), /profile does not own/);
  assert.equal(f.record.length, 0);
});

test('cancel during real API stream waits for finalization and records partial output', async () => {
  const f = setup(); const controller = new AbortController(); const entered = deferred();
  agent.setClientFactory(() => ({ messages: { stream(_params, { signal }) { const handlers = {}; return {
    on(name,fn) { handlers[name]=fn; return this; },
    async finalMessage() { handlers.text('Partial output'); entered.resolve(); await new Promise((resolve,reject) => { if (signal.aborted) reject(new Error('aborted')); else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); }); },
  }; } } }));
  const execution = f.adapter.execute(f.requests[0], { signal: controller.signal, progress() {} });
  await entered.promise; controller.abort(); const result = await execution;
  assert.equal(result.status, 'cancelled'); assert.ok(result.text.includes('Partial output'));
  assert.equal(f.record.at(-1).result.driverFinished, true);
});

test('transcript failure stops the provider and reports uncertain effects instead of success', async () => {
  const f = setup(); const original = f.transcripts.event;
  f.transcripts.event = (r,e) => { if (e.type === 'text_delta') throw new Error('journal full'); original(r,e); };
  agent.setClientFactory(() => ({ messages: { stream() { const handlers={}; return { on(n,fn) { handlers[n]=fn;return this; }, async finalMessage() { handlers.text('External effect may have happened'); return { stop_reason:'end_turn',usage:{},content:[{type:'text',text:'reply'}] }; } }; } } }));
  const result = await f.adapter.execute(f.requests[0], { signal: new AbortController().signal, progress() {} });
  assert.equal(result.status, 'interrupted'); assert.match(result.text, /journal full/);
});

test('an acknowledged duplicate reservation never launches a second provider', async () => {
  const f = setup(); let launches = 0;
  const runtime = { async start() { launches++; throw new Error('must not launch'); }, cancel() {} };
  f.transcripts.begin(f.requests[0]);
  const adapter = createGoalProvider({ agent: runtime, resolve: f.resolve, transcripts: f.transcripts });
  const result = await adapter.execute(f.requests[0], { signal: new AbortController().signal, progress() {} });
  assert.equal(result.status, 'interrupted'); assert.equal(launches, 0); assert.match(result.text, /already reserved/);
});

test('Promise-returning transcript sink is rejected before provider dispatch', async () => {
  const f = setup(); f.transcripts.begin = async () => ({ history: [], fresh: true });
  const runtime = { start() { throw new Error('must not launch'); }, cancel() {} };
  const adapter = createGoalProvider({ agent: runtime, resolve: f.resolve, transcripts: f.transcripts });
  await assert.rejects(adapter.execute(f.requests[0], { signal: new AbortController().signal, progress() {} }), /synchronously/);
});

test('unknown finalization retains the execution slot until trusted termination proof', async () => {
  const f = setup(); const request = f.requests[0]; const progress = []; let completed = false;
  const runtime = {
    async start(params) { params.send({ type: 'done', profileId: request.profileId, chatId: request.chatId, provider: 'api', runId: 'known-run' }); return { runId: 'known-run' }; },
    async waitForRunFinish() { throw new Error('Unknown or expired run completion'); }, cancel() {},
  };
  const adapter = createGoalProvider({ agent: runtime, resolve: f.resolve, transcripts: f.transcripts, verifyTermination: async ({ proof }) => proof === 'verified-owner-stopped' });
  const executing = adapter.execute(request, { signal: new AbortController().signal, progress: event => progress.push(event) }).then(result => { completed = true; return result; });
  await flush(); assert.equal(completed, false); assert.equal(adapter.pendingTermination().length, 1);
  assert.equal(progress.at(-1).terminationUnknown, true);
  await assert.rejects(adapter.execute(request, { signal: new AbortController().signal, progress() {} }), /already executing/);
  await assert.rejects(adapter.reconcileTermination(request.profileId, request.attemptId, 'timeout'), /not been established/);
  await assert.rejects(adapter.reconcileTermination(randomUUID(), request.attemptId, 'verified-owner-stopped'), /No uncertain/);
  await adapter.reconcileTermination(request.profileId, request.attemptId, 'verified-owner-stopped');
  assert.equal((await executing).status, 'interrupted'); assert.equal(adapter.pendingTermination().length, 0);
});

test('captured assignment images reach actual API transport; another profile path is rejected', async () => {
  const f = setup(); fs.mkdirSync(path.join(f.root, 'attachments'));
  const imagePath = path.join(f.root, 'attachments', 'image.png'); fs.writeFileSync(imagePath, Buffer.from('fixture-image'));
  const image = { id: 'image', path: imagePath, mime: 'image/png', name: 'image.png' }; let blocks;
  agent.setClientFactory(() => ({ messages: { stream(params) { blocks = params.messages.at(-1).content; return { on() { return this; }, async finalMessage() { return { stop_reason:'end_turn',usage:{},content:[{type:'text',text:'Image observed'}] }; } }; } } }));
  const result = await f.adapter.execute({ ...f.requests[0], images: [image] }, { signal: new AbortController().signal, progress() {} });
  assert.equal(result.status, 'succeeded'); assert.equal(blocks[0].type, 'image');
  assert.equal(blocks[0].source.data, Buffer.from('fixture-image').toString('base64'));
  const outsider = setup();
  await assert.rejects(outsider.adapter.execute({ ...outsider.requests[0], images: [image] }, { signal: new AbortController().signal, progress() {} }), /outside its profile/);
});

test('worker provider launches disable native recursive delegation without changing ordinary chats', async () => {
  const f=setup();const claude=require('../main/providers/claude'),codex=require('../main/providers/codex');let claudeOptions,codexOptions;
  claude.setSdkLoader(async()=>({query({options}){claudeOptions=options;const iterator=(async function*(){yield {type:'result',subtype:'success',result:'bounded',usage:{}};})();iterator.interrupt=async()=>{};return iterator;}}));
  codex.setSdkLoader(async()=>({Codex:class{constructor(options){codexOptions=options;}startThread(){return{id:'fixture-session',async runStreamed(){return{events:(async function*(){yield{type:'item.completed',item:{id:'text',type:'agent_message',text:'bounded'}};})()};}};}}}));
  try{
    for(const provider of ['claude','codex']){
      const request={...f.requests[provider==='claude'?0:1],context:{...f.requests[0].context,provider,session:null}};request.context.chatId=request.chatId;
      const resolve=(_profile,chatId)=>{const value=f.resolve(_profile,chatId);value.chat.provider=provider;return value;};
      const adapter=createGoalProvider({resolve,transcripts:f.transcripts});
      assert.equal((await adapter.execute(request,{signal:new AbortController().signal,progress(){}})).status,'succeeded');
    }
    assert.deepEqual(claudeOptions.disallowedTools,['Task','Agent']);assert.equal((await claudeOptions.canUseTool('Task',{},{})).behavior,'deny');
    assert.equal(codexOptions.config.agents.enabled,false);assert.equal(codexOptions.config.features.goals,false);
    const started=await agent.start({profileId:f.requests[0].profileId,storeDir:f.root,chatId:'ordinary',context:{folder:null},connection:{enabled:false},provider:'codex',settings:{},prompt:'ordinary',send(){}});
    await agent.waitForRunFinish(started.runId);assert.equal(codexOptions.config.agents,undefined);
  }finally{claude.setSdkLoader(null);codex.setSdkLoader(null);}
});
