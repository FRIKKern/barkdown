// A real owned child/grandchild tree with the provider bridge protocol; no SDK.
const net = require('node:net');
const path = require('node:path');
const { fork } = require('node:child_process');
const [pipe, nonce] = process.argv.slice(2);
const socket = net.connect(pipe, () => send({ type: 'hello', nonce }));
const send = message => socket.write(JSON.stringify(message) + '\n');
let buffer = '', started = false;
socket.setEncoding('utf8');
socket.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.type !== 'start' || started) continue;
    started = true;
    const params = message.params, marker = path.join(params.storeDir, 'drain-fixture-effects.txt');
    const child = fork(path.join(__dirname, 'goal-process-tree.cjs'), ['--child', marker], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
    });
    child.once('message', tree => send({ type: 'event', event: {
      type: 'text_delta', text: JSON.stringify({ root: process.pid, ...tree }),
      profileId: params.profileId, chatId: params.chatId, provider: params.provider,
    } }));
  }
});
socket.on('error', () => process.exit(2));
