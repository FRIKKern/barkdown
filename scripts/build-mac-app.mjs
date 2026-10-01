// Build the macOS application with its runtime inside: Barkdown.app carries the Barkpark
// release, its Erlang and its Postgres under Contents/Resources/runtime, so a profile starts
// with nothing else installed. Unsigned for distribution: signed ad hoc, for this machine.
// Usage: node scripts/build-mac-app.mjs [runtime folder] [--dmg] [--version X.Y.Z[-channel.…]]
// --dmg also writes the disk image people install from (release/Barkdown-<version>-<arch>.dmg).
// --version stamps the built application and its artefact names with a release version without
// touching app/package.json (a nightly carries its own version; the manifest holds the next stable).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), appDir = path.join(root, 'app');
if (process.platform !== 'darwin') { console.error('This script builds the macOS application.'); process.exit(2); }
const pin = fs.readFileSync(path.join(appDir, 'BARKPARK_REF'), 'utf8').trim();
const wantDmg = process.argv.includes('--dmg');
const versionArg = process.argv.find(a => a.startsWith('--version='))?.slice(10) || (process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : null);
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--version');
const runtime = path.resolve(positional[0] || path.join(root, 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
let mark; try { mark = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8')); } catch { console.error('Not a runtime folder built by build-runtime-release.mjs: ' + runtime); process.exit(2); }
if (mark.upstream !== pin) { console.error(`The runtime holds ${mark.upstream.slice(0, 9)} but Barkdown is pinned to ${pin.slice(0, 9)}.`); process.exit(2); }
if (!mark.postgres || !fs.existsSync(path.join(runtime, 'postgres', 'bin', 'pg_ctl'))) { console.error('The runtime folder carries no Postgres; add one with build-runtime-release.mjs --add-postgres.'); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
if (versionArg && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(versionArg)) { console.error('Not a version: ' + versionArg); process.exit(2); }
const version = versionArg || manifest.version;
const config = { ...manifest.build, extraResources: [...(manifest.build.extraResources || []), { from: runtime, to: 'runtime' }], mac: { ...(manifest.build.mac || {}), target: wantDmg ? ['dir', 'dmg'] : 'dir', identity: '-' },
  ...(versionArg ? { extraMetadata: { version } } : {}),
  ...(wantDmg ? { artifactName: 'Barkdown-${version}-${arch}.${ext}', dmg: { sign: false, writeUpdateInfo: false } } : {}) };
const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-mac-app-')), 'builder.json');
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
const run = (command, args) => execFileSync(command, args, { cwd: appDir, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
run('npm', ['run', 'build']);
run(path.join(appDir, 'node_modules', '.bin', 'electron-builder'), ['--mac', ...(wantDmg ? [] : ['--dir']), `--${process.arch}`, '--config', configFile]);
const built = path.join(appDir, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Barkdown.app');
if (!fs.existsSync(path.join(built, 'Contents', 'Resources', 'runtime', 'bin', 'barkpark'))) { console.error('The built application does not carry the runtime.'); process.exit(1); }
console.log('Built ' + built);
if (wantDmg) {
  const dmg = path.join(appDir, 'release', `Barkdown-${version}-${process.arch}.dmg`);
  if (!fs.existsSync(dmg)) { console.error('The disk image was not written: ' + dmg); process.exit(1); }
  // The checksum people verify a download against, beside the image (A5: artifact integrity).
  const digest = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(dmg)).digest('hex');
  fs.writeFileSync(dmg + '.sha256', `${digest}  ${path.basename(dmg)}\n`);
  console.log(`Disk image ${dmg} (${Math.round(fs.statSync(dmg).size / 1048576)} MB), sha256 ${digest.slice(0, 12)}…`);
}
