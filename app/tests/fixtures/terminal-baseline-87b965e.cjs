// Terminal work tab backend: one shell per tab, driven over pipes (no pseudo-terminal, so fully
// interactive programs such as editors or pagers will not behave; plain commands, build tools and
// scripts do). Output streams to the renderer as it arrives; the shell's working directory is the
// chat's working folder.
const { spawn } = require('child_process');
const os = require('os');

const sessions = new Map();

function shellSpec() {
  // PowerShell's interactive host reads a pipe line by line and echoes the prompt and command itself
  // (`-Command -` would buffer all of stdin until EOF); bash -s echoes nothing, so the tab echoes for it.
  if (process.platform === 'win32') return { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile'], label: 'PowerShell', echoes: true };
  const shell = process.env.SHELL || '/bin/bash';
  return { command: shell, args: ['-s'], label: shell.split('/').pop(), echoes: false };
}

function start({ id, root, send }) {
  stop(id);
  const spec = shellSpec();
  const cwd = root || os.homedir();
  const child = spawn(spec.command, spec.args, { cwd, env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' }, windowsHide: true });
  const session = { id, child, cwd, label: spec.label };
  sessions.set(id, session);
  child.stdout.on('data', chunk => send({ type: 'data', id, data: chunk.toString('utf8') }));
  child.stderr.on('data', chunk => send({ type: 'data', id, data: chunk.toString('utf8'), stream: 'stderr' }));
  child.on('exit', (code, signal) => { sessions.delete(id); send({ type: 'exit', id, code, signal }); });
  child.on('error', error => { sessions.delete(id); send({ type: 'exit', id, error: error.message }); });
  return { id, cwd, shell: spec.label, echoes: spec.echoes };
}

function input(id, line) {
  const session = sessions.get(id);
  if (!session) throw Object.assign(new Error('The terminal is not running. Open it again.'), { code: 'no_terminal' });
  session.child.stdin.write(String(line).replace(/\r?\n$/, '') + os.EOL);
  return true;
}

function stop(id) {
  const session = sessions.get(id);
  if (!session) return false;
  sessions.delete(id);
  try { session.child.kill(); } catch {}
  return true;
}

function stopAll() { for (const id of [...sessions.keys()]) stop(id); }

module.exports = { start, input, stop, stopAll, shellSpec };
