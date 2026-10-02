// Install, remove or inspect the launchd agent that runs the nightly tick every two hours on this Mac
// (docs/RELEASE.md, "The schedule"). The schedule works in a checkout of its own under
// ~/Library/Application Support/Barkdown/nightly: a background process is denied ~/Documents by macOS
// privacy protection (the agent's first eight runs died on "can't open input file"), and a release should
// never run inside the checkout a person is working in anyway.
// Usage: node scripts/nightly-schedule.mjs install | remove | status
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const label = 'no.guerrilla.barkdown.nightly', plist = path.join(os.homedir(), 'Library', 'LaunchAgents', label + '.plist'), domain = `gui/${process.getuid()}`;
const checkout = path.join(os.homedir(), 'Library', 'Application Support', 'Barkdown', 'nightly');
const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });
const run = (command, args, cwd) => { const r = spawnSync(command, args, { cwd, stdio: 'inherit' }); if (r.status !== 0) { console.error(`${command} ${args.join(' ')} failed in ${cwd}`); process.exit(1); } };
const action = process.argv[2];
if (process.platform !== 'darwin') { console.error('The schedule is a launchd agent; macOS only.'); process.exit(2); }
if (action === 'install') {
  // The schedule's own checkout, brought to origin/main, with its dependencies and the runtime folder.
  // Cloned from this checkout (no credentials needed), then pointed at GitHub with gh as the credential
  // helper for this repository only; git never prompts, it fails instead, so a tick cannot hang.
  process.env.GIT_TERMINAL_PROMPT = '0';
  const origin = execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd: root, encoding: 'utf8' }).trim();
  if (!fs.existsSync(path.join(checkout, '.git'))) { fs.mkdirSync(path.dirname(checkout), { recursive: true }); run('git', ['clone', '--quiet', '--branch', 'main', root, checkout], path.dirname(checkout)); run('git', ['remote', 'set-url', 'origin', origin], checkout); }
  run('git', ['config', 'credential.helper', '!gh auth git-credential'], checkout);
  run('git', ['fetch', '--quiet', 'origin'], checkout); run('git', ['checkout', '--quiet', 'main'], checkout); run('git', ['merge', '--quiet', '--ff-only', 'origin/main'], checkout);
  run('npm', ['ci', '--no-audit', '--no-fund', '--silent'], checkout); run('npm', ['ci', '--no-audit', '--no-fund', '--silent'], path.join(checkout, 'app')); run('npx', ['install-electron', '--no'], path.join(checkout, 'app'));
  run('npx', ['playwright', 'install', 'chromium'], checkout);
  const pin = fs.readFileSync(path.join(root, 'app', 'BARKPARK_REF'), 'utf8').trim(), runtimeName = `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`;
  const source = path.join(root, 'runtime', runtimeName), target = path.join(checkout, 'runtime', runtimeName);
  if (!fs.existsSync(target)) { if (!fs.existsSync(source)) { console.error(`No runtime folder at ${source}; build it first (scripts/build-runtime-release.mjs).`); process.exit(1); } fs.mkdirSync(path.dirname(target), { recursive: true }); fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true }); }
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(plist, fs.readFileSync(path.join(root, 'scripts', 'launchd', label + '.plist'), 'utf8').replaceAll('__REPO__', checkout));
  launchctl('bootout', domain, plist);
  const r = launchctl('bootstrap', domain, plist);
  if (r.status !== 0) { console.error('launchctl bootstrap failed: ' + (r.stderr || r.stdout)); process.exit(1); }
  console.log(`Installed ${label}: every 2 h it runs ${checkout}/scripts/nightly-tick.sh (log: ${checkout}/.release/nightly-tick.log).`);
} else if (action === 'remove') {
  launchctl('bootout', domain, plist);
  fs.rmSync(plist, { force: true });
  console.log(`Removed ${label}. The checkout at ${checkout} is kept; delete it by hand if it is not wanted.`);
} else if (action === 'status') {
  const r = launchctl('print', `${domain}/${label}`);
  console.log(r.status === 0 ? `Loaded: ${plist}\ncheckout: ${checkout}\n` + r.stdout.split('\n').filter(l => /state|last exit|run interval|runs =/.test(l)).join('\n') : `Not loaded (${fs.existsSync(plist) ? 'plist present' : 'no plist'}).`);
  const log = path.join(checkout, '.release', 'nightly-tick.log'); if (fs.existsSync(log)) console.log('last tick:\n' + fs.readFileSync(log, 'utf8').trim().split('\n').slice(-4).join('\n'));
} else { console.error('Usage: node scripts/nightly-schedule.mjs install | remove | status'); process.exit(2); }
