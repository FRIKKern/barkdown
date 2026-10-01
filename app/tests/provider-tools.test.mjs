import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProviderTools } = require('../main/provider-tools');
const { resolveProviderCli } = require('../main/provider-cli');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-provider-tools-'));
const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
const write = (name, body) => { const file = path.join(bin, name); fs.writeFileSync(file, '#!/bin/sh\n' + body); fs.chmodSync(file, 0o755); return file; };
const claude = write('claude', 'echo "2.1.37 (Claude Code)"\n');
const codex = write('codex', 'echo "codex-cli 0.155.0"\n');
const impostor = write('not-a-tool', 'echo "hello from a script"\n');
const broken = write('broken', 'echo "boom" >&2; exit 3\n');
const slow = write('slow', 'sleep 5\n');
const env = { PATH: `${bin}:/usr/bin:/bin`, HOME: root };
{
  // Found on the PATH, answers like the tool: ok, with its version; a second call is served from the cache.
  let settings = {}; let spawns = 0;
  const tools = createProviderTools({ settings: () => settings, env: async () => env, home: root, timeoutMs: 2000, spawnImpl: (...a) => { spawns++; return require('node:child_process').spawn(...a); } });
  const c = await tools.inspect('claude');
  assert.deepEqual([c.ok, c.path, c.source, c.version], [true, claude, 'path', '2.1.37']);
  const x = await tools.inspect('codex'); assert.deepEqual([x.ok, x.version], [true, '0.155.0']);
  await tools.inspect('claude'); assert.equal(spawns, 2, 'cached by file and modification time');
  await tools.inspect('claude', { fresh: true }); assert.equal(spawns, 3);
  // A path from Settings wins over the PATH, and a file that is not the tool is refused with what it said.
  settings = { providerBinary: { claude: impostor } };
  const bad = await tools.inspect('claude');
  assert.deepEqual([bad.ok, bad.source, bad.path], [false, 'settings', impostor]); assert.match(bad.problem, /Not Claude Code: --version answered “hello from a script”/);
  settings = { providerBinary: { claude: broken } }; assert.match((await tools.inspect('claude')).problem, /exited 3: boom/);
  settings = { providerBinary: { claude: slow } }; const t = createProviderTools({ settings: () => settings, env: async () => env, home: root, timeoutMs: 300 }); assert.match((await t.inspect('claude')).problem, /did not finish/);
  settings = { providerBinary: { claude: path.join(root, 'missing') } }; assert.match((await tools.inspect('claude')).problem, /No file at this path/);
  settings = { providerBinary: { claude: 'claude' } }; assert.match((await tools.inspect('claude')).problem, /must be absolute/);
  settings = { providerBinary: { claude: codex } }; const good = await tools.inspect('claude'); assert.deepEqual([good.ok, good.source], [false, 'settings']); assert.match(good.problem, /Not Claude Code/);
  // Nothing on the PATH: a plain problem naming the tool.
  const none = createProviderTools({ settings: () => ({}), env: async () => ({ PATH: '/usr/bin:/bin', HOME: root }), home: root, timeoutMs: 2000 });
  assert.match((await none.inspect('claude')).problem, /Claude Code was not found on the PATH/);
}
{
  // The override reaches the sign-in worker's resolver: an existing absolute file is the answer, anything else is none.
  assert.equal(resolveProviderCli('claude', { env, override: impostor }), impostor);
  assert.equal(resolveProviderCli('claude', { env, override: path.join(root, 'missing') }), null);
  assert.equal(resolveProviderCli('claude', { env, override: 'claude' }), null);
  assert.equal(resolveProviderCli('claude', { env, home: root }), claude);
}
fs.rmSync(root, { recursive: true, force: true });
console.log('Provider tools: PATH and Settings resolution, --version sanity run with impostor, broken, slow and missing files, caching, and the resolver override passed.');
