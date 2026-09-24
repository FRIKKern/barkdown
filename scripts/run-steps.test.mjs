import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepare, runSteps } from './run-steps.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-steps-'));
fs.mkdirSync(path.join(root, 'app'));
const step = (name, code, cwd = '.') => ({ name, cwd, argv: ['node', '-e', code] });
const plan = (...steps) => ({ version: 1, steps });

// No shell expansion, preserve whitespace/metacharacters and use the requested cwd.
const literal = 'spaces ; $() `ticks` & "quotes"';
const success = runSteps(plan({ name: 'cwd-and-argv', cwd: 'app', argv: ['node', '-e',
  'console.log(process.cwd()); console.log(process.argv[1])', literal] }), path.join(root, 'success'), root);
assert.equal(success.status, 'passed');
const log = fs.readFileSync(path.join(root, 'success/cwd-and-argv.log'), 'utf8');
assert.ok(log.includes(path.join(root, 'app')));
assert.ok(log.includes(literal));
assert.equal(typeof success.steps[0].elapsedMs, 'number');

const failed = runSteps(plan(step('fail', 'console.error("intentional failure"); process.exit(7)'),
  step('must-not-run', 'require("fs").writeFileSync("unexpected", "bad")')), path.join(root, 'failed'), root);
assert.equal(failed.status, 'failed');
assert.equal(failed.steps[0].exitCode, 7);
assert.equal(failed.steps[1].status, 'not-run');
assert.equal(fs.existsSync(path.join(root, 'unexpected')), false);
assert.match(fs.readFileSync(path.join(root, 'failed/fail.log'), 'utf8'), /intentional failure/);
assert.throws(() => runSteps(plan(step('again', '')), path.join(root, 'failed'), root), /EEXIST/);

// Invalid later steps are rejected before an earlier command can mutate anything.
const output = path.join(root, 'invalid');
assert.throws(() => runSteps(plan(step('first', ''), step('missing', '', 'absent')), output, root), /ENOENT/);
assert.equal(fs.existsSync(output), false);
assert.throws(() => prepare(plan(step('escape', '', '..')), root), /inside the repository/);
assert.throws(() => prepare(plan(step('same', ''), step('same', '')), root), /duplicate/);
assert.throws(() => prepare(plan({ name: 'bad', argv: ['node', '-v'] }), root), /explicit cwd/);
assert.throws(() => prepare(plan({ name: 'shell', cwd: '.', argv: ['sh', '-c', 'echo bad'] }), root), /Supported commands/);

const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-steps-outside-'));
fs.symlinkSync(outside, path.join(root, 'escaped-link'), process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => prepare(plan(step('symlink', '', 'escaped-link')), root), /inside the repository/);
// The exported default resolves from the module, not the caller's working directory.
const caller = process.cwd();
try {
  process.chdir(root);
  assert.equal(path.basename(prepare(plan(step('default-root', '', 'app')))[0].cwd), 'app');
  assert.notEqual(prepare(plan(step('default-root', '')))[0].cwd, root);
} finally { process.chdir(caller); }

console.log('Checked steps: cwd, literal arguments, fail-fast, retained diagnostics, no overwrite and full preflight passed.');
