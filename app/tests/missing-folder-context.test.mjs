// SDK seams prove dispatch routing, not native CLI execution or model behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./helpers/provider-tool-fixture.cjs');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const agent = require('../main/agent');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-missing-folder-'));
const registryRoot = path.join(root, 'registry');
const registry = createProfileRegistry(registryRoot);
const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
const folderA = path.join(root, 'existing-A'), missingB = path.join(root, 'missing-B');
fs.mkdirSync(folderA); fs.writeFileSync(path.join(folderA, 'owner.txt'), 'A private file');
const fileB = path.join(root, 'not-a-folder-B'); fs.writeFileSync(fileB, 'B is a file');
let service = createProfileService({ registry, agent });
registry.selectProfile(a.id);
const snapshot = folder => ({ version: 1, chats: { same: { id: 'same', title: 'Selected folder', folder, messages: [], draft: 'human draft', tabs: [] } }, order: ['same'], current: 'same' });
service.save(service.view(), snapshot(folderA));
await service.select(service.view(), b.id); service.save(service.view(), snapshot(missingB));
// Reload actual persisted registry/workspace through fresh service handles.
service = createProfileService({ registry: createProfileRegistry(registryRoot), agent });

for (const provider of ['api', 'claude', 'codex']) for (const folder of [missingB, fileB, null]) {
  test(`${provider} persists and dispatches ${folder === null ? 'no folder' : path.basename(folder)} without A fallback`, async () => {
    const ws = service.load(service.view()); ws.chats.same.folder = folder; ws.chats.same.provider = provider;
    service.save(service.view(), ws);
    const resolved = await service.resolve(b.id, 'same');
    assert.equal(resolved.scope.context.folder, folder);
    assert.equal(service.load(service.view()).chats.same.draft, 'human draft');
    const events = []; let observed, cwd, resumed;
    const transport = provider === 'api' ? null : require('../main/providers/' + provider);
    if (provider === 'api') agent.setClientFactory(() => ({ messages: { stream(options) {
      observed = JSON.stringify(options); return { on() { return this; }, async finalMessage() { return { content: [{ type: 'text', text: 'controlled routing response' }], stop_reason: 'end_turn', usage: {} }; } };
    } } }));
    if (provider === 'claude') transport.setSdkLoader(async () => ({ query({ prompt, options }) {
      observed = options.systemPrompt.append; cwd = options.cwd; resumed = options.resume; // the note rides the system prompt (C089 F5)
      return { async *[Symbol.asyncIterator]() { yield { type: 'result', subtype: 'success', result: 'controlled routing response' }; } };
    } }));
    if (provider === 'codex') transport.setSdkLoader(async () => ({ Codex: class {
      resumeThread(session, options) { resumed = session; cwd = options.workingDirectory; return { async runStreamed(prompt) { observed = prompt; return { events: (async function* () { yield { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'controlled routing response' } }; })() }; } }; }
    } }));
    try {
      const { runId } = await agent.start({ chatId: 'same', provider, scope: resolved.scope, session: 'existing-session-B', prompt: 'Where am I?',
        messages: [{ role: 'user', content: 'Where am I?' }], settings: { apiKey: 'fixture', forceOnline: true }, send: e => events.push(e) });
      await agent.waitForRunFinish(runId);
      assert(!events.some(e => e.type === 'error'), JSON.stringify(events));
      // The note rides the system channel for the API and Claude Code (C089 F5) and the prompt for Codex;
      // API JSON encoding doubles slashes, so decode before checking.
      const prompt = provider === 'api' ? JSON.parse(observed).system[0].text : observed;
      assert.equal(typeof prompt, 'string');
      if (folder) assert(prompt.includes(JSON.stringify(folder)), prompt);
      else assert.match(prompt, /no working folder selected/);
      assert(!prompt.includes(folderA), 'previous profile folder must not enter current context');
      if (provider !== 'api') {
        assert.equal(resumed, 'existing-session-B');
        if (folder) assert.equal(cwd, folder, 'missing folder must not silently become scratch or A');
        else { assert.notEqual(cwd, folderA); assert(cwd.startsWith(resolved.scope.storeDir)); }
      }
      assert.equal(fs.existsSync(missingB), false);
      assert.equal(fs.readFileSync(path.join(folderA, 'owner.txt'), 'utf8'), 'A private file');
    } finally { transport?.setSdkLoader(null); agent.setClientFactory(null); await resolved.release(); }
  });
}

test('changing the persisted folder clears stale native sessions', () => {
  const store = registry.storeFor(b.id), ws = store.readJson('workspace.json');
  ws.chats.same.folder = folderA; ws.chats.same.sessions = { claude: 'old-A', codex: 'old-A' }; ws.chats.same.sessionSeen = { claude: 10, codex: 10 };
  store.writeJson('workspace.json', ws);
  const changed = service.load(service.view()); changed.chats.same.folder = missingB;
  service.save(service.view(), changed);
  const actual = service.load(service.view()).chats.same;
  assert.equal(actual.folder, missingB); assert.deepEqual(actual.sessions, {}); assert.deepEqual(actual.sessionSeen, {});
});
