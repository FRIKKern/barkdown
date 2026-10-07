// Exercise the existing bounded-retry scenario through deliberately slow SDK
// responses. The temporary test remains beside its real relative imports.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const output = path.resolve(process.argv[2]); fs.mkdirSync(output);
const original = fs.readFileSync(path.join(repo, 'app/tests/goal-coordinator.test.mjs'), 'utf8');
const needle = 'const text = await respond(prompt, calls, handlers);';
if (!original.includes(needle)) throw Error('Expected controlled SDK fixture seam');
const delayed = original.replace(needle, 'await new Promise(resolve => setTimeout(resolve, 2500)); ' + needle);
const fixture = path.join(repo, 'app/tests/.c097-slow-' + crypto.randomUUID() + '.test.mjs');
fs.writeFileSync(fixture, delayed, { flag: 'wx' });
const startedAt = new Date().toISOString(), started = performance.now();
try {
  const run = spawnSync(process.execPath, ['--test', '--test-name-pattern=coordinator retry is bounded', fixture], { cwd: repo, encoding: 'utf8', timeout: 150000, windowsHide: true });
  fs.writeFileSync(path.join(output, 'tests.log'), (run.stdout || '') + (run.stderr || ''));
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repo, encoding: 'utf8'}).trim(), startedAt, elapsedMs: Math.round(performance.now() - started), status: run.status === 0 ? 'passed' : 'failed', exitCode: run.status, error: run.error?.message || null, perResponseDelayMs: 2500, originalSha256: crypto.createHash('sha256').update(original).digest('hex'), transformedSha256: crypto.createHash('sha256').update(delayed).digest('hex') }, null, 2) + '\n');
  console.log({status: run.status, output}); process.exitCode = run.status === 0 ? 0 : 1;
} finally {
  fs.renameSync(fixture, path.join(output, 'executed-fixture.mjs'));
}
