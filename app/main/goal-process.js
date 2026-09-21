const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { MAX_MESSAGE_CHARS } = require('./goal-protocol');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const check = (value, message) => { if (!value) throw new Error(message); };
const powershell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const helper = path.join(__dirname, 'goal-worker-host.ps1');
function files({ storeDir, profileId, attemptId }) {
  check(UUID.test(profileId) && UUID.test(attemptId), 'Invalid owned worker identity');
  const root = path.join(fs.realpathSync(storeDir), 'goal-processes'); fs.mkdirSync(root, { recursive: true });
  check(fs.realpathSync(root).toLowerCase() === root.toLowerCase(), 'Owned process directory escaped its profile');
  return { launch: path.join(root, `${attemptId}.launch.json`), receipt: path.join(root, `${attemptId}.receipt.json`) };
}
function readOwned(options) {
  const names = files(options);
  if (!fs.existsSync(names.launch) || !fs.existsSync(names.receipt)) return null;
  const launch = JSON.parse(fs.readFileSync(names.launch, 'utf8')), receipt = JSON.parse(fs.readFileSync(names.receipt, 'utf8'));
  check(launch.version === 1 && receipt.version === 1 && receipt.containment === 'job-list-v1' && launch.profileId === options.profileId && launch.attemptId === options.attemptId && UUID.test(launch.nonce), 'Invalid process launch owner');
  check(['profileId', 'attemptId', 'nonce', 'jobName'].every(k => receipt[k] === launch[k]) && receipt.jobName === `Local\\BarkdownGoal-${launch.nonce}`, 'Process receipt owner mismatch');
  check(Number.isInteger(receipt.helperPid) && receipt.helperPid > 0 && /^\d+$/.test(receipt.helperStarted) && ['prepared', 'assigned', 'stopped'].includes(receipt.phase), 'Invalid process lifecycle receipt');
  return receipt;
}
function runVerifier(receipt) {
  return new Promise((resolve, reject) => {
    const child = spawn(powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Verify'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', error = ''; child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { error += b; });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out.trim() === 'true') : reject(new Error(`Owned job verification failed: ${error.slice(-1000)}`)));
    child.stdin.end(JSON.stringify(receipt) + '\n');
  });
}
async function verifyOwnedWorker(options) {
  check(process.platform === 'win32', 'Owned goal process verification requires Windows');
  const receipt = readOwned(options); if (!receipt) return false;
  // The helper writes stopped only after querying the entire assigned job at zero.
  if (receipt.phase === 'stopped' && receipt.activeProcesses === 0) return true;
  return runVerifier(receipt);
}
// Windows CRT command-line quoting; never a shell command and no string evaluation.
const quote = value => '"' + String(value).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
async function launchOwnedWorker({ storeDir, profileId, attemptId, script, args = [], onMessage = () => {} }) {
  check(process.platform === 'win32', 'Owned goal worker host requires Windows');
  const options = { storeDir, profileId, attemptId }, names = files(options), nonce = crypto.randomUUID();
  const launch = { version: 1, profileId, attemptId, nonce, jobName: `Local\\BarkdownGoal-${nonce}` };
  const fd = fs.openSync(names.launch, 'wx'); try { fs.writeFileSync(fd, JSON.stringify(launch)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const pipe = `\\\\.\\pipe\\barkdown-goal-${nonce}`;
  let socket, bound = false, resolveReady, rejectReady, helperProcess, closing = false, protocolError = null;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; }); ready.catch(() => {});
  const server = net.createServer(connection => {
    if (socket) { connection.destroy(); return; }
    socket = connection; let buffer = '';
    connection.setEncoding('utf8'); connection.on('error', () => {});
    connection.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > MAX_MESSAGE_CHARS) { protocolError = new Error('Worker message exceeds the512MiB protocol limit'); connection.destroy(); stop(); return; }
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const message = JSON.parse(line);
          if (!bound) { check(message.type === 'hello' && message.nonce === nonce, 'Worker handshake mismatch'); bound = true; resolveReady(); }
          else onMessage(message);
        } catch (error) { protocolError ||= error; rejectReady(error); stop(); }
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
  function stop() { if (!closing) { closing = true; helperProcess?.stdin.end('stop\n'); } }
  function send(message) { check(bound && socket && !socket.destroyed, 'Worker connection is unavailable'); const data=JSON.stringify(message); check(data.length<=MAX_MESSAGE_CHARS,'Worker request exceeds the512MiB protocol limit'); socket.write(data + '\n'); }
  const commandLine = [process.execPath, script, pipe, nonce, ...args].map(quote).join(' ');
  helperProcess = spawn(powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  let diagnostics = ''; helperProcess.stderr.on('data', b => { diagnostics = (diagnostics + b).slice(-4000); });
  helperProcess.stdout.resume(); helperProcess.stdin.on('error', () => {});
  helperProcess.stdin.write(JSON.stringify({ ...launch, exe: process.execPath, commandLine, cwd: storeDir, receipt: names.receipt }) + '\n');
  const finished = new Promise((resolve, reject) => {
    helperProcess.once('error', reject);
    helperProcess.once('close', async code => {
      socket?.destroy(); server.close(); rejectReady(new Error('Owned worker ended before handshake'));
      try { check(await verifyOwnedWorker(options), `Owned worker shutdown remains unverified (${code}): ${diagnostics}`); resolve({ driverFinished: true, code, receipt: readOwned(options), protocolError }); }
      catch (error) { reject(error); }
    });
  }); finished.catch(() => {});
  return { ready, finished, send, stop, helperPid: helperProcess.pid, receiptPath: names.receipt, launchPath: names.launch };
}
module.exports = { launchOwnedWorker, verifyOwnedWorker };
