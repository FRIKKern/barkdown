import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const runner = fileURLToPath(new URL('./parity.mjs', import.meta.url));
function run({ summary = '11/11 green', exit = 0, report, mocked, row = 'tables', raw } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-parity-runner-'));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.copyFileSync(runner, path.join(root, 'tests/parity.mjs'));
  const body = report ?? (summary === null ? {} : { summary });
  fs.writeFileSync(path.join(root, 'tests', row === 'paper' ? 'paper.live.mjs' : row === 'opaque' ? 'editor-opaque.live.mjs' : row === 'gaps' ? 'editor-gaps.live.mjs' : 'editor-tables.live.mjs'), `console.log(${JSON.stringify(raw ?? JSON.stringify(body, null, 1))}); process.exitCode=${exit};`);
  const args = [];
  if (mocked) {
    // Exercise actual runner with a platform-independent signal/spawn-result boundary.
    const shim = path.join(root, 'spawn.cjs');
    fs.writeFileSync(shim, `require('child_process').spawnSync=()=>(${JSON.stringify({ stdout: JSON.stringify(body), stderr: '', ...mocked })});require('module').syncBuiltinESMExports();`);
    args.push('--require', shim);
  }
  const env = { ...process.env }; delete env.PARITY_ROWS; delete env.GITHUB_STEP_SUMMARY; delete env.NODE_OPTIONS;
  const child = spawnSync(process.execPath, [...args, path.join(root, 'tests/parity.mjs'), row], { env, encoding: 'utf8' });
  const result = JSON.parse(fs.readFileSync(path.join(root, 'test-results/parity.json'), 'utf8'));
  return { child, result, root };
}

const cases = [
  ['normal pass', {}, true],
  ['green summary then cleanup exit 1', { exit: 1 }, false],
  ['green summary then signal', { mocked: { status: null, signal: 'SIGTERM' } }, false],
  ['signal overrides even zero status', { mocked: { status: 0, signal: 'SIGTERM' } }, false],
  ['spawn error', { mocked: { status: null, error: { message: 'spawn failed', code: 'ENOENT' } } }, false],
  ['partial', { summary: '1/2 green' }, false],
  ['missing', { summary: null }, false],
  ['zero', { summary: '0/0 green' }, false],
  ['malformed trailing evidence', { summary: '11/11 garbage' }, false],
  ['overcount', { summary: '12/11 green' }, false],
  ['unsafe counts', { summary: '9007199254740993/9007199254740993 green' }, false],
  ['truncated JSON', { raw: '{"summary":"11/11 green"' }, false],
  ['log fragment is not a report', { raw: 'debug "summary":"11/11 green"' }, false],
  ['conflicting reports', { raw: '{"summary":"1/2 green"}\n{"summary":"2/2 green"}' }, false],
  ['duplicate reports ambiguous', { raw: '{"summary":"2/2 green"}\n{"summary":"2/2 green"}' }, false],
  ['gaps observation is not assertion', { row: 'gaps', report: { kindMismatch: null, log: [{ name: 'type', save: 'Saved · rev 2', doc: ['paragraph:hello'] }], errors: [] } }, false],
  ['paper structured checks', { row: 'paper', report: { results: [{ name: 'save', ok: true }] } }, true],
  ['paper failed check', { row: 'paper', report: { results: [{ name: 'save', ok: false }] } }, false],
  ['paper empty checks', { row: 'paper', report: { results: [] } }, false],
  ['paper malformed boolean', { row: 'paper', report: { results: [{ name: 'save', ok: 'true' }] } }, false],
  ['opaque compound pass', { row: 'opaque', summary: '3/3 note block types mount editable; 2/2 edits held by the server; 1/1 slash inserts land on the server; editor bundle from the server', report: { summary: '3/3 note block types mount editable; 2/2 edits held by the server; 1/1 slash inserts land on the server; editor bundle from the server', bundle: { pass: true } } }, true],
  ['opaque partial later group', { row: 'opaque', summary: '3/3 note block types mount editable; 1/2 edits held by the server; 1/1 slash inserts land on the server; editor bundle from the server' }, false],
  ['opaque false bundle', { row: 'opaque', report: { summary: '3/3 note block types mount editable; 2/2 edits held by the server; 1/1 slash inserts land on the server; editor bundle from the server', bundle: { pass: false } } }, false],
  ['opaque generic count omits required groups', { row: 'opaque' }, false],
];
for (const [name, options, green] of cases) test(name, () => {
  const { child, result, root } = run(options);
  assert.equal(child.status, green ? 0 : 1, `${name}: ${child.stdout}\n${child.stderr}\nfixture retained: ${root}`);
  assert.equal(result.rows[0].green, green);
  assert.equal(result.greens, green ? 1 : 0);
  if (options.mocked?.signal) assert.equal(result.rows[0].signal, options.mocked.signal);
  if (options.exit === 1) assert.match(result.rows[0].summary, /exit 1/);
});
