// Controlled SDK transports inside the production goal-worker protocol and native Job.
const assert = require('node:assert/strict');
require('../helpers/provider-tool-fixture.cjs');
const agent = require('../../main/agent');
const completion = 'Captured worker credentials verified';
agent.setClientFactory(options => {
  assert.equal(options.apiKey, process.env.BARKDOWN_FIXTURE_EXPECTED_API);
  assert.equal(options.authToken, null);
  return { messages: { stream() { const handlers = {}; return {
    on(name, fn) { handlers[name] = fn; return this; },
    async finalMessage() { handlers.text?.(completion); return { stop_reason: 'end_turn', content: [{ type: 'text', text: completion }], usage: {} }; },
  }; } } };
});
require('../../main/providers/claude').setSdkLoader(async () => ({ query({ options }) {
  assert.equal(options.env.ANTHROPIC_API_KEY, 'synthetic-shared-device');
  assert.equal(options.env.CLAUDE_CODE_OAUTH_TOKEN, 'synthetic-captured-oauth');
  return (async function* () { yield { type: 'result', subtype: 'success', result: completion }; })();
} }));
require('../../main/providers/codex').setSdkLoader(async () => ({ Codex: class {
  constructor(options) { assert.equal(options.env.CODEX_API_KEY, 'synthetic-captured-codex'); }
  startThread() { return { id: 'fixture-session', async runStreamed() { return { events: (async function* () {
    yield { type: 'item.completed', item: { id: 'text', type: 'agent_message', text: completion } };
    yield { type: 'turn.completed', usage: {} };
  })() }; } }; }
} }));
require('../../main/goal-worker');
