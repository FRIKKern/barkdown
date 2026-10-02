// The full desktop chain on one exact commit, with a receipt a release can check: `npm run check`
// at the root, then `npm test` in app/, stdin closed so nothing can wait on a terminal. The receipt
// names the commit, the host and the outcome, and is written to .release/chain/<sha>.json, which is
// ignored: local runs are the authority here, and the release carries the receipt with it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=no')) { console.error('The tree has tracked changes; commit them first so the receipt names one commit.'); process.exit(2); }
const sha = git('rev-parse', 'HEAD');
const env = { ...process.env, TMPDIR: fs.realpathSync(os.tmpdir()) + path.sep, BARKDOWN_TEST_BP_SOURCE: process.env.BARKDOWN_TEST_BP_SOURCE || path.resolve(root, '..', 'barkpark-worktrees', 'barkdown-ref') };
const dir = path.join(root, '.release', 'chain'); fs.mkdirSync(dir, { recursive: true });
const receipt = { version: 1, sha, host: `${os.hostname()} ${process.platform} ${os.release()} ${process.arch}`, startedAt: new Date().toISOString(), steps: {} };
const file = path.join(dir, sha + '.json');
// One step: its status and time go into the receipt as soon as it ends; `retry` gives an unattended run (the
// schedule, --retry-once) one more try at the test step, and the receipt keeps the first attempt as `firstTest`.
const run = (name, command, args, cwd, { retry = false } = {}) => {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'] });
  receipt.steps[name] = { status: result.status === 0 ? 'passed' : 'failed', exit: result.status, seconds: Math.round((Date.now() - started) / 1000) };
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
  if (result.status !== 0 && retry) { receipt.steps.firstTest = receipt.steps[name]; console.error(`${name} failed once; trying once more (--retry-once)`); return run(name, command, args, cwd); }
  if (result.status !== 0) { receipt.status = 'failed'; receipt.finishedAt = new Date().toISOString(); fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n'); console.error(`${name} failed; receipt at ${file}`); process.exit(1); }
};
run('check', 'npm', ['run', 'check'], root);
run('test', 'npm', ['test'], path.join(root, 'app'), { retry: process.argv.includes('--retry-once') });
if (git('rev-parse', 'HEAD') !== sha || git('status', '--porcelain', '--untracked-files=no')) { console.error('The commit or the tree changed while the chain ran; no receipt.'); fs.unlinkSync(file); process.exit(1); }
receipt.status = 'passed'; receipt.finishedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Chain passed on ${sha.slice(0, 9)}: receipt ${path.relative(root, file)}`);
