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
// Limit: the pid check proves only that some process has that pid, so a hand-written record naming a
// live pid is accepted; it can still name only a loopback address, never a hosted server.
// There is no override: no variable lets a run reach a server it did not start.
//
// Once accepted, the record is pinned into this process's environment. bp reads flags > env > repo
// file (.barkpark.json above the working folder) > saved config, so the runner
//   * drops every BARKPARK_* and BP_* variable the shell brought, then sets only the recorded server,
//     token and dataset, with the default workspace and project;
//   * points XDG_CONFIG_HOME at the record's private config folder (or a fresh empty one), so no
//     saved server is read;
//   * starts bp in an empty folder outside any checkout, so no repo file is found;
//   * starts it through the app's one spawn function (app/main/cli-spawn.js): no shell on any platform, so
//     one argument stays one argument, and that function checks the same record again before it starts;
//   * refuses a call whose argument list holds a routing flag (ROUTING_FLAGS) or anything starting with one.
// Every `bp` started from here, and every Electron app a test launches afterwards, inherits the pin.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const { cliSpawn } = createRequire(import.meta.url)('../../main/cli-spawn.js');

export const OWNED_RUNTIME = 'BARKDOWN_OWNED_RUNTIME';
// bp's global flags, as its parser knows them (Barkpark internal/cli/globals.go; `bp completion bash` prints
// the list, and tests/bp-runner.test.mjs compares the two). A routing flag picks a server, a token, a dataset,
// workspace or project, a manifest or a session document to log to; the others only shape the output.
export const ROUTING_FLAGS = Object.freeze(['-s', '--server', '--token', '-w', '--workspace', '-p', '--project', '-d', '--dataset', '--manifest', '--session']);
export const OTHER_GLOBAL_FLAGS = Object.freeze(['-o', '--output', '--limit', '--offset', '--json', '-q', '--quiet', '-v', '--verbose', '--no-color', '--dry-run', '--yes', '--all', '--full', '--no-cache', '--no-retry', '-h', '--help', '--version', '-V']);
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
  owned = Object.freeze({ server: server.replace(/\/$/, ''), dataset });
  return owned;
}

// The server a live suite may send HTTP to, taken only from the runtime record (ownedRuntime above). A suite
// calls this first, before its first request. With no BARKDOWN_SHOTS_SERVER and no record it answers null
// (the suite skips as before). Otherwise it refuses unless the record holds and BARKDOWN_SHOTS_SERVER, when
// set, names the recorded server; then the variable and BARKPARK_API_TOKEN carry the record's values only.
export function ownedServer() {
  const named = process.env.BARKDOWN_SHOTS_SERVER;
  if (!named && !process.env[OWNED_RUNTIME]) return null;
  let own;
  try { own = ownedRuntime(); } catch (error) { throw new Error(error.message.replace('Refusing to run bp', 'Refusing to reach Barkpark')); }
  if (named && named.replace(/\/+$/, '') !== own.server) throw new Error(`Refusing to reach Barkpark: BARKDOWN_SHOTS_SERVER names a server this run did not start (${named}). Live suites talk only to the Barkpark in this run's runtime record.`);
  if (named) process.env.BARKDOWN_SHOTS_SERVER = own.server;
  return Object.freeze({ server: own.server, token: process.env.BARKPARK_API_TOKEN, dataset: own.dataset });
}

// For a suite that starts no Barkpark but launches an app whose saved settings use bp: the app gets
// a CLI that can reach nothing (the discard port on this machine, an empty config, no shell routing).
export function unreachableBarkpark(env = process.env) {
  const out = {};
  for (const [name, value] of Object.entries(env)) if (!/^(BARKPARK|BP)_/i.test(name)) out[name] = value;
  return Object.assign(out, { BARKPARK_API_URL: 'http://127.0.0.1:9', BARKPARK_API_TOKEN: 'unreachable', BARKPARK_DATASET: 'production', BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default', XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-unreachable-')) });
}

// `bp` with JSON output. Stdin is only piped when there is input: bp refuses "piped stdin is unused".
export function runOwned(args, input) {
  ownedRuntime();
  const routed = args.map(String).find(arg => ROUTING_FLAGS.some(flag => arg.startsWith(flag)));
  if (routed) throw refuse(`a call may not choose its own destination (${routed})`);
  const start = cliSpawn(args, input);
  return JSON.parse(execFileSync(start.command, start.args, {
    ...start.options, encoding: 'utf8', maxBuffer: 20e6,
    ...(input == null ? {} : { input: typeof input === 'string' ? input : JSON.stringify(input) }),
  }));
}

// bp's own list of global flags, read from its completion script, which reads no server. It starts through
// the same fence, so the caller needs a runtime record (the test owns a listener for it). null when bp is
// not installed here.
export function cliGlobalFlags() {
  const start = cliSpawn(['completion', 'bash']);
  let script;
  try {
    script = execFileSync(start.command, start.args, { ...start.options, encoding: 'utf8', timeout: 30000 });
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const line = script.match(/globals="([^"]*)"/);
  if (!line) throw new Error('bp completion bash printed no global flag list');
  return line[1].split(/\s+/).filter(Boolean);
}
