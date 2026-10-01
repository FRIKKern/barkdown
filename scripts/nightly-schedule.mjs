// Install or remove the launchd agent that runs scripts/nightly-tick.sh every two hours on this Mac
// (docs/RELEASE.md, "The schedule"). The plist template names this checkout's path when installed.
// Usage: node scripts/nightly-schedule.mjs install | remove | status
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const label = 'no.guerrilla.barkdown.nightly', plist = path.join(os.homedir(), 'Library', 'LaunchAgents', label + '.plist'), domain = `gui/${process.getuid()}`;
const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });
const action = process.argv[2];
if (process.platform !== 'darwin') { console.error('The schedule is a launchd agent; macOS only.'); process.exit(2); }
if (action === 'install') {
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(plist, fs.readFileSync(path.join(root, 'scripts', 'launchd', label + '.plist'), 'utf8').replaceAll('__REPO__', root));
  launchctl('bootout', domain, plist);
  const r = launchctl('bootstrap', domain, plist);
  if (r.status !== 0) { console.error('launchctl bootstrap failed: ' + (r.stderr || r.stdout)); process.exit(1); }
  console.log(`Installed ${label}: ${plist}; every 2 h it runs scripts/nightly-tick.sh (log: .release/nightly-tick.log).`);
} else if (action === 'remove') {
  launchctl('bootout', domain, plist);
  fs.rmSync(plist, { force: true });
  console.log(`Removed ${label}.`);
} else if (action === 'status') {
  const r = launchctl('print', `${domain}/${label}`);
  console.log(r.status === 0 ? `Loaded: ${plist}\n` + r.stdout.split('\n').filter(l => /state|last exit|run interval|program/.test(l)).join('\n') : `Not loaded (${fs.existsSync(plist) ? 'plist present' : 'no plist'}).`);
} else { console.error('Usage: node scripts/nightly-schedule.mjs install | remove | status'); process.exit(2); }
