const fs = require('node:fs');
const net = require('node:net');
const { fork } = require('node:child_process');
if (process.argv[2] === '--leaf') {
  setInterval(() => fs.appendFileSync(process.argv[3], 'effect\n'), 50);
} else if (process.argv[2] === '--child') {
  const leaf = fork(__filename, ['--leaf', process.argv[3]], { stdio: 'ignore', windowsHide: true });
  process.send({ pid: process.pid, leaf: leaf.pid }); setInterval(() => {}, 1000);
} else {
  const [pipe, nonce, marker] = process.argv.slice(2);
  const socket = net.connect(pipe, () => {
    socket.write(JSON.stringify({ type: 'hello', nonce }) + '\n');
    const child = fork(__filename, ['--child', marker], { stdio: ['ignore','ignore','ignore','ipc'], windowsHide: true });
    child.once('message', message => socket.write(JSON.stringify({ type: 'tree', root: process.pid, ...message }) + '\n'));
  });
  socket.on('data', () => process.exit(0)); socket.on('error', () => process.exit(2));
}
