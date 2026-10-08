// SDK-fixture tests exercise adapter ownership/events, not installed CLI discovery.
// Keep real discovery/version/refusal coverage in provider-tools and provider-tool-refusal tests.
const assert = require('node:assert/strict');
const tools = require('../../main/provider-tools');
const original = tools.createProviderTools;
tools.createProviderTools = () => ({ async inspect(provider) {
  assert.ok(['claude', 'codex'].includes(provider));
  return { provider, ok: true, path: process.execPath, source: 'test-fixture' };
} });
module.exports = () => { tools.createProviderTools = original; };
