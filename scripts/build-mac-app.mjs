// Build the macOS application with its runtime inside: Barkdown.app carries the Barkpark
// release, its Erlang and its Postgres under Contents/Resources/runtime, so a profile starts
// with nothing else installed. Unsigned for distribution: signed ad hoc, for this machine.
// Usage: node scripts/build-mac-app.mjs [runtime folder]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), appDir = path.join(root, 'app');
if (process.platform !== 'darwin') { console.error('This script builds the macOS application.'); process.exit(2); }
const pin = fs.readFileSync(path.join(appDir, 'BARKPARK_REF'), 'utf8').trim();
const runtime = path.resolve(process.argv[2] || path.join(root, 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
let mark; try { mark = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8')); } catch { console.error('Not a runtime folder built by build-runtime-release.mjs: ' + runtime); process.exit(2); }
if (mark.upstream !== pin) { console.error(`The runtime holds ${mark.upstream.slice(0, 9)} but Barkdown is pinned to ${pin.slice(0, 9)}.`); process.exit(2); }
if (!mark.postgres || !fs.existsSync(path.join(runtime, 'postgres', 'bin', 'pg_ctl'))) { console.error('The runtime folder carries no Postgres; add one with build-runtime-release.mjs --add-postgres.'); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const config = { ...manifest.build, extraResources: [...(manifest.build.extraResources || []), { from: runtime, to: 'runtime' }], mac: { ...(manifest.build.mac || {}), target: 'dir', identity: '-' } };
const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-mac-app-')), 'builder.json');
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
const run = (command, args) => execFileSync(command, args, { cwd: appDir, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
run('npm', ['run', 'build']);
run(path.join(appDir, 'node_modules', '.bin', 'electron-builder'), ['--mac', '--dir', `--${process.arch}`, '--config', configFile]);
const built = path.join(appDir, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Barkdown.app');
if (!fs.existsSync(path.join(built, 'Contents', 'Resources', 'runtime', 'bin', 'barkpark'))) { console.error('The built application does not carry the runtime.'); process.exit(1); }
console.log('Built ' + built);
