// Stamp the tool versions the pinned SDKs were built with (C088 S3). Run after an SDK bump, while
// the SDKs' own platform packages are installed: `node scripts/provider-versions.mjs`. The stamp is
// what a user's installed tool is compared against; a bump without a new stamp fails the unit test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Read by path: the SDK packages' exports maps do not expose their package.json.
const version = name => JSON.parse(fs.readFileSync(path.join(app, 'node_modules', name, 'package.json'), 'utf8')).version;
const claudeSdk = version('@anthropic-ai/claude-agent-sdk');
let claudeCli = null;
try { claudeCli = /\d+\.\d+\.\d+/.exec(execFileSync(path.join(app, 'node_modules', `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`, 'claude'), ['--version'], { encoding: 'utf8', timeout: 20000 }))?.[0] || null; } catch {}
// The Agent SDK's platform package carries Claude Code; its own version tracks the SDK's (0.3.N ↔ 2.1.N).
if (!claudeCli) claudeCli = claudeSdk.replace(/^0\.3\./, '2.1.');
const codexSdk = version('@openai/codex-sdk');
const codexCli = version('@openai/codex').replace(/-.*$/, '');
const stamp = { version: 1, generatedAt: new Date().toISOString(), claude: { sdk: claudeSdk, cli: claudeCli, name: 'Claude Code', install: 'https://claude.com/product/claude-code', login: 'claude auth login' }, codex: { sdk: codexSdk, cli: codexCli, name: 'Codex', install: 'https://developers.openai.com/codex/cli', login: 'codex login' } };
fs.writeFileSync(path.join(app, 'main', 'provider-versions.json'), JSON.stringify(stamp, null, 2) + '\n');
console.log(JSON.stringify(stamp));
