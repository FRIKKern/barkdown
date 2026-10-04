// The client half of Barkdown's control surface (C094): find the running app and send it one command.
// Used by the `barkdown` CLI. No dependencies, so it runs on the app's own runtime or any Node.
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const POINTER_DIR = path.join(os.homedir(), '.barkdown', 'control');
const fail = (code, message) => Object.assign(new Error(message), { code });
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
const readPointer = file => { try { const p = JSON.parse(fs.readFileSync(file, 'utf8')); return p && p.version === 1 && p.socket && p.token ? { ...p, file } : null; } catch { return null; } };

// Which app to talk to: the one named, else the one this shell was started by, else the only one running.
function findInstance({ instance, userData, env = process.env, pointerDir = POINTER_DIR } = {}) {
  if (userData) { const p = readPointer(path.join(path.resolve(userData), 'control.json')); if (!p || !alive(p.pid)) throw fail('not_running', `No Barkdown is running on ${userData}.`); return p; }
  if (!instance && env.BARKDOWN_CONTROL) { const p = readPointer(env.BARKDOWN_CONTROL); if (p && alive(p.pid)) return p; }
  let running = [];
  try { running = fs.readdirSync(pointerDir).filter(name => name.endsWith('.json')).map(name => readPointer(path.join(pointerDir, name))).filter(p => p && alive(p.pid)); } catch {}
  if (instance) { const p = running.find(p => String(p.pid) === String(instance)); if (!p) throw fail('not_running', `No running Barkdown has the process id ${instance}.`); return p; }
  if (!running.length) throw fail('not_running', 'Barkdown is not running. Open it, then try again.');
  if (running.length > 1) throw fail('ambiguous', 'More than one Barkdown is running. Name one with --instance <pid>:\n' + running.map(p => `  ${p.pid}  ${p.userData}`).join('\n'));
  return running[0];
}

// One request, one answer. A command that waits for an assistant's reply can take minutes: the timeout is the caller's.
function call(pointer, command, args = {}, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(pointer.socket); let buffer = '', done = false;
    const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); fn(value); };
    const timer = setTimeout(() => finish(reject, fail('timeout', `Barkdown did not answer "${command}" within ${Math.round(timeoutMs / 1000)} s.`)), timeoutMs);
    socket.once('connect', () => socket.write(JSON.stringify({ id: 1, token: pointer.token, command, args }) + '\n'));
    socket.once('error', error => finish(reject, fail('not_running', `Could not reach Barkdown (${error.code || error.message}). Is it still open?`)));
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8'); const index = buffer.indexOf('\n'); if (index < 0) return;
      let message; try { message = JSON.parse(buffer.slice(0, index)); } catch { return finish(reject, fail('bad_answer', 'Barkdown sent an answer that could not be read.')); }
      if (message.ok) finish(resolve, message.result); else finish(reject, fail(message.error?.code || 'failed', message.error?.message || 'The command failed.'));
    });
    socket.once('close', () => finish(reject, fail('not_running', 'Barkdown closed the connection before answering.')));
  });
}

module.exports = { findInstance, call, POINTER_DIR };
