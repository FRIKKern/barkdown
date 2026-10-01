// C088 S4: a chat on Claude Code or Codex starts with the user's own tool, found and checked first;
// without one the run fails with the plain reason before any SDK is loaded.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { captureScope } = require('../main/providers/run-scope');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-tool-refusal-'));
const storeDir = path.join(root, 'store'); fs.mkdirSync(storeDir); const folder = path.join(root, 'folder'); fs.mkdirSync(folder);
const impostor = path.join(root, 'impostor'); fs.writeFileSync(impostor, '#!/bin/sh\necho "hello from a script"\n'); fs.chmodSync(impostor, 0o755);
for (const [provider, binary, expected] of [['claude', impostor, /Not Claude Code: --version answered “hello from a script”/], ['codex', path.join(root, 'missing-codex'), /No file at this path\./]]) {
  const scope = captureScope({ profileId: crypto.randomUUID(), storeDir, context: { folder }, connection: { enabled: false, viaCli: false, writes: false } });
  const bare = Object.freeze({ ...scope, env: Object.freeze({ ...scope.env, PATH: '/usr/bin:/bin', HOME: root }) });
  const events = [];
  const finished = new Promise(resolve => {
    require(`../main/providers/${provider}`).start({ chatId: 'c1', prompt: 'hello', context: { folder }, settings: { providerBinary: { claude: binary, codex: binary } }, send: e => { events.push(e); if (e.type === 'error' || e.type === 'done') resolve(); }, storeDir, scope: bare, profileId: scope.profileId, onFinish: () => {} });
  });
  await Promise.race([finished, new Promise((_, reject) => setTimeout(() => reject(new Error(provider + ': no answer within 15 s')), 15000))]);
  const error = events.find(e => e.type === 'error');
  assert.ok(error, provider + ' failed with a reason: ' + JSON.stringify(events.map(e => e.type)));
  assert.match(error.message, expected);
  assert.ok(!events.some(e => e.type === 'status' || e.type === 'text'), provider + ' never reached the SDK');
}
fs.rmSync(root, { recursive: true, force: true });
console.log('Provider tool refusal: an impostor and a missing path each fail the run with the plain reason before the SDK is loaded.');
