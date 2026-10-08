import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProviderTools: createTools } = require('../main/provider-tools');
const { resolveProviderCli } = require('../main/provider-cli');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-provider-tools-'));
const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
// Real child processes answer the tool protocol on every host, using native resolver names.
const write = (name, body) => { const file = path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')); fs.writeFileSync(file, body); return file; };
const claude = write('claude', 'console.log("2.1.37 (Claude Code)")');
const codex = write('codex', 'console.log("codex-cli 0.155.0")');
const impostor = write('not-a-tool', 'console.log("hello from a script")');
const broken = write('broken', 'console.error("boom"); process.exit(3)');
const slow = write('slow', 'setTimeout(() => {}, 5000)');
const fixtureSpawn = (file, args, options) => {
  assert.deepEqual(args, ['--version']);
  return require('node:child_process').spawn(process.execPath, ['-e', fs.readFileSync(file, 'utf8')], options);
};
const createProviderTools = options => createTools({ spawnImpl: fixtureSpawn, ...options });
const env = { PATH: bin, HOME: root };

{
  // Found on the PATH, answers like the tool: ok, with its version; a second call is served from the cache.
  let settings = {}; let spawns = 0;
  const tools = createProviderTools({ settings: () => settings, env: async () => env, home: root, timeoutMs: 2000, spawnImpl: (...a) => { spawns++; return fixtureSpawn(...a); } });
  const c = await tools.inspect('claude');
  assert.deepEqual([c.ok, c.path, c.source, c.version], [true, claude, 'path', '2.1.37']);
  const x = await tools.inspect('codex'); assert.deepEqual([x.ok, x.version], [true, '0.155.0']);
  await tools.inspect('claude'); assert.equal(spawns, 2, 'cached by file and modification time');
  await tools.inspect('claude', { fresh: true }); assert.equal(spawns, 3);
  settings = { providerBinary: { claude } };
  assert.equal((await tools.inspect('claude')).source, 'settings', 'cached PATH discovery cannot replace override provenance');
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
  const none = createProviderTools({ settings: () => ({}), env: async () => ({ PATH: path.join(root, 'empty'), HOME: root }), home: root, timeoutMs: 2000 });
  assert.match((await none.inspect('claude')).problem, /Claude Code was not found on the PATH/);
}
{
  // The override reaches the sign-in worker's resolver: an existing absolute file is the answer, anything else is none.
  assert.equal(resolveProviderCli('claude', { env, override: impostor }), impostor);
  assert.equal(resolveProviderCli('claude', { env, override: path.join(root, 'missing') }), null);
  assert.equal(resolveProviderCli('claude', { env, override: 'claude' }), null);
  assert.equal(resolveProviderCli('claude', { env, home: root }), claude);
}
{
  // The fit against the tested version: same or newer minor is silent; older or another major warns and names the tested version.
  const { fitOf, compareVersions, TESTED } = require('../main/provider-tools');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const installed = name => JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8')).version;
  assert.equal(TESTED.claude.sdk, installed('@anthropic-ai/claude-agent-sdk'), 'the stamp matches the installed Agent SDK: run scripts/provider-versions.mjs after a bump');
  assert.equal(TESTED.codex.sdk, installed('@openai/codex-sdk'), 'the stamp matches the installed Codex SDK');
  assert.ok(pkg.dependencies['@anthropic-ai/claude-agent-sdk'] && pkg.dependencies['@openai/codex-sdk']);
  assert.equal(compareVersions('2.1.286', '2.1.276'), 1); assert.equal(compareVersions('2.1.276', '2.1.276'), 0); assert.equal(compareVersions('2.0.9', '2.1.0'), -1);
  const t = TESTED.claude.cli;
  assert.equal(fitOf('claude', t).fit, 'tested');
  assert.equal(fitOf('claude', t.replace(/\d+$/, n => String(Number(n) + 5))).fit, 'newer');
  const older = fitOf('claude', '2.0.1'); assert.equal(older.fit, 'older'); assert.match(older.advice, new RegExp(`older than the ${t.replace(/\./g, '\\.')} Barkdown was tested with`));
  const major = fitOf('claude', '3.0.0'); assert.equal(major.fit, 'major'); assert.match(major.advice, /different major/);
  assert.equal(fitOf('codex', TESTED.codex.cli).fit, 'tested'); assert.equal(fitOf('claude', null).fit, 'unknown');
}
console.log('Provider versions: the stamp matches the pinned SDKs and the fit classification passed.');
fs.rmSync(root, { recursive: true, force: true });
console.log('Provider tools: PATH and Settings resolution, --version sanity run with impostor, broken, slow and missing files, caching, and the resolver override passed.');
