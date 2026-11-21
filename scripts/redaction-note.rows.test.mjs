// Rows for redaction-note.test.mjs, each on its own small Git repository: a base commit, then a change. The note test
// runs there as it runs here, with BASE set to the fixture's base commit; it and its module are copied in untracked.
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

const run1 = 'docs/visual/runs/r1';
test('row 1: a capture-input pin of a code file main edited, unchanged from the base, is green', () => {
  const code = 'export const v = 1;\n', record = json({ inputs: { 'app/tests/capture.mjs': sha(code) } });
  green(run({ 'app/tests/capture.mjs': code, [run1 + '/manifest.json']: record },
    { 'app/tests/capture.mjs': 'export const v = 2;\n', [run1 + '/manifest.json']: json({ redaction: F, inputs: { 'app/tests/capture.mjs': sha(code) } }) }));
});
test('row 2: a docs/ evidence pin that did not follow its repainted file is red', () => {
  const pic = 'picture before', record = json({ shots: [{ file: 'a.png', sha256: sha(pic) }] });
  red(run({ [run1 + '/a.png']: pic, [run1 + '/manifest.json']: record },
    { [run1 + '/a.png']: 'picture boxed', [run1 + '/manifest.json']: json({ redaction: F, shots: [{ file: 'a.png', sha256: sha(pic) }] }) }),
  'matched changed content at the base, not its current bytes');
});
test('row 3: a code-file pin that a record changed to the code file\'s new bytes is red', () => {
  const code = 'export const v = 1;\n', now = 'export const v = 2;\n';
  red(run({ 'app/tests/capture.mjs': code, [run1 + '/manifest.json']: json({ inputs: { 'app/tests/capture.mjs': sha(code) } }) },
    { 'app/tests/capture.mjs': now, [run1 + '/manifest.json']: json({ redaction: F, inputs: { 'app/tests/capture.mjs': sha(now) } }) }),
  'changed, but it did not pin changed content at the base');
});
test('row 4: a differing file outside docs/ that is not a code file is red, by name, and the rule is printed', () => {
  const r = run({ 'app/icon.bin': Buffer.from([1, 0, 2]) }, { 'app/icon.bin': Buffer.from([1, 0, 3]) });
  red(r, 'neither evidence under docs/ nor code (code file = outside docs/ and no NUL byte at the base or now)');
  assert.match(r.out, /app\/icon\.bin/);
  const ok = run({ 'app/notes.txt': 'one\n' }, { 'app/notes.txt': 'two\n' });
  green(ok);
  assert.match(ok.out, /differing files: 0 evidence, 1 code, 0 other \(code file = outside docs\/ and no NUL byte at the base or now\)/);
});
test('row 5 (twin): a pin naming an unchanged docs/ copy whose base bytes a redacted copy shared is green', () => {
  const pic = 'shared picture', boxed = 'shared picture, boxed';
  green(run({ [run1 + '/a.png']: pic, 'docs/visual/runs/r2/a.png': pic, [run1 + '/manifest.json']: json({ shots: [{ file: 'a.png', sha256: sha(pic) }] }),
    'docs/visual/runs/r2/manifest.json': json({ shots: [{ file: 'a.png', sha256: sha(pic) }] }) },
  { [run1 + '/a.png']: boxed, [run1 + '/manifest.json']: json({ redaction: F, shots: [{ file: 'a.png', sha256: sha(boxed) }] }),
    'docs/visual/runs/r2/manifest.json': json({ redaction: F, shots: [{ file: 'a.png', sha256: sha(pic) }] }) },
  [[run1 + '/manifest.json', run1 + '/a.png', 'picture']]));
});
test('row 6: a redaction record added in docs/visual/retention passes only from base bytes to current bytes', () => {
  const pic = 'picture before', boxed = 'picture boxed', base = { [run1 + '/a.png']: pic };
  const retention = from => ({ [run1 + '/a.png']: boxed, ['docs/visual/retention/' + sha(from) + '.json']: json({ redaction: F, version: 1, files: [{ file: run1 + '/a.png', from: { bytes: from.length, sha256: sha(from) }, to: { bytes: boxed.length, sha256: sha(boxed) } }] }) });
  const example = [['docs/visual/retention/' + sha(pic) + '.json', run1 + '/a.png', 'picture']];
  green(run(base, retention(pic), example));
  red(run(base, retention('another picture'), [['docs/visual/retention/' + sha('another picture') + '.json', run1 + '/a.png', 'picture']]),
    'an entry is not an evidence file this change redacted, from its base bytes to its bytes now');
  red(run(base, { [run1 + '/a.png']: boxed, [run1 + '/extra.json']: json({ redaction: F, shots: [{ file: 'a.png', sha256: sha(boxed) }] }) }, [[run1 + '/extra.json', run1 + '/a.png', 'picture']]),
    'a record that carries the field existed at the base, or is a redaction record in docs/visual/retention/');
});
