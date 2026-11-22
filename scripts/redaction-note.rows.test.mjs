// Rows for redaction-note.test.mjs, each on its own small Git repository: a base commit, then a change. The note test
// runs there as it runs here, with BASE set to the fixture's base commit; it and its module are copied in untracked.
// The rows hold the twin case: a pin that names an unchanged file whose base bytes a changed file shared.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { REDACTION_NOTE } from './redaction-note.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const NOTE = path.join(here, 'redaction-note.test.mjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const F = [REDACTION_NOTE.file];
const json = value => JSON.stringify(value, null, 2) + '\n';

// files: { path: content } at the base; change: { path: content | null } after it. Returns the note test's result.
function run(files, change, examples = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-note-rows-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  const write = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  git('init', '-q');
  for (const [name, value] of Object.entries(files)) write(name, value);
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  for (const [name, value] of Object.entries(change)) value === null ? fs.rmSync(path.join(root, name)) : write(name, value);
  git('add', '-A'); git('commit', '-q', '-m', 'change');
  const script = fs.readFileSync(NOTE, 'utf8');
  const BASE_LINE = /^const BASE = '[0-9a-f]{40}';$/m;
  assert.equal(script.match(new RegExp(BASE_LINE, 'gm'))?.length, 1, 'the note test has one BASE line');
  write('scripts/redaction-note.test.mjs', script.replace(BASE_LINE, `const BASE = '${base}';`));
  fs.copyFileSync(path.join(path.dirname(NOTE), 'redaction-note.mjs'), path.join(root, 'scripts/redaction-note.mjs'));
  write('scripts/redaction-note.examples.json', JSON.stringify({ kinds: examples }));
  const result = spawnSync(process.execPath, ['scripts/redaction-note.test.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  return { ok: result.status === 0, out: result.stdout + result.stderr };
}
const green = r => assert.ok(r.ok, r.out);
const red = (r, why) => { assert.ok(!r.ok, 'expected red: ' + why); assert.match(r.out, new RegExp(why.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))); };

// Y (run r1) is the changed copy; X (run r2) is the file the record's pin names.
const Y = 'docs/visual/runs/r1/a.png', X = 'docs/visual/runs/r2/a.png', REC = 'docs/visual/runs/r2/manifest.json';
const pinX = (value, field) => json({ ...(field ? { redaction: F } : {}), shots: [{ file: 'a.png', sha256: value }] });
test('twin: a pin naming an unchanged file, at its bytes, which a changed file shared at the base, is green', () => {
  green(run({ [Y]: 'shared', [X]: 'shared', [REC]: pinX(sha('shared')) }, { [Y]: 'shared, boxed', [REC]: pinX(sha('shared'), true) }));
});
test('twin guard: the named file changed too, so the pin no longer holds its bytes: red', () => {
  red(run({ [Y]: 'shared', [X]: 'shared', [REC]: pinX(sha('shared')) }, { [Y]: 'shared, boxed', [X]: 'shared, boxed too', [REC]: pinX(sha('shared'), true) }),
    'matched changed content at the base, not its current bytes');
});
test('twin guard: the pin is not the named file\'s bytes (it held the changed file\'s): red', () => {
  red(run({ [Y]: 'changed one', [X]: 'other bytes', [REC]: pinX(sha('changed one')) }, { [Y]: 'changed one, boxed', [REC]: pinX(sha('changed one'), true) }),
    'matched changed content at the base, not its current bytes');
});
test('twin guard: a pin that followed the changed content is judged as following it, not as a twin: green', () => {
  // Y changed to X's bytes; the pin held Y's base bytes and now holds its current bytes.
  green(run({ [Y]: 'before', [X]: 'after', [REC]: pinX(sha('before')) }, { [Y]: 'after', [REC]: pinX(sha('after'), true) }, [[REC, Y, 'picture']]));
});
