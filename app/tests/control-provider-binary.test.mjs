import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mountControl } from '../renderer/src/control.js';
const require = createRequire(import.meta.url);
const { FORBIDDEN, SETTINGS_NEVER } = require('../shared/control-commands');

test('approval settings stay outside the command surface', () => {
  for (const key of ['approvals', 'Approvals', 'approvals.mode', 'control', 'CONTROL.fullYolo']) assert.ok(SETTINGS_NEVER.some(rule => rule.test(key)), key);
  assert.equal(FORBIDDEN['fullyolo.set'], 'The approval mode can only be changed in the Barkdown window.');
});

test('settings.set accepts the Codex executable through the normal settings path', async () => {
  const codex = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
  const patches = [];
  const replies = [];
  let invoke;
  const oldWindow = globalThis.window;
  globalThis.window = { dispatchEvent() {} };
  try {
    const state = { settings: { providerBinary: { claude: '', codex: '' } } };
    mountControl({
      api: {
        control: { onInvoke(handler) { invoke = handler; }, result(reply) { replies.push(reply); return Promise.resolve(); } },
        settings: { async set(patch) { patches.push(patch); return { ...state.settings, providerBinary: { ...state.settings.providerBinary, ...patch.providerBinary } }; } },
      },
      state,
      controllers: new Map(),
      DIRECT: 'direct',
      applySettings() {},
    });

    await invoke({ id: 'codex', command: 'settings.set', args: { key: 'providerBinary.codex', value: codex } });
    assert.deepEqual(patches, [{ providerBinary: { codex } }]);
    assert.deepEqual(replies.at(-1), { id: 'codex', ok: true, result: { key: 'providerBinary.codex', value: codex, text: `providerBinary.codex is now ${JSON.stringify(codex)}.` } });

    await invoke({ id: 'claude', command: 'settings.set', args: { key: 'providerBinary.claude', value: '/Applications/Claude.app/claude' } });
    assert.equal(replies.at(-1).ok, false);
    assert.equal(replies.at(-1).code, 'usage');
    assert.match(replies.at(-1).error, /not a setting this command changes/);

    await invoke({ id: 'type', command: 'settings.set', args: { key: 'providerBinary.codex', value: 167 } });
    assert.equal(replies.at(-1).ok, false);
    assert.equal(replies.at(-1).code, 'usage');
    assert.match(replies.at(-1).error, /not a value/);

    await invoke({ id: 'approvals', command: 'settings.set', args: { key: 'approvals', value: 'ask' } });
    assert.equal(replies.at(-1).ok, false);
    assert.equal(replies.at(-1).code, 'usage');
    assert.match(replies.at(-1).error, /not a setting this command changes/);
  } finally {
    globalThis.window = oldWindow;
  }
});
