// A real terminal inside the owned worker (C090): a pty from node-pty — a login shell on macOS and
// Linux, PowerShell through ConPTY on Windows — so interactive programs, colours, prompts and resizing
// work the way they do in any terminal. The protocol stays provider-free: the main process sends
// `start`, raw `write`, line `input` (kept for the ownership contract) and `resize`; the worker streams
// `data` and ends with `shell-exit`. The Windows shell and its conhost descend from this worker, so the
// owned Job still contains them.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const [pipe, nonce] = process.argv.slice(2);
let shell, buffer = '';
const send = message => socket.write(JSON.stringify(message) + '\n');
const socket = net.connect(pipe, () => send({ type: 'hello', nonce }));
socket.setEncoding('utf8');
socket.on('error', () => process.exit(2));
socket.on('end', () => { try { shell?.kill(); } catch {} process.exit(2); });
function fail(error) { send({ type: 'failure', error: error.message }); socket.end(() => process.exit(1)); }
// node-pty's prebuilt tarball ships spawn-helper without its execute bit; without it every spawn fails.
function loadPty() {
  const pty = require('node-pty');
  if (process.platform !== 'win32') { try { const helper = path.join(path.dirname(require.resolve('node-pty')), '..', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'); if (fs.existsSync(helper) && !(fs.statSync(helper).mode & 0o111)) fs.chmodSync(helper, 0o755); } catch {} }
  return pty;
}
socket.on('data', chunk => {
  buffer += chunk;
  if (buffer.length > 4 * 1024 * 1024) return fail(Error('Terminal input is too large'));
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    try {
      const message = JSON.parse(line);
      if (message.type === 'start' && !shell) {
        const { command, args, cwd, cols, rows } = message;
        if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw Object.assign(Error(`ENOENT: the working folder does not exist: ${cwd}`), { code: 'ENOENT' });
        const env = { ...require('./shell-environment').providerEnv(), TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Barkdown', LANG: process.env.LANG || 'en_US.UTF-8' };
        delete env.ELECTRON_RUN_AS_NODE; delete env.NO_COLOR;
        // The `barkdown` command reaches the app this shell belongs to (C094).
        if (process.env.BARKDOWN_CONTROL) { env.BARKDOWN_CONTROL = process.env.BARKDOWN_CONTROL; const key = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH'; env[key] = process.env.BARKDOWN_BIN + require('node:path').delimiter + (env[key] || ''); }
        shell = loadPty().spawn(command, args, { name: 'xterm-256color', cols: Math.max(2, cols | 0 || 80), rows: Math.max(1, rows | 0 || 24), cwd, env, useConpty: true });
        shell.onData(data => send({ type: 'data', data }));
        shell.onExit(({ exitCode, signal }) => { send({ type: 'shell-exit', code: exitCode, signal }); socket.end(() => process.exit(0)); });
        send({ type: 'started', pid: shell.pid });
      } else if (message.type === 'write' && shell) shell.write(String(message.data));
      else if (message.type === 'input' && shell) shell.write(String(message.line).replace(/\r?\n$/, '') + '\r');
      else if (message.type === 'resize' && shell) shell.resize(Math.max(2, message.cols | 0), Math.max(1, message.rows | 0));
      else throw Error('Invalid terminal request');
    } catch (error) { fail(error); }
  }
});
