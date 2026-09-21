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
    begin(request) { record.push({ kind: 'begin', attempt: request.attemptId }); store.writeJson('transcript-test.json', record); return [{ role: 'user', content: request.prompt }]; },
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
