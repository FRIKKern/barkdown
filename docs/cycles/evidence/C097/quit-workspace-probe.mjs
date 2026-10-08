// Diagnostic: real state/debounce/quit modules, controlled IPC transport.
// This does not demonstrate native disk loss or an Electron shutdown race.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from '../../../../app/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('<body><div id="bw-toasts"></div><main></main></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
let transport;
window.barkdown = { state: { save: snapshot => transport(structuredClone(snapshot)) } };
const { state, save } = await import('../../../../app/renderer/src/state.js');
const { installQuitSettlement } = await import('../../../../app/renderer/src/quit-settlement.js');
Object.assign(state, { loaded: true, profileId: 'diagnostic-profile', generation: 'diagnostic-generation',
  chats: { chat: { id: 'chat', draft: 'unsent diagnostic words', messages: [], tabs: [] } }, order: ['chat'], current: 'chat' });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

for (const mode of ['delayed', 'refused']) {
  await test(`workspace ${mode} save must not produce an affirmative quit reply`, async () => {
    let finish, onSettle, release, durable = null;
    const answers = [], snapshots = [];
    transport = snapshot => {
      snapshots.push(snapshot);
      return new Promise((resolve, reject) => { finish = () => mode === 'refused'
        ? reject(new Error('Disposable workspace write refused'))
        : (durable = snapshot, resolve(true)); });
    };
    const root = document.querySelector('main');
    installQuitSettlement({ api: { app: { onSettle: fn => onSettle = fn,
      onSettleRelease: fn => release = fn, settled: async (id, result) => answers.push({ id, result }) } },
      root, state, controllers: new Map(), savePositions() {}, save });
    save();
    try {
      await onSettle(mode);
      if (mode === 'refused') { finish(); await tick(); }
      const affirmative = answers.some(({ result }) => Array.isArray(result) && result.every(n => n.saved === true || n.saved === false && n.kept === true));
      console.log(JSON.stringify({ mode, sentDraft: snapshots[0]?.chats.chat.draft, durable,
        answers, affirmative, visibleWarning: document.getElementById('bw-toasts').textContent }));
      assert.equal(affirmative, false, 'quit acknowledgement must wait for and propagate workspace persistence');
    } finally {
      if (mode === 'delayed') finish();
      release(mode);
      await tick();
    }
  });
}
if (process.argv.includes('--store')) {
  await test('actual refused workspace store must not produce an affirmative quit reply', async () => {
    const require = createRequire(import.meta.url);
    const { createProfileRegistry } = require('../../../../app/main/profile-registry');
    const { createWorkspaceRepository } = require('../../../../app/main/workspace-repository');
    const { serialise } = await import('../../../../app/renderer/src/state.js');
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-quit-workspace-review-'));
    const registry = createProfileRegistry(path.join(base, 'registry'));
    const profile = registry.createProfile({ name: 'Disposable review' });
    const repo = createWorkspaceRepository({ registry });
    state.profileId = profile.id;
    state.chats.chat.draft = 'durable earlier draft';
    repo.saveView(profile.id, serialise());
    const original = path.resolve(registry.storeFor(profile.id).storeDir, 'workspace.json');
    assert(original.startsWith(path.resolve(base) + path.sep));
    const backup = original + '.review-backup', obstruction = original + '.review-obstruction';
    fs.renameSync(original, backup); fs.mkdirSync(original);
    state.chats.chat.draft = 'latest unsent words';
    let settle, release, error;
    const answers = [];
    transport = async snapshot => { try { return repo.saveView(profile.id, snapshot); } catch (e) { error = e.message; throw e; } };
    const root = document.createElement('main'); document.body.append(root);
    installQuitSettlement({ api: { app: { onSettle: fn => settle = fn, onSettleRelease: fn => release = fn,
      settled: async (_, result) => answers.push(result) } }, root, state, controllers: new Map(), savePositions() {}, save });
    let stored;
    try { save(); await settle('store'); await tick(); }
    finally { release('store'); fs.renameSync(original, obstruction); fs.renameSync(backup, original); stored = repo.load(profile.id).chats.chat.draft; }
    assert.match(error, /Cannot read profile workspace/);
    assert.equal(stored, 'durable earlier draft');
    console.log(JSON.stringify({ mode: 'actual-store-refusal', retainedFixture: base, error, answers, stored, rendererDraft: state.chats.chat.draft }));
    assert.equal(answers.some(result => result.every(n => n.saved === true || n.saved === false && n.kept === true)), false,
      'refused real store must prevent an affirmative quit acknowledgement');
  });
}
dom.window.close();
