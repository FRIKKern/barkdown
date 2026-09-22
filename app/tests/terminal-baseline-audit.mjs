import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const terminal = require('./fixtures/terminal-baseline-87b965e.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-terminal-baseline-')),
  marker = path.join(root, 'pids.jsonl'),
  shell = path.join(root, 'shell.txt'),
  script = fileURLToPath(new URL('./fixtures/terminal-descendants.cjs', import.meta.url));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
let output = '';
const pids = [];
try {
  terminal.start({
    id: 'baseline',
    root,
    send: (e) => {
      output += e.data || '';
    },
  });
  terminal.input('baseline', `$PID | Set-Content -LiteralPath '${shell}'`);
  terminal.input('baseline', `& '${process.execPath}' '${script}' '${marker}'`);
  for (
    let i = 0;
    i < 100 && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim().split('\n').length < 3);
    i++
  )
    await delay(100);
  if (!fs.existsSync(marker)) throw Error(output);
  pids.push(
    ...fs
      .readFileSync(marker, 'utf8')
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s).pid),
  );
  const shellPid = Number(fs.readFileSync(shell, 'utf8').replace(/^\uFEFF/, ''));
  if (Number.isInteger(shellPid) && shellPid > 0) pids.push(shellPid);
  terminal.stop('baseline');
  await delay(400);
  const result = { root, pids, survivingAfterStop: pids.filter(alive), output };
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  terminal.stopAll();
  for (const pid of pids) if (alive(pid)) process.kill(pid);
  await delay(300);
  console.log(JSON.stringify({ cleanupStopped: pids.every((p) => !alive(p)) }));
}
