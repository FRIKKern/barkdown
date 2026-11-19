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
// Once accepted, the record is pinned into this process's environment, above the user's saved CLI
// config and any repository context file (bp reads flags > env > repo file > saved config). Every `bp`
// started from here, and every Electron app a test launches afterwards, inherits that pin.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const OWNED_RUNTIME = 'BARKDOWN_OWNED_RUNTIME';
const SERVER_VARS = ['BARKPARK_API_URL', 'BARKPARK_SERVER', 'BARKPARK_URL'];
const TOKEN_VARS = ['BARKPARK_API_TOKEN', 'BARKPARK_TOKEN'];
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
  for (const name of [...SERVER_VARS, ...TOKEN_VARS]) delete process.env[name];
  process.env.BARKPARK_API_URL = server.replace(/\/$/, '');
  process.env.BARKPARK_API_TOKEN = token;
  process.env.BARKPARK_DATASET = dataset;
  if (typeof configHome === 'string' && configHome) process.env.XDG_CONFIG_HOME = configHome;
  owned = Object.freeze({ server: server.replace(/\/$/, ''), dataset });
  return owned;
}

// `bp` with JSON output. Stdin is only piped when there is input: bp refuses "piped stdin is unused".
export function bp(args, input) {
  ownedRuntime();
  const routed = args.find(arg => ROUTING_FLAGS.has(String(arg).split('=')[0]));
  if (routed) throw refuse(`a call may not choose its own destination (${routed})`);
  return JSON.parse(execFileSync('bp', [...args, '-o', 'json'], {
    ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input: typeof input === 'string' ? input : JSON.stringify(input) }),
    shell: true, encoding: 'utf8', maxBuffer: 20e6,
  }));
}
