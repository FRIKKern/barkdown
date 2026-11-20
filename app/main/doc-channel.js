// The dev app's route for the agents' document reads in CLI mode.
//
// Outside a packaged build the Barkpark CLI starts only in the opted-in main process (cli-spawn.js), so the
// agents' document server, a child of the provider run, cannot start it. Instead it asks main over the
// control socket:
//
//   document server ── { docToken, argv } ──► control socket ──► serve(): token, read verb, run's server
//   (BARKDOWN_DOC_CHANNEL, this run only)                         └─► barkpark.cli(argv) in main
//
// Main issues one token per provider run, 32 random bytes, in the settings for starting that run's document
// server. Claude Code and Codex receive those settings on their command line and pass them to the server they
// start, which removes the token from its own environment at once. The token is not in the control pointer
// files, terminal tabs or the environment the provider and its tools run with, and it is revoked when the
// run finishes and when main quits. A request carries argv only: main builds the CLI's
// environment and folder itself. Only the reads the document server issues run (DOC_READS, checked against
// its call sites both ways by tests/doc-channel.test.mjs), and only against the run's own server, named first
// as the app's own routing does (-s <server>); edits and
// anything else are refused. Packaged builds issue no token: their document server starts the CLI itself.
const crypto = require('node:crypto');
const net = require('node:net');

const ENV = 'BARKDOWN_DOC_CHANNEL';
const DOC_READS = Object.freeze(['whoami', 'doc query', 'doc get']);
const NOT_A_READ = 'In the dev app with the CLI library, agents can read documents but not edit them; edits work in the installed app.';
const TIMEOUT_MS = 65000; // above barkpark.cli's own 60 s limit, so its answer arrives first
const fail = (code, message) => Object.assign(new Error(message), { code });

// ── main process ──
let socketPath = null;
const grants = new Map(); // token → the server the run captured

// Called once the control socket listens. Only the opted-in dev app's main process opens the channel.
function open(path, { packaged = require('./cli-spawn').PACKAGED, optedIn = require('./cli-spawn').OPTED_IN } = {}) {
  socketPath = !packaged && optedIn ? path : null;
  return Boolean(socketPath);
}

// One token for one run of a CLI-mode library, or null when the channel is closed.
function grant(connection) {
  if (!socketPath || !connection?.enabled || !connection.viaCli || typeof connection.server !== 'string' || !connection.server) return null;
  const token = crypto.randomBytes(32).toString('hex');
  grants.set(token, connection.server.replace(/\/+$/, ''));
  return Object.freeze({ env: JSON.stringify({ socket: socketPath, token }), revoke: () => grants.delete(token) });
}

function closeAll() { grants.clear(); socketPath = null; }

function serverFor(given) {
  const candidate = Buffer.from(typeof given === 'string' ? given : '');
  let found = null;
  for (const [token, server] of grants) { const expected = Buffer.from(token); if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) found = server; }
  return found;
}

// The control socket hands every message with a docToken here, and only here.
async function serve(message) {
  const server = serverFor(message.docToken);
  if (!server) throw fail('refused', 'refused');
  const argv = message.argv;
  if (!Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string')) throw fail('bad_request', 'argv must be a list of strings');
  if (argv[0] !== '-s' || String(argv[1] ?? '').replace(/\/+$/, '') !== server) throw fail('not_own_server', 'Refused: document reads run only against the run\'s own server.');
  const { argumentRefusal } = require('./cli-spawn');
  const reason = argumentRefusal([...argv, '-o', 'json'], server, DOC_READS);
  if (reason) throw fail('not_a_read', /^only the commands/.test(reason) ? NOT_A_READ : `Refused: ${reason}.`);
  return require('./barkpark').cli(argv);
}

// ── the document server ──
// Read once and removed from this process's environment, so nothing it starts inherits it.
const childGrant = (() => { const raw = process.env[ENV]; delete process.env[ENV]; try { const value = raw ? JSON.parse(raw) : null; return value?.socket && value.token ? value : null; } catch { return null; } })();

function routed() { return Boolean(childGrant); }

function ask(argv, input) {
  if (input != null) return Promise.reject(fail('not_a_read', NOT_A_READ));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(childGrant.socket); let buffer = '', done = false;
    const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); fn(value); };
    const timer = setTimeout(() => finish(reject, fail('timeout', 'Barkdown did not answer the document read in time.')), TIMEOUT_MS);
    socket.once('connect', () => socket.write(JSON.stringify({ id: 1, docToken: childGrant.token, argv: argv.map(String) }) + '\n'));
    socket.once('error', error => finish(reject, fail('not_running', `Could not reach Barkdown for the document read (${error.code || error.message}).`)));
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8'); const at = buffer.indexOf('\n'); if (at < 0) return;
      let reply; try { reply = JSON.parse(buffer.slice(0, at)); } catch { return finish(reject, fail('bad_answer', 'Barkdown sent an answer that could not be read.')); }
      if (reply.ok) finish(resolve, reply.result); else finish(reject, fail(reply.error?.code || 'failed', reply.error?.message || 'The document read failed.'));
    });
    socket.once('close', () => finish(reject, fail('not_running', 'Barkdown closed the connection before answering.')));
  });
}

module.exports = { ENV, DOC_READS, NOT_A_READ, open, grant, closeAll, serve, routed, ask };
