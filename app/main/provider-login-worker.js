// A login and its status check live inside one owned Windows Job.
// Never send raw CLI output (which may contain account data or OAuth URLs) over IPC.
const net = require('node:net');
const { spawn } = require('node:child_process');
const { resolveProviderCli, commandArgs, statusState } = require('./provider-cli');
const [pipe, nonce] = process.argv.slice(2);
let started = false, buffer = '';
const socket = pipe ? net.connect(pipe, () => send({ type: 'hello', nonce })) : null;
function send(message) { if (socket) socket.write(JSON.stringify(message) + '\n'); else process.send(message); }
function complete(result) { send({ type: 'result', ...result }); }
socket?.setEncoding('utf8');
socket?.on('error', () => process.exit(2));
socket?.on('end', () => process.exit(2));
if (!socket) { process.on('disconnect', () => process.exit(2)); process.on('message', message => handle(message).catch(() => complete({ state: 'failed' }))); send({ type: 'hello' }); }
async function run(file, args, collect = false) {
  return new Promise(resolve => {
    const child = spawn(file, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
    let output = '';
    child.stdout.on('data', bytes => { if (collect && output.length < 65536) output += bytes.toString('utf8'); });
    child.stderr.on('data', bytes => { if (collect && args[0] === 'login' && output.length < 65536) output += bytes.toString('utf8'); });
    child.on('error', () => resolve({ code: -1, output: '' }));
    child.on('close', code => resolve({ code, output }));
  });
}
socket?.on('data', chunk => {
  buffer += chunk;
  if (buffer.length > 4096) return process.exit(2);
  const end = buffer.indexOf('\n');
  if (end < 0) return;
  let message;
  try { message = JSON.parse(buffer.slice(0, end)); } catch { return process.exit(2); }
  buffer = buffer.slice(end + 1);
  handle(message).catch(() => complete({ state: 'failed' }));
});
async function handle(message) {
  if (started || message.type !== 'start' || !['claude', 'codex'].includes(message.provider) || !['login', 'status'].includes(message.operation)) return process.exit(2);
  started = true;
  const { provider, operation } = message;
  const file = resolveProviderCli(provider, { override: typeof message.binary === 'string' ? message.binary : '' });
  if (!file) return complete({ state: 'unavailable' });
  if (operation === 'login') {
    const login = await run(file, commandArgs(provider, 'login'));
    if (login.code !== 0) return complete({ state: 'failed' });
  }
  const status = await run(file, commandArgs(provider, 'status'), true);
  const state = statusState(provider, status.code, status.output);
  complete({ state: operation === 'login' && state === 'signed-out' ? 'failed' : state });
}
