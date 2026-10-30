// Build the macOS application with its runtime inside: Barkdown.app carries the Barkpark
// release, its Erlang and its Postgres under Contents/Resources/runtime, so a profile starts
// with nothing else installed.
// Usage: node scripts/build-mac-app.mjs [runtime folder] [--dmg] [--version X.Y.Z[-channel.…]] [--channel nightly|latest]
// --channel also writes the updater feed for that channel beside the image (<channel>-mac.yml, a zip
// and its blockmap, what electron-updater reads), as a release carries them. Nothing is uploaded here.
// Signing: with CSC_NAME (a Developer ID Application identity in the login keychain) and the three
// APPLE_API_* notarization variables set, the build is signed with it, hardened and notarized;
// the disk image is signed, notarized and stapled too, and both are refused unless Gatekeeper accepts
// them as notarized. Otherwise it is signed ad hoc, also with the hardened runtime and the same
// entitlements, so what a notarized build will run under is what every build here is rehearsed under.
// --dmg also writes the disk image people install from (release/Barkdown-<version>-<arch>.dmg).
// --version stamps the built application and its artefact names with a release version without
// touching app/package.json (a nightly carries its own version; the manifest holds the next stable).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), appDir = path.join(root, 'app');
if (process.platform !== 'darwin') { console.error('This script builds the macOS application.'); process.exit(2); }
const pin = fs.readFileSync(path.join(appDir, 'BARKPARK_REF'), 'utf8').trim();
const wantDmg = process.argv.includes('--dmg');
const versionArg = process.argv.find(a => a.startsWith('--version='))?.slice(10) || (process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : null);
const channelArg = process.argv.includes('--channel') ? process.argv[process.argv.indexOf('--channel') + 1] : null;
if (channelArg && !['nightly', 'latest'].includes(channelArg)) { console.error('--channel is nightly or latest'); process.exit(2); }
const signing = ['CSC_NAME', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'].every(name => process.env[name]);
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--version' && all[i - 1] !== '--channel');
const runtime = path.resolve(positional[0] || path.join(root, 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
let mark; try { mark = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8')); } catch { console.error('Not a runtime folder built by build-runtime-release.mjs: ' + runtime); process.exit(2); }
if (mark.upstream !== pin) { console.error(`The runtime holds ${mark.upstream.slice(0, 9)} but Barkdown is pinned to ${pin.slice(0, 9)}.`); process.exit(2); }
if (!mark.postgres || !fs.existsSync(path.join(runtime, 'postgres', 'bin', 'pg_ctl'))) { console.error('The runtime folder carries no Postgres; add one with build-runtime-release.mjs --add-postgres.'); process.exit(2); }
// What runs here because of Homebrew or /usr/local does not run on the Mac it is installed on.
const leaks = (await import('./runtime-macho.mjs')).foreignLinks(runtime);
if (leaks.length) { console.error('The runtime links outside itself and macOS; run build-runtime-release.mjs --carry-libraries on it:\n' + leaks.map(l => `  ${l.file} → ${l.library || 'rpath ' + l.rpath}`).join('\n')); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
if (versionArg && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(versionArg)) { console.error('Not a version: ' + versionArg); process.exit(2); }
const version = versionArg || manifest.version;
const remote = (() => { try { return /github\.com[:/]([^/]+)\/([^/.]+)/.exec(execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: root, encoding: 'utf8' })); } catch { return null; } })();
const config = { ...manifest.build, extraResources: [...(manifest.build.extraResources || []), { from: runtime, to: 'runtime' }],
  mac: { ...(manifest.build.mac || {}), target: wantDmg ? ['dir', 'dmg', ...(channelArg ? ['zip'] : [])] : 'dir',
    ...(signing ? { identity: process.env.CSC_NAME, hardenedRuntime: true, gatekeeperAssess: false, notarize: false } : { identity: '-', hardenedRuntime: true }) },
  // Notarized by scripts/notarize-after-sign.cjs (patient with Apple's queue and a dropped connection), stapled before the zip and image.
  ...(signing ? { afterSign: path.join(root, 'scripts', 'notarize-after-sign.cjs') } : {}),
  ...(versionArg ? { extraMetadata: { version } } : {}),
  ...(wantDmg ? { artifactName: 'Barkdown-${version}-${arch}.${ext}', dmg: { sign: signing, writeUpdateInfo: Boolean(channelArg) } } : {}),
  ...(channelArg && remote ? { publish: [{ provider: 'github', owner: remote[1], repo: remote[2], releaseType: channelArg === 'nightly' ? 'prerelease' : 'release', ...(channelArg === 'nightly' ? { channel: 'nightly' } : {}) }] } : {}) };
if (channelArg && !remote) { console.error('--channel needs a GitHub remote to name the feed'); process.exit(2); }
console.log(signing ? `Signing with ${process.env.CSC_NAME} and notarizing.` : 'Signing ad hoc (no CSC_NAME / APPLE_API_* in the environment).');
const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-mac-app-')), 'builder.json');
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
// An empty CSC_LINK, CSC_KEY_PASSWORD or APPLE_* variable (a CI secret that does not exist yet) is read by electron-builder as a
// certificate path or password; what is empty is not passed at all.
const builderEnv = Object.fromEntries(Object.entries(process.env).filter(([name, value]) => !((name.startsWith('CSC_') || name.startsWith('APPLE_')) && value === '')));
const run = (command, args) => execFileSync(command, args, { cwd: appDir, stdio: ['ignore', 'inherit', 'inherit'], env: { ...builderEnv, CSC_IDENTITY_AUTO_DISCOVERY: signing ? 'true' : 'false' } });
// node-pty's prebuilt tarball ships spawn-helper without its execute bit; the running app repairs that
// in place (main/terminal-worker.js), which an installed copy it cannot write to never gets. Ship it executable.
const ptyHelpers = ['arm64', 'x64'].map(arch => path.join(appDir, 'node_modules', 'node-pty', 'prebuilds', `darwin-${arch}`, 'spawn-helper')).filter(file => fs.existsSync(file));
for (const helper of ptyHelpers) fs.chmodSync(helper, 0o755);
// Squirrel.Mac's installer removes the quarantine attribute from every file of an update and cannot from a read-only
// one ("Couldn't remove quarantine attribute ... read-only", then "Too many attempts to install"): no signed update
// installed until the bundle was writable throughout. OTP installs some files read-only (.appup, .hrl, .so).
const readOnly = dir => { const found = []; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isSymbolicLink()) continue; if (!(fs.statSync(file).mode & 0o200)) found.push(file); if (entry.isDirectory()) found.push(...readOnly(file)); } return found; };
for (const file of readOnly(runtime)) fs.chmodSync(file, fs.statSync(file).mode | 0o200);
run('npm', ['run', 'build']);
run(path.join(appDir, 'node_modules', '.bin', 'electron-builder'), ['--mac', ...(wantDmg ? [] : ['--dir']), `--${process.arch}`, '--publish', 'never', '--config', configFile]);
const built = path.join(appDir, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Barkdown.app');
if (!fs.existsSync(path.join(built, 'Contents', 'Resources', 'runtime', 'bin', 'barkpark'))) { console.error('The built application does not carry the runtime.'); process.exit(1); }
const shippedHelper = path.join(built, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', 'node-pty', 'prebuilds', `darwin-${process.arch}`, 'spawn-helper');
if (!(fs.statSync(shippedHelper).mode & 0o111)) { console.error('The terminal helper is not executable in the built application: ' + shippedHelper); process.exit(1); }
const stillReadOnly = readOnly(built);
if (stillReadOnly.length) { console.error(`The built application has ${stillReadOnly.length} read-only files; an update could not install over it:\n` + stillReadOnly.slice(0, 10).map(f => '  ' + f).join('\n')); process.exit(1); }
console.log('Built ' + built);
if (wantDmg) {
  const dmg = path.join(appDir, 'release', `Barkdown-${version}-${process.arch}.dmg`);
  if (!fs.existsSync(dmg)) { console.error('The disk image was not written: ' + dmg); process.exit(1); }
  if (signing) {
    // The application was notarized after signing (notarize-after-sign.cjs); the image a person downloads is notarized and stapled here,
    // so it opens without a warning, offline too. Stapling rewrites the image: the feed's entry for it follows.
    const sha512 = file => crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
    const before = { sha512: sha512(dmg), size: fs.statSync(dmg).size };
    const { notarize, staple } = await import('./notarize.mjs');
    await notarize(dmg); await staple(dmg);
    for (const [label, target, type] of [['application', built, 'exec'], ['disk image', dmg, 'open']]) {
      const check = spawnSync('spctl', ['--assess', '-vv', '--type', type, ...(type === 'open' ? ['--context', 'context:primary-signature'] : []), target], { encoding: 'utf8' });
      if (check.status !== 0 || !/source=Notarized Developer ID/.test(check.stderr)) { console.error(`Gatekeeper does not accept the ${label} as notarized:\n${check.stderr}`); process.exit(1); }
    }
    console.log('Gatekeeper accepts the application and the disk image as notarized (Developer ID).');
    const feed = channelArg && path.join(appDir, 'release', `${channelArg}-mac.yml`);
    if (feed && fs.existsSync(feed)) {
      const text = fs.readFileSync(feed, 'utf8'), entry = `sha512: ${before.sha512}\n    size: ${before.size}`;
      if (!text.includes(entry)) { console.error('The updater feed does not name the disk image as built; it cannot follow the stapled one.'); process.exit(1); }
      fs.writeFileSync(feed, text.replace(entry, `sha512: ${sha512(dmg)}\n    size: ${fs.statSync(dmg).size}`));
    }
  }
  // The checksum people verify a download against, beside the image (A5: artifact integrity).
  const digest = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(dmg)).digest('hex');
  fs.writeFileSync(dmg + '.sha256', `${digest}  ${path.basename(dmg)}\n`);
  console.log(`Disk image ${dmg} (${Math.round(fs.statSync(dmg).size / 1048576)} MB), sha256 ${digest.slice(0, 12)}…`);
  if (channelArg) {
    const feed = path.join(appDir, 'release', `${channelArg}-mac.yml`);
    if (!fs.existsSync(feed)) { console.error('The updater feed was not written: ' + feed); process.exit(1); }
    console.log(`Updater feed ${feed}`);
  }
}
