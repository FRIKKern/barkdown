// askOnce (tests/lib/process-tree.mjs) returns only after the child it asked, and what that child started,
// have exited; the packaged fence probe uses it, so the build folder is free when the probe returns.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { askOnce, endTree } from './lib/process-tree.mjs';

const ROW = { timeout: 30_000 };
const started = new Set();
afterEach(() => { for (const pid of started) endTree(pid); started.clear(); });

// A stand-in server: starts a process of its own, ignores polite stop signals, and keeps running after it
// answers request 2.
const SERVER = `
const { spawn } = require('child_process');
const inner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
process.stderr.write('inner ' + inner.pid + '\\n');
for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) process.on(signal, () => {});
let pending = '';
process.stdin.on('data', chunk => {
  const lines = (pending + chunk).split('\\n'); pending = lines.pop();
  for (const line of lines) if (line && JSON.parse(line).id === 2 && !process.argv.includes('--silent')) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: {} }) + '\\n');
});
process.stdin.on('end', () => {});
setInterval(() => {}, 1000);
`;
const MESSAGES = [{ id: 1, method: 'initialize', params: {} }, { id: 2, method: 'tools/call', params: {} }];
const answered = out => out.split('\n').some(line => /"id":2\b/.test(line));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function gone(pid, ms = 3000) { const until = Date.now() + ms; while (alive(pid) && Date.now() < until) await new Promise(r => setTimeout(r, 50)); return !alive(pid); }
const innerPid = stderr => Number(/inner (\d+)/.exec(stderr)?.[1]);

test('when askOnce returns, the child it asked and the process that child started have exited', ROW, async () => {
  const { stderr, pid } = await askOnce({ command: process.execPath, args: ['-e', SERVER], env: process.env, messages: MESSAGES, answered, limitMs: 15_000 })
    .catch(error => { started.add(error.pid); throw error; });
  const inner = innerPid(stderr);
  started.add(pid); started.add(inner);
  assert.ok(inner > 0, stderr);
  assert.equal(alive(pid), false, 'the child has exited when askOnce returns');
  assert.equal(await gone(inner), true, 'the process the child started has exited');
});

test('a child that never answers is ended within the limit, and the failure says so', ROW, async () => {
  const error = await askOnce({ command: process.execPath, args: ['-e', SERVER, '--', '--silent'], env: process.env, messages: MESSAGES, answered, limitMs: 1_000 }).then(() => null, e => e);
  assert.ok(error, 'askOnce fails');
  started.add(error.pid);
  assert.match(error.message, /^no answer in 1 s\ninner (\d+)/);
  const inner = innerPid(error.message); started.add(inner);
  assert.equal(alive(error.pid), false, 'the silent child has exited');
  assert.equal(await gone(inner), true, 'the process the silent child started has exited');
});
