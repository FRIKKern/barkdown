const { externalResource } = require('./external-resource');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { MAX_MESSAGE_CHARS } = require('./goal-protocol');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const check = (value, message) => { if (!value) throw new Error(message); };
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const WINDOWS = process.platform === 'win32';
// Containment differs per host; the identity (nonce, jobName) is the same string on every platform
// so receipts, preflight and adoption read one shape.
const CONTAINMENT = WINDOWS ? 'job-list-v1' : 'process-group-v1';
// POSIX: the worker is spawned detached, so it leads a new session and process group whose id is
// its pid; every descendant inherits the group unless it deliberately leaves it.
const groupMembers = pgid => { try { return execFileSync('ps', ['-A', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n').map(l => l.trim().split(/\s+/)).filter(([pid, g]) => Number(g) === pgid && Number(pid) > 0).map(([pid]) => Number(pid)); } catch { return []; } };
const startedAt = pid => { try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const killGroup = (pgid, signal) => { try { process.kill(-pgid, signal); } catch {} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const powershell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const helper = externalResource('goal-worker-host.ps1');
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
  check(launch.version === 1 && receipt.version === 1 && receipt.containment === CONTAINMENT && launch.profileId === options.profileId && launch.attemptId === options.attemptId && UUID.test(launch.nonce), 'Invalid process launch owner');
  check(['profileId', 'attemptId', 'nonce', 'jobName'].every(k => receipt[k] === launch[k]) && receipt.jobName === `Local\\BarkdownGoal-${launch.nonce}`, 'Process receipt owner mismatch');
  check(Number.isInteger(receipt.helperPid) && receipt.helperPid > 0 && (WINDOWS ? /^\d+$/.test(receipt.helperStarted) : typeof receipt.helperStarted === 'string') && ['prepared', 'assigned', 'stopped'].includes(receipt.phase), 'Invalid process lifecycle receipt');
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
function saveReceipt(file, receipt) { fs.writeFileSync(file, JSON.stringify(receipt)); }
async function sweep(pgid) {
  for (let i = 0; i < 40 && groupMembers(pgid).length; i++) { killGroup(pgid, i < 10 ? 'SIGTERM' : 'SIGKILL'); await sleep(100); }
  return groupMembers(pgid).length;
}
// POSIX verification proves the group is empty. A process group does not die with its owner the way
// a job object does, so when the recorded host is gone the restart path is what terminates whatever
// the group still holds, and it answers true only at zero. Under a live host it only observes.
async function verifyGroup(receipt) {
  const pgid = receipt.helperPid;
  console.error(`[owned] verify group ${pgid} phase=${receipt.phase} active=${receipt.activeProcesses} host=${receipt.hostPid}`);
  if (receipt.phase === 'stopped' && receipt.activeProcesses === 0) return true;
  const hostAlive = receipt.hostPid && startedAt(receipt.hostPid) === receipt.hostStarted;
  if (hostAlive) return groupMembers(pgid).length === 0;
  return (await sweep(pgid)) === 0;
}
async function verifyOwnedWorker(options) {
  const receipt = readOwned(options); if (!receipt) return false;
  if (!WINDOWS) return verifyGroup(receipt);
  // The helper writes stopped only after querying the entire assigned job at zero.
  if (receipt.phase === 'stopped' && receipt.activeProcesses === 0) return true;
  return runVerifier(receipt);
}
// Windows CRT command-line quoting; never a shell command and no string evaluation.
const quote = value => '"' + String(value).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
async function launchOwnedWorker(options) {
  const dispatch = { started: false };
  try { return await launchOwnedWorkerInternal(options, dispatch); }
  catch (error) {
    // Only the code before the native helper spawn can positively establish
    // that no process was dispatched. A timeout or missing receipt cannot.
    if (!dispatch.started) error.ownedProcessNotDispatched = true;
    throw error;
  }
}
async function launchOwnedWorkerInternal({ storeDir, profileId, attemptId, script, args = [], onMessage = () => {} }, dispatch) {
  // The worker inherits the user's login-shell PATH, so the tools it runs are found (C088 S1).
  const workerEnv = await require('./shell-environment').providerEnvReady();
  const options = { storeDir, profileId, attemptId }, names = files(options), nonce = crypto.randomUUID();
  const launch = { version: 1, profileId, attemptId, nonce, jobName: `Local\\BarkdownGoal-${nonce}` };
  const fd = fs.openSync(names.launch, 'wx'); try { fs.writeFileSync(fd, JSON.stringify(launch)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const pipe = WINDOWS ? `\\\\.\\pipe\\barkdown-goal-${nonce}` : path.join(os.tmpdir(), `barkdown-goal-${nonce.slice(0, 8)}.sock`);
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
  function stop() {
    if (closing) return; closing = true;
    if (WINDOWS) { helperProcess?.stdin.end('stop\n'); return; }
    // The whole group, leader included: TERM first, KILL for whatever ignores it.
    const pgid = helperProcess?.pid; if (!pgid) return;
    killGroup(pgid, 'SIGTERM'); setTimeout(() => killGroup(pgid, 'SIGKILL'), 1000).unref();
  }
  function send(message) { check(bound && socket && !socket.destroyed, 'Worker connection is unavailable'); const data=JSON.stringify(message); check(data.length<=MAX_MESSAGE_CHARS,'Worker request exceeds the512MiB protocol limit'); socket.write(data + '\n'); }
  const commandLine = [process.execPath, script, pipe, nonce, ...args].map(quote).join(' ');
  dispatch.started = true;
  if (WINDOWS) {
    helperProcess = spawn(powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...workerEnv, ELECTRON_RUN_AS_NODE: '1' },
    });
  } else {
    // No helper: the worker itself leads the group. detached gives it a new session, so the group
    // id is its pid and the whole tree can be signalled and counted by that one number.
    helperProcess = spawn(process.execPath, [script, pipe, nonce, ...args], {
      detached: true, cwd: storeDir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...workerEnv, ELECTRON_RUN_AS_NODE: '1' },
    });
    const identity = { version: 1, containment: CONTAINMENT, nonce, profileId, attemptId, jobName: launch.jobName, helperPid: helperProcess.pid, helperStarted: startedAt(helperProcess.pid), hostPid: process.pid, hostStarted: startedAt(process.pid) };
    saveReceipt(names.receipt, { ...identity, phase: 'assigned', childPid: helperProcess.pid, activeProcesses: 1 });
  }
  let diagnostics = ''; helperProcess.stderr.on('data', b => { diagnostics = (diagnostics + b).slice(-4000); });
  helperProcess.stdout.resume(); helperProcess.stdin.on('error', () => {});
  if (WINDOWS) helperProcess.stdin.write(JSON.stringify({ ...launch, exe: process.execPath, commandLine, cwd: storeDir, receipt: names.receipt }) + '\n');
  const finished = new Promise((resolve, reject) => {
    helperProcess.once('error', reject);
    helperProcess.once('close', async (code, signal) => {
      socket?.destroy(); server.close(); rejectReady(new Error('Owned worker ended before handshake'));
      if (!WINDOWS) {
        // The leader is gone; whatever it left in the group is ours to stop before anyone is told.
        // Like the Windows helper, a leader that exited or was stopped by us records the settled
        // receipt at zero; a leader killed from outside leaves 'assigned' for the restart verifier.
        const remaining = await sweep(helperProcess.pid);
        if (remaining === 0 && (closing || signal === null)) { try { saveReceipt(names.receipt, { ...readOwned(options), phase: 'stopped', activeProcesses: 0 }); } catch {} }
      }
      try { check(await verifyOwnedWorker(options), `Owned worker shutdown remains unverified (${code}): ${diagnostics}`); resolve({ driverFinished: true, code, receipt: readOwned(options), protocolError }); }
      catch (error) { reject(error); }
    });
  }); finished.catch(() => {});
  return { ready, finished, send, stop, helperPid: helperProcess.pid, receiptPath: names.receipt, launchPath: names.launch };
}
module.exports = { launchOwnedWorker, verifyOwnedWorker };
