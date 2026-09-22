import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const runs = require('../main/providers/runs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-folder-preflight-'));
const valid = path.join(root, 'valid'), missing = path.join(root, 'missing'), file = path.join(root, 'file');
fs.mkdirSync(valid); fs.writeFileSync(file, 'not a directory');
function setup(provider, folder) {
  const registry = createProfileRegistry(path.join(root, 'registry-' + crypto.randomUUID()));
  const profile = registry.createProfile({ name: 'Owned profile' }); let calls = 0, dispatched;
  const service = createProfileService({ registry, agent: { ...runs, async start(options) {
    calls++; dispatched = options; const run = runs.createRun(options); run.emit({ type: 'done' }); await runs.finish(run); return { runId: run.id };
  } } });
  const owner = service.view(); service.save(owner, { version: 1, chats: { chat: { id: 'chat', title: 'Owned', provider, folder, messages: [], draft: 'Original human prompt', tabs: [] } }, order: ['chat'], current: 'chat' });
  return { service, owner, calls: () => calls, dispatched: () => dispatched };
}
for (const provider of ['claude', 'codex']) for (const folder of [missing, file]) test(`${provider} refuses ${path.basename(folder)} before reservation`, async () => {
  const x = setup(provider, folder);
  await assert.rejects(x.service.start(x.owner, { chatId: 'chat', prompt: 'Original human prompt', context: { folder: valid }, model: 'renderer-override' }), error => {
    assert.equal(error.code, 'BARKDOWN_SEND_NOT_STARTED'); assert(error.message.includes(folder)); assert.match(error.message, /working folder.*unavailable/i); return true;
  });
  assert.equal(x.calls(), 0); const ws = x.service.load(x.owner);
  assert.equal(Object.keys(ws.ownership.attempts).length, 0); assert.equal(ws.chats.chat.messages.length, 0);
  assert.equal(ws.chats.chat.draft, 'Original human prompt'); assert.equal(ws.chats.chat.folder, folder);
});
for (const [provider, folder] of [['api', missing], ['claude', null], ['codex', valid]]) test(`${provider} ${folder || 'no folder'} remains dispatchable`, async () => {
  const x = setup(provider, folder); const started = await x.service.start(x.owner, { chatId: 'chat', prompt: 'Original human prompt' }); await x.service.wait(x.owner, started.runId);
  assert.equal(x.calls(), 1); assert.equal(x.dispatched().scope.context.folder, folder);
});
for (const code of ['EACCES', 'EPERM']) test(`controlled ${code} refuses without changing chosen path`, async () => {
  const x = setup('codex', missing), stat = fs.statSync;
  fs.statSync = function (file, ...args) { if (file === missing) throw Object.assign(Error('controlled denial'), { code }); return stat.call(this, file, ...args); };
  try { await assert.rejects(x.service.start(x.owner, { chatId: 'chat', prompt: 'Original human prompt' }), e => e.code === 'BARKDOWN_SEND_NOT_STARTED' && e.diagnostic.includes('controlled denial')); }
  finally { fs.statSync = stat; }
  assert.equal(x.calls(), 0);
});
test('managed provider override cannot bypass refusal; retry uses owned model and one prompt', async () => {
  const x = setup('claude', missing);
  await assert.rejects(x.service.start(x.owner, { chatId: 'chat', provider: 'api', prompt: 'Original human prompt' }), /provider changed/);
  assert.equal(x.calls(), 0);
  const ws = x.service.load(x.owner); ws.chats.chat.folder = valid; ws.chats.chat.model = 'owned-model'; x.service.save(x.owner, ws);
  const started = await x.service.start(x.owner, { chatId: 'chat', prompt: 'Original human prompt', model: 'untrusted-model' }); await x.service.wait(x.owner, started.runId);
  assert.equal(x.dispatched().settings.claudeModel, 'owned-model');
  assert.equal(x.dispatched().messages.filter(m => m.role === 'user' && m.content === 'Original human prompt').length, 1);
});
test('legacy actual handler and preload expose known refusal, unknown errors stay unknown', async () => {
  const { assertProviderFolder } = require('../main/provider-folder');
  const main = fs.readFileSync(new URL('../main/main.js', import.meta.url), 'utf8');
  let handler, calls = 0;
  vm.runInNewContext(main.slice(main.indexOf("  handle('agent:start',"), main.indexOf("  handle('agent:cancel',")), {
    handle: (_name, fn) => handler = fn, profileService: null, readSettings: () => ({ provider: 'codex', barkpark: {} }), defaultProvider: () => 'api',
    assertProviderFolder, decrypt: () => '', store: { dir: () => root }, barkparkConfig: () => ({ enabled: false }), agent: { start: () => { calls++; return { runId: 'legacy-accepted' }; } },
  });
  let exposed;
  vm.runInNewContext(fs.readFileSync(new URL('../main/preload.js', import.meta.url), 'utf8'), {
    process: { platform: 'win32' }, require: name => { assert.equal(name, 'electron'); return {
      contextBridge: { exposeInMainWorld: (_name, api) => exposed = api }, ipcRenderer: { invoke: async (channel, payload) => {
        if (channel === 'profiles:status') return { ok: true, value: { enabled: false } };
        try { return { ok: true, value: handler(payload) }; } catch (e) { return { ok: false, error: e.message, code: e.code, diagnostic: e.diagnostic }; }
      } },
    }; },
  });
  const refused = structuredClone(await exposed.agent.start('legacy', [], { folder: missing }, undefined, null, 'Original human prompt', []));
  assert.equal(refused.accepted, false); assert.equal(refused.notStarted, true); assert(refused.error.message.includes(missing)); assert.equal(calls, 0);
  assert.equal((await exposed.agent.start('legacy', [], { folder: missing }, 'api', null, 'Original human prompt', [])).runId, 'legacy-accepted'); assert.equal(calls, 1);
  const stat = fs.statSync;
  fs.statSync = (target, ...args) => { if (target === valid) throw Object.assign(Error('I/O failure'), { code: 'EIO' }); return stat(target, ...args); };
  try { await assert.rejects(exposed.agent.start('legacy', [], { folder: valid }, 'claude', null, 'prompt', []), /I\/O failure/); }
  finally { fs.statSync = stat; }
});
