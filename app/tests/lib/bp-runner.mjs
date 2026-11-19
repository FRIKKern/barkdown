// The one way app/tests reach the Barkpark CLI. A run may talk only to the Barkpark it started itself.
//
// Whoever starts a disposable server writes a runtime record and names it in BARKDOWN_OWNED_RUNTIME:
// tests/status-shots-isolated.mjs for its private runtime, tests/ci/boot-barkpark.sh for the CI server.
// Before the first `bp` call this module reads that record and refuses unless
//   * the record exists and parses (no record: this run started no server, so nothing may be sent);
//   * its server is plain http on a loopback address with an explicit port;
//   * it carries the server's token and dataset;
//   * the server process it names is still alive (a record left by an earlier run names a stopped server).
// A stray local server that some other run left behind has no record here, so it is refused too.
// There is no override: no variable lets a run reach a server it did not start.
//
// Once accepted, the record is pinned into this process's environment. bp reads flags > env > repo
// file (.barkpark.json above the working folder) > saved config, so the runner
//   * drops every BARKPARK_* and BP_* variable the shell brought, then sets only the recorded server,
//     token and dataset, with the default workspace and project;
//   * points XDG_CONFIG_HOME at the record's private config folder (or a fresh empty one), so no
//     saved server is read;
//   * starts bp in an empty folder outside any checkout, so no repo file is found;
//   * refuses arguments that pick a destination (-s, --server, --token, ...).
// Every `bp` started from here, and every Electron app a test launches afterwards, inherits the pin.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const OWNED_RUNTIME = 'BARKDOWN_OWNED_RUNTIME';
// Arguments that would send a single call somewhere else than the pinned server.
const ROUTING_FLAGS = new Set(['-s', '--server', '--token', '--dataset', '--workspace', '--project']);
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}\/?$/;

const refuse = reason => new Error(`Refusing to run bp: ${reason}. Live suites and status shots talk only to a Barkpark this run started; run them through \`npm run shots\` or a tests/status-shots-isolated.mjs script (see app/package.json).`);

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

let owned = null;
export function ownedRuntime() {
  if (owned) return owned;
  const file = process.env[OWNED_RUNTIME];
  if (!file) throw refuse('this run started no Barkpark of its own');
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw refuse('the runtime record this run names cannot be read'); }
  const { server, token, dataset, pid, configHome } = record || {};
  if (typeof server !== 'string' || !LOOPBACK.test(server)) throw refuse('the recorded server is not a loopback address with a port');
  if (typeof token !== 'string' || !token || typeof dataset !== 'string' || !dataset) throw refuse('the runtime record has no token or dataset');
  if (!Number.isInteger(pid) || pid <= 0 || !alive(pid)) throw refuse('the server process in the runtime record is not running');
  for (const name of Object.keys(process.env)) if (/^(BARKPARK|BP)_/i.test(name)) delete process.env[name];
  Object.assign(process.env, { BARKPARK_API_URL: server.replace(/\/$/, ''), BARKPARK_API_TOKEN: token, BARKPARK_DATASET: dataset, BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default' });
  process.env.XDG_CONFIG_HOME = typeof configHome === 'string' && configHome ? configHome : fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-config-'));
  owned = Object.freeze({ server: server.replace(/\/$/, ''), dataset, cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-cwd-')) });
  return owned;
}

// For a suite that starts no Barkpark but launches an app whose saved settings use bp: the app gets
// a CLI that can reach nothing (the discard port on this machine, an empty config, no shell routing).
export function unreachableBarkpark(env = process.env) {
  const out = {};
  for (const [name, value] of Object.entries(env)) if (!/^(BARKPARK|BP)_/i.test(name)) out[name] = value;
  return Object.assign(out, { BARKPARK_API_URL: 'http://127.0.0.1:9', BARKPARK_API_TOKEN: 'unreachable', BARKPARK_DATASET: 'production', BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default', XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-unreachable-')) });
}

// `bp` with JSON output. Stdin is only piped when there is input: bp refuses "piped stdin is unused".
export function bp(args, input) {
  const { cwd } = ownedRuntime();
  const routed = args.find(arg => ROUTING_FLAGS.has(String(arg).split('=')[0]));
  if (routed) throw refuse(`a call may not choose its own destination (${routed})`);
  return JSON.parse(execFileSync('bp', [...args, '-o', 'json'], {
    cwd,
    ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input: typeof input === 'string' ? input : JSON.stringify(input) }),
    shell: true, encoding: 'utf8', maxBuffer: 20e6,
  }));
}
