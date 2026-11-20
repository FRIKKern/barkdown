// Ending a child together with everything it started, and asking a stdio JSON-RPC child one question.
// On POSIX the child leads its own process group (spawn with detached: true) and the group is killed; on
// Windows the tree is ended while the parent lives (taskkill /T). A running child also keeps its
// executable's folder in use on Windows, so askOnce returns only after the child has exited.
import { spawn, spawnSync } from 'node:child_process';

export function endTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} } }
}

export const EXIT_LIMIT_MS = 10_000;

// Starts command, writes each message as a JSON-RPC line, and once `answered(stdout)` holds, ends the child's
// tree and waits for the child to exit. Resolves with { stderr, pid, code, signal }; rejects by name when no
// answer comes within limitMs or the child does not exit within EXIT_LIMIT_MS of being ended. Every error
// carries the child's pid, so a caller can end what is left.
export function askOnce({ command, args = [], env, messages, answered, limitMs = 60_000 }) {
  return new Promise((resolve, settleError) => {
    const reject = error => { error.pid = child.pid; settleError(error); };
    const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let out = '', err = '', outcome = null, exitTimer = null;
    const end = result => {
      if (outcome) return;
      outcome = result; clearTimeout(answerTimer);
      child.stdin.end(); endTree(child.pid);
      exitTimer = setTimeout(() => reject(new Error(`the child (pid ${child.pid}) did not exit within ${EXIT_LIMIT_MS / 1000} s of being ended`)), EXIT_LIMIT_MS);
    };
    const answerTimer = setTimeout(() => end(new Error(`no answer in ${limitMs / 1000} s\n${err}`)), limitMs);
    child.stderr.on('data', chunk => { err += chunk; });
    child.stdout.on('data', chunk => { out += chunk; if (answered(out)) end('answered'); });
    child.stdin.on('error', () => {}); // the child may close its input first
    child.on('error', error => { clearTimeout(answerTimer); reject(error); });
    child.on('exit', (code, signal) => {
      clearTimeout(exitTimer); clearTimeout(answerTimer);
      if (outcome instanceof Error) reject(outcome);
      else if (outcome) resolve({ stderr: err, pid: child.pid, code, signal });
      else reject(new Error(`the child exited (${signal || code}) before answering\n${err}`));
    });
    for (const message of messages) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  });
}
