// The one place Barkdown starts the Barkpark CLI, for the app and for the test runner alike.
//
// No shell on any platform: the CLI is a native executable on Windows too, so titles and searches stay
// literal arguments (cmd.exe would split spaces and interpret shell metacharacters). A write without a body
// has no stdin pipe: older native CLI builds correctly refuse an unused pipe as a possibly lost payload.
//
// Outside a packaged build the CLI is fenced. It starts only against a Barkpark that this run started and
// recorded: the file named by BARKDOWN_OWNED_RUNTIME (written by tests/status-shots-isolated.mjs or the CI
// boot script) must name a plain-http loopback server with a port, its token and dataset, and a live
// process. Then only the verbs Barkdown's own code issues may run (VERBS), no argument may name another
// server, and the child gets only the recorded server in its environment, an empty or private CLI config
// and a folder outside any checkout. Anything else is refused with one sentence and nothing starts.
//
// Both answers are read once, when this module loads (main.js loads it first):
//   * packaged: this file sits inside a real app.asar archive, in Electron, and in the main process
//     Electron's own app.isPackaged agrees. A require cache, a preload or an ELECTRON_* variable cannot move
//     this file into an archive.
//   * the dev opt-in: FLAG on the Electron main process's own command line, which only app/scripts/start.mjs
//     passes (`npm start`, `npm run dev`). It is removed from process.argv here, so code that forwards argv
//     cannot hand it on, and an environment variable has no effect. Children (terminal tabs, provider runs,
//     the MCP server, workers) are their own processes and are fenced. An in-app relaunch starts a new main
//     process, not a child: relaunchArgs() gives it the command line back, with the flag if this one had it.
const fs = require('fs');
const os = require('os');
const path = require('path');

const COMMAND = 'bp';
const FLAG = '--barkdown-dev-cli-unfenced';
const OWNED_RUNTIME = 'BARKDOWN_OWNED_RUNTIME';
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}\/?$/;
const REFUSAL = 'Refused to start the Barkpark CLI: outside a packaged build it talks only to a Barkpark this run started and recorded';
// Every verb Barkdown's code and its test runner issue (tests/cli-fence.test.mjs checks this list against
// every call site, both ways). Anything else, `cloud` included, is refused by name when fenced.
const VERBS = Object.freeze(['bulldocs patch', 'bulldocs publish', 'completion bash', 'doc backlinks', 'doc create-or-replace', 'doc get', 'doc history', 'doc publish', 'doc query', 'media upload', 'servers', 'use', 'whoami']);
// The routing the app itself puts before a verb (cliScope): pairs of these flags and their values.
const LEADING_ROUTING = new Set(['-s', '-d', '-w', '-p']);
// Global flags no caller uses that pick a token, a local command manifest or a session document. Refused
// as well; the verb list and the server check below are what keep the destination.
const NEVER_FENCED = ['--token', '--manifest', '--session'];
// A value naming a server: a URL anywhere in it, a loopback name or IP literal, or a name with a port.
const NAMES_SERVER = [/[a-z][a-z0-9+.-]*:\/\//i, /(^|[^\w.-])(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:.]*\])(?![\w-])/i, /(^|[^\w])[\w-]+(\.[\w-]+)+:\d{1,5}(?!\w)/];

const PACKAGED = (() => {
  if (!process.versions.electron) return false;
  const at = __filename.search(/[\\/]app\.asar[\\/]/);
  if (at < 0) return false;
  try { if (!require('original-fs').statSync(__filename.slice(0, at + '/app.asar'.length)).isFile()) return false; } catch { return false; }
  if (process.type === 'browser') { try { if (require('electron').app.isPackaged !== true) return false; } catch { return false; } }
  return true;
})();
const OPTED_IN = Boolean(process.versions.electron) && process.type === 'browser' && process.argv.includes(FLAG);
for (let at = process.argv.indexOf(FLAG); at >= 0; at = process.argv.indexOf(FLAG)) process.argv.splice(at, 1);

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

let folders = null;
const privateFolders = () => folders || (folders = { config: fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-cli-config-')), cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-cli-cwd-')) });
const bare = value => String(value ?? '').replace(/\/+$/, '');

