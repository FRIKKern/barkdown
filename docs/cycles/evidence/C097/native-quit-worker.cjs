// Disposable owned worker: no provider, credentials, tools or library access.
const net = require('node:net');
const [pipe, nonce] = process.argv.slice(2);
const socket = net.connect(pipe, () => socket.write(JSON.stringify({type:'hello',nonce})+'\n'));
socket.on('data', () => {});
socket.on('error', () => process.exit(2));
setInterval(() => {}, 1000);
