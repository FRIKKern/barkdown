// The one place Barkdown starts the Barkpark CLI, for the app and for the test runner alike.
//
// No shell on any platform: the CLI is a native executable on Windows too, so titles and searches stay
// literal arguments (cmd.exe would split spaces and interpret shell metacharacters). A write without a body
// has no stdin pipe: older native CLI builds correctly refuse an unused pipe as a possibly lost payload.
//
// Outside a packaged build the CLI is fenced. It starts only against a Barkpark that this run started and
// recorded: the file named by BARKDOWN_OWNED_RUNTIME (written by tests/status-shots-isolated.mjs or the CI
// boot script) must name a plain-http loopback server with a port, its token and dataset, and a live
// process. The child then gets only that server in its environment, an empty or private CLI config and a
// folder outside any checkout, and no argument may name another server. Anything else is refused with one
// sentence and nothing starts, however the call was reached.
// The dev app (`npm start`, `npm run dev`) turns the fence off with the one opt-in that app/scripts/start.mjs
// sets; a packaged build never has it on.
const fs = require('fs');
const os = require('os');
const path = require('path');

const COMMAND = 'bp';
const OPT_IN = 'BARKDOWN_DEV_CLI_UNFENCED';
const OPT_IN_VALUE = 'npm-start';
const OWNED_RUNTIME = 'BARKDOWN_OWNED_RUNTIME';
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}\/?$/;
const REFUSAL = 'Refused to start the Barkpark CLI: outside a packaged build it talks only to a Barkpark this run started and recorded';
// Flags that would pick credentials, a manifest or a session document instead of the recorded server's.
const NEVER_FENCED = ['--token', '--manifest', '--session'];
// An argument that names a server: a URL, or a host with a port (localhost, a dotted name or address, [v6]).
const SERVERISH = /[a-z][a-z0-9+.-]*:\/\/|(^|[^\w])(localhost|[\w-]+(\.[\w-]+)+|\[[0-9a-f:.]+\]):\d{1,5}(?!\w)/i;
const bare = value => String(value ?? '').replace(/\/+$/, '');

function packaged() {
  try { return Boolean(require('electron').app?.isPackaged); } catch { return false; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

let folders = null;
const privateFolders = () => folders || (folders = { config: fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-cli-config-')), cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-cli-cwd-')) });

function refuse(reason) {
  const error = new Error(`${REFUSAL} (${reason}). Start the dev app with npm start or npm run dev; run tests through npm run shots or a tests/status-shots-isolated.mjs script.`);
  error.code = 'cli_fenced';
  console.error(error.message);
  return error;
}

// The record this run wrote for the server it started, or a refusal.
function ownedRecord() {
  const file = process.env[OWNED_RUNTIME];
  if (!file) throw refuse('this run recorded no Barkpark of its own');
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw refuse('the runtime record cannot be read'); }
  const { server, token, dataset, pid, configHome } = record || {};
  if (typeof server !== 'string' || !LOOPBACK.test(server)) throw refuse('the recorded server is not a loopback address with a port');
  if (typeof token !== 'string' || !token || typeof dataset !== 'string' || !dataset) throw refuse('the runtime record has no token or dataset');
  if (!Number.isInteger(pid) || pid <= 0 || !alive(pid)) throw refuse('the recorded server process is not running');
  return { server: bare(server), token, dataset, configHome: typeof configHome === 'string' && configHome ? configHome : null };
}

function fenced() {
  return !packaged() && process.env[OPT_IN] !== OPT_IN_VALUE;
}

// { command, args, options } for child_process spawn/execFile. Throws the refusal when fenced and not owned.
function cliSpawn(args, input) {
  const full = [...args.map(String), '-o', 'json'];
  const options = { windowsHide: true, shell: false, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] };
  if (!fenced()) return { command: COMMAND, args: full, options };
  const own = ownedRecord();
  for (let i = 0; i < full.length; i++) {
    const arg = full[i];
    if (NEVER_FENCED.some(flag => arg.startsWith(flag))) throw refuse(`an argument picks its own credentials or document (${arg})`);
    const server = arg === '-s' || arg === '--server' ? full[++i] : arg.startsWith('--server=') ? arg.slice(9) : null;
    if (server !== null) { if (bare(server) !== own.server) throw refuse(`an argument names another server (${server})`); continue; }
    if (SERVERISH.test(arg) && bare(arg) !== own.server) throw refuse(`an argument names another server (${arg})`);
  }
  const env = {};
  for (const [name, value] of Object.entries(process.env)) if (!/^(BARKPARK|BP)_/i.test(name)) env[name] = value;
  Object.assign(env, { BARKPARK_API_URL: own.server, BARKPARK_API_TOKEN: own.token, BARKPARK_DATASET: own.dataset, BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default', XDG_CONFIG_HOME: own.configHome || privateFolders().config });
  return { command: COMMAND, args: full, options: { ...options, env, cwd: privateFolders().cwd } };
}

module.exports = { cliSpawn, COMMAND };
