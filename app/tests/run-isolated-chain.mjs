// Run several live tours against one disposable runtime: the isolated harness starts the
// runtime once and hands this runner its environment. Usage:
//   node tests/status-shots-isolated.mjs tests/run-isolated-chain.mjs tests/a.live.mjs tests/b.live.mjs
// Tours that own the dataset (the migration comparison, selection, switch and sealed-comparison
// rehearsals, and anything publishing a fixed slug) need a fresh runtime each: run those through
// the harness one at a time. Every tour runs to its end; the summary names each verdict and the runner exits non-zero
// if any tour failed. Output of failed tours is kept under test-results/isolated-chain/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1') throw new Error('Run through tests/status-shots-isolated.mjs');
const tours = process.argv.slice(2);
if (!tours.length) throw new Error('Name at least one tour');
const out = path.resolve('test-results/isolated-chain', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const verdicts = [];
for (const tour of tours) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [tour], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env, timeout: 15 * 60 * 1000 });
  const seconds = Math.round((Date.now() - started) / 1000), ok = result.status === 0;
  const skipped = /^SKIP /m.test(result.stdout || '');
  verdicts.push({ tour, ok, seconds, skipped });
  if (!ok) fs.writeFileSync(path.join(out, path.basename(tour, '.mjs') + '.log'), (result.stdout || '') + '\n--- stderr ---\n' + (result.stderr || ''));
  console.log(`${ok ? (skipped ? 'skip' : 'ok  ') : 'FAIL'} ${String(seconds).padStart(4)}s ${tour}`);
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ host: process.platform, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, verdicts }, null, 2) + '\n');
const failed = verdicts.filter(v => !v.ok);
console.log(`${verdicts.length - failed.length}/${verdicts.length} tours passed; details in ${out}`);
process.exit(failed.length ? 1 : 0);