function refuse(reason) {
  // An Electron child run as node (the agents' document server) is fenced in the dev app; it has no route to the CLI there.
  const advice = process.versions.electron && process.type !== 'browser'
    ? 'Document reads through the CLI are off in the dev app; they work in the installed app.'
    : 'Start the dev app with npm start or npm run dev; run tests through npm run shots or a tests/status-shots-isolated.mjs script.';
  const error = new Error(`${REFUSAL} (${reason}). ${advice}`);
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

// The verb after the app's leading routing pairs, if it is on the list.
function verbOf(args, verbs = VERBS) {
  let at = 0;
  while (LEADING_ROUTING.has(args[at])) at += 2;
  const two = args.slice(at, at + 2).join(' ');
  return verbs.includes(two) ? two : verbs.includes(args[at]) ? args[at] : null;
}

// Why these arguments may not run against `server`, or null: a verb off the list, an argument that picks
// its own credentials or document, or one that names another server. The dev app's main process applies
// the same rule to the agents' document reads (doc-channel.js), with its own shorter list.
function argumentRefusal(full, server, verbs = VERBS) {
  if (!verbOf(full, verbs)) return `only the commands Barkdown issues may run (${full.slice(0, 3).join(' ')})`;
  for (let i = 0; i < full.length; i++) {
    const arg = full[i];
    if (NEVER_FENCED.some(flag => arg.startsWith(flag))) return `an argument picks its own credentials or document (${arg})`;
    const named = arg === '-s' || arg === '--server' ? full[++i] : arg.startsWith('--server=') ? arg.slice(9) : null;
    if (named !== null) { if (bare(named) !== bare(server)) return `an argument names another server (${named})`; continue; }
    if (NAMES_SERVER.some(pattern => pattern.test(arg)) && bare(arg) !== bare(server)) return `an argument names another server (${arg})`;
  }
  return null;
}

// { command, args, options } for child_process spawn/execFile. Throws the refusal when fenced and not owned.
function cliSpawn(args, input) {
  const full = [...args.map(String), '-o', 'json'];
  const options = { windowsHide: true, shell: false, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] };
  if (PACKAGED || OPTED_IN) return { command: COMMAND, args: full, options };
  const own = ownedRecord();
  const reason = argumentRefusal(full, own.server);
  if (reason) throw refuse(reason);
  const env = {};
  for (const [name, value] of Object.entries(process.env)) if (!/^(BARKPARK|BP)_/i.test(name)) env[name] = value;
  Object.assign(env, { BARKPARK_API_URL: own.server, BARKPARK_API_TOKEN: own.token, BARKPARK_DATASET: own.dataset, BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default', XDG_CONFIG_HOME: own.configHome || privateFolders().config });
  return { command: COMMAND, args: full, options: { ...options, env, cwd: privateFolders().cwd } };
}

// The control socket (the `barkdown` command) in the opted-in dev app. Its requests reach the library through
// the window, where main cannot tell them from the person's own actions, so the socket decides by command:
//   * commands that can change the library setting or its mode never run over it, whatever the mode;
//   * while the library is the CLI (main reads its setting at each request), only commands that cannot reach
//     the library run. Every other command, a new one included, is refused until it is listed.
// tests/cli-fence-control.test.mjs checks both lists against shared/control-commands.js and the handlers.
const CONTROL_CHANGES_LIBRARY = Object.freeze(['paper.rollback', 'paper.switch', 'profile.import', 'profile.switch', 'settings.set']);
// Only commands the socket answers itself (app/main/control.js), never main's handlers or the window: a
// command that reaches either can end in a library read or write, so it stays off until a run proves it.
const CONTROL_WITHOUT_LIBRARY = Object.freeze(['commands', 'log']);

// null when the control command may run, else the sentence that refuses it.
function controlRefusal(command, cliLibrary) {
  if (PACKAGED || !OPTED_IN) return null;
  if (CONTROL_CHANGES_LIBRARY.includes(command)) return 'In the dev app, this command is off over the command line because it can change the library setting; it works in the installed app.';
  if (cliLibrary && !CONTROL_WITHOUT_LIBRARY.includes(command)) return 'In the dev app with the CLI library, this command is off; it works in the installed app.';
  return null;
}

// The command line for app.relaunch: this process's own, plus the dev opt-in when this process was opted in.
function relaunchArgs() {
  return [...process.argv.slice(1), ...(OPTED_IN ? [FLAG] : [])];
}

module.exports = { cliSpawn, relaunchArgs, controlRefusal, argumentRefusal, COMMAND, VERBS, PACKAGED, OPTED_IN, CONTROL_CHANGES_LIBRARY, CONTROL_WITHOUT_LIBRARY };
