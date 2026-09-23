// A pipe shell inside the native owned Job. This protocol has no provider/run semantics.
const net = require('node:net'),
  { spawn } = require('node:child_process'),
  os = require('node:os');
const [pipe, nonce] = process.argv.slice(2);
let shell,
  buffer = '';
const send = (message) => socket.write(JSON.stringify(message) + '\n');
const socket = net.connect(pipe, () => send({ type: 'hello', nonce }));
socket.setEncoding('utf8');
socket.on('error', () => process.exit(2));
socket.on('end', () => process.exit(2));
function fail(error) {
  send({ type: 'failure', error: error.message });
  socket.end(() => process.exit(1));
}
socket.on('data', (chunk) => {
  buffer += chunk;
  if (buffer.length > 1024 * 1024) return fail(Error('Terminal input is too large'));
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    try {
      const message = JSON.parse(line);
      if (message.type === 'start' && !shell) {
        const { command, args, cwd } = message;
        shell = spawn(command, args, {
          cwd,
          env: { ...process.env, TERM: 'dumb', NO_COLOR: '1', ELECTRON_RUN_AS_NODE: undefined },
          windowsHide: true,
        });
        shell.stdout.on('data', (b) => send({ type: 'data', data: b.toString('utf8') }));
        shell.stderr.on('data', (b) => send({ type: 'data', data: b.toString('utf8'), stream: 'stderr' }));
        shell.stdin.on('error', fail);
        shell.on('error', fail);
        shell.on('spawn', () => send({ type: 'started', pid: shell.pid }));
        shell.on('close', (code) => {
          send({ type: 'shell-exit', code });
          socket.end(() => process.exit(0));
        });
      } else if (message.type === 'input' && shell) {
        shell.stdin.write(String(message.line).replace(/\r?\n$/, '') + os.EOL);
      } else throw Error('Invalid terminal request');
    } catch (error) {
      fail(error);
    }
  }
});
