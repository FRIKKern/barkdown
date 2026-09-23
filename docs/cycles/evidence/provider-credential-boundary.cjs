// Audit only: actual API adapter with synthetic credentials and a controlled client.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../..');
const agent = require(path.join(repo, 'app/main/agent.js'));
const store = require(path.join(repo, 'app/main/store.js'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-provider-key-boundary-'));
process.env.ANTHROPIC_API_KEY = 'synthetic-device-default';
delete process.env.ANTHROPIC_AUTH_TOKEN;
const used = [];
agent.setClientFactory(options => {
  used.push(options.apiKey);
  return { messages: { stream() { return {
    on() { return this; },
    async finalMessage() { return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'synthetic completion' }], usage: {} }; },
  }; } } };
});
(async () => {
  for (const [label, key] of [['A', 'synthetic-A-owned'], ['B', '']]) {
    const dir = path.join(root, label);
    store.createStore(dir);
    await new Promise((resolve, reject) => {
      agent.start({ profileId: crypto.randomUUID(), storeDir: dir, chatId: 'same', context: { folder: null },
        connection: { enabled: false }, provider: 'api', messages: [{ role: 'user', content: 'synthetic audit' }],
        settings: { apiKey: key }, send: event => {
          if (event.type === 'error') reject(new Error(event.message));
          if (event.type === 'done') resolve();
        } }).catch(reject);
    });
  }
  console.log(JSON.stringify({ root, network: 'No requests: controlled client factory around actual API adapter.',
    profileAUsedOwnedKey: used[0] === 'synthetic-A-owned', emptyProfileBUsedDeviceEnvironment: used[1] === 'synthetic-device-default',
    profileBUsedAOwnedKey: used[1] === 'synthetic-A-owned',
    scope: 'Environment credentials are shared device defaults, not profile-owned. This does not prove real provider login isolation.' }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
