// The provider truth classifier under the isolated runtime: every scenario, the successful edits on a
// Paper. Run through tests/status-shots-isolated.mjs, which supplies BARKDOWN_SHOTS_SERVER and the token.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.BARKDOWN_SHOTS_SERVER || !process.env.BARKPARK_API_TOKEN) throw new Error('Run through tests/status-shots-isolated.mjs');
const out = path.resolve(here, '../../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-provider-truth-paper');
fs.mkdirSync(out, { recursive: true });
const child = spawnSync(process.execPath, ['--test', path.join(here, 'providers-runner.test.mjs')], { cwd: path.dirname(here), encoding: 'utf8', env: process.env });
const summary = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number((new RegExp('^# ' + key + ' (\\d+)', 'm').exec(child.stdout) || [])[1] || 0)]));
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, runtime: process.env.BARKDOWN_SHOTS_BP_RELEASE ? 'packaged release' : 'source checkout', host: `${process.platform} ${os.release()} ${process.arch}`, status: child.status === 0 && summary.fail === 0 && summary.skipped === 0 ? 'passed' : 'failed', summary,
  fixture: 'a Paper on the isolated runtime for every scenario; the scripted transport performs the edit through the app\'s edit service',
  limits: ['One machine, one disposable runtime. The transport is scripted, not a live provider; the live providers are exercised by tests/providers.live.mjs on demand.'] };
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'node-test.log'), child.stdout + child.stderr);
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'passed' ? 0 : 1);
