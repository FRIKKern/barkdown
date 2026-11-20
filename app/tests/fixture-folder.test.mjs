// The live scripts' folders come from tests/lib/fixture-folder.mjs: one fixed root per platform that holds
// nothing of this machine, a marker beside each folder, removal at exit, and a sweep that removes only folders it
// made, directly inside its root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOTS, MARKER, FOLDER_NAME, markerOf, fixtureFolder, rootProblem, sweep } from './lib/fixture-folder.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperUrl = pathToFileURL(path.join(appDir, 'tests/lib/fixture-folder.mjs')).href;
// Values that match none of the scratch paths below, so a scratch root is accepted where a row needs one.
const NEUTRAL = { home: '/nowhere/home', temp: '/nowhere/temp', login: 'zz-none', top: '/nowhere/checkout' };
const scratch = () => fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-folder-test-')));

test('the three roots are exactly these, with no spaces', () => {
  assert.deepEqual(ROOTS, { win32: 'C:\\barkdown-fixture', darwin: '/Users/Shared/barkdown-fixture', linux: '/dev/shm/barkdown-fixture' });
});

test('a root that holds the home folder, temp folder, login name or checkout is refused by name and nothing is made', () => {
  const dir = scratch();
  try {
    const cases = [
      ['home folder', path.join(dir, 'a', 'barkdown-fixture'), { ...NEUTRAL, home: path.join(dir, 'a') }],
      ['temp folder', path.join(dir, 'b', 'barkdown-fixture'), { ...NEUTRAL, temp: path.join(dir, 'b') }],
      ['login name', path.join(dir, 'kari', 'barkdown-fixture'), { ...NEUTRAL, login: 'kari' }],
      ['checkout folder', path.join(dir, 'c', 'barkdown-fixture'), { ...NEUTRAL, top: path.join(dir, 'c') }],
      ['checkout folder', path.join(dir, 'd'), { ...NEUTRAL, top: path.join(dir, 'd', 'repo') }],
    ];
    for (const [kind, root, values] of cases) {
      assert.equal(rootProblem(root, values), kind, root);
      assert.throws(() => fixtureFolder('x-', { root, values }), { message: `Refusing to make a fixture folder: the root ${root} holds this machine's ${kind}.` });
      assert.equal(fs.existsSync(root), false, `${kind}: nothing was made`);
    }
    assert.equal(rootProblem(path.join(dir, 'e', 'barkdown-fixture'), NEUTRAL), null, 'a root clear of every value is accepted');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a root that is a link, is not a folder, or resolves to another path is refused by name and nothing is made', () => {
  const dir = scratch(), home = path.join(dir, 'home'), other = path.join(dir, 'other'), type = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    for (const folder of [home, other]) fs.mkdirSync(folder);
    fs.symlinkSync(home, path.join(dir, 'to-home'), type);
    fs.symlinkSync(other, path.join(dir, 'to-other'), type);
    fs.symlinkSync(home, path.join(dir, 'via'), type);
    fs.writeFileSync(path.join(dir, 'a-file'), '');
    const values = { ...NEUTRAL, home };
    const cases = [['to-home', 'is a link'], ['to-other', 'is a link'], ['a-file', 'is not a folder'], [path.join('via', 'barkdown-fixture'), 'resolves to another path']];
    for (const [name, why] of cases) {
      const root = path.join(dir, name);
      assert.equal(rootProblem(root, values), null, `${name}: the root as written holds nothing of this machine`);
      assert.throws(() => fixtureFolder('x-', { root, values }), { message: `Refusing to make a fixture folder: the root ${root} ${why}. There is no other root.` });
    }
    assert.deepEqual([fs.readdirSync(home), fs.readdirSync(other)], [[], []], 'nothing was made through a link');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('on POSIX a root is made for this user alone, and one owned by another user or writable by others is refused by name', { skip: process.platform === 'win32' && 'Windows reports no owner or mode' }, () => {
  const dir = scratch(), uid = process.getuid();
  try {
    const fresh = path.join(dir, 'fresh', 'barkdown-fixture');
    const folder = fixtureFolder('x-', { root: fresh, values: NEUTRAL });
    assert.deepEqual([fs.statSync(fresh).mode & 0o777, fs.statSync(fresh).uid], [0o700, uid], 'the root is made 0700 and owned by this user');
    fs.rmSync(folder, { recursive: true }); fs.rmSync(markerOf(folder));
    const open = path.join(dir, 'open'); fs.mkdirSync(open); fs.chmodSync(open, 0o777);
    const theirs = path.join(dir, 'theirs'); fs.mkdirSync(theirs, { mode: 0o700 });
    const cases = [[open, uid, 'can be written by others'], [theirs, uid + 1, 'is owned by another user']];
    for (const [root, as, why] of cases) {
      assert.throws(() => fixtureFolder('x-', { root, values: NEUTRAL, uid: as }), { message: `Refusing to make a fixture folder: the root ${root} ${why}. There is no other root.` });
      assert.deepEqual(fs.readdirSync(root), [], 'nothing was made');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Every sweep row works in a root nested inside a folder the row made, and checks that folder too.
const DAY = 24 * 60 * 60 * 1000;
function sweepRoot() {
  const outer = scratch(), root = path.join(outer, 'barkdown-fixture');
  fs.mkdirSync(root);
  const folder = (name, marker) => { fs.mkdirSync(path.join(root, name)); fs.writeFileSync(path.join(root, name, 'keep.txt'), 'kept'); if (marker !== undefined) fs.writeFileSync(markerOf(path.join(root, name)), JSON.stringify(marker)); };
  const run = () => { const lines = [], result = sweep(root, { log: line => lines.push(line) }); return { ...result, lines }; };
  return { outer, root, folder, run, old: name => ({ name, made: Date.now() - 2 * DAY }), done: () => fs.rmSync(outer, { recursive: true, force: true }) };
}

test('the sweep removes old folders it made, with their markers, and names every entry it leaves in one line', () => {
  const t = sweepRoot();
  try {
    t.folder('bd-old-Ab12cd', t.old('bd-old-Ab12cd'));
    t.folder('bd-new-Ab12cd', { name: 'bd-new-Ab12cd', made: Date.now() - 1000 });
    t.folder('bd-unmarked-Ab12cd');
    const past = new Date(Date.now() - 30 * DAY); fs.utimesSync(path.join(t.root, 'bd-unmarked-Ab12cd'), past, past);
    fs.writeFileSync(path.join(t.root, 'loose-file'), 'kept');
    const { removed, left, lines } = t.run();
    assert.deepEqual(removed, ['bd-old-Ab12cd']);
    assert.deepEqual(left, ['bd-new-Ab12cd (new)', 'bd-unmarked-Ab12cd (no marker)', 'loose-file (not a folder)']);
    assert.deepEqual(lines, [`fixture sweep ${t.root}: removed 1; left bd-new-Ab12cd (new), bd-unmarked-Ab12cd (no marker), loose-file (not a folder)`]);
    assert.deepEqual(fs.readdirSync(t.root).sort(), ['bd-new-Ab12cd', `bd-new-Ab12cd${MARKER}`, 'bd-unmarked-Ab12cd', 'loose-file']);
  } finally { t.done(); }
});

test('a marker with no folder of its own is left, whatever its stem, and nothing outside the root is touched', () => {
  const t = sweepRoot();
  try {
    fs.mkdirSync(path.join(t.outer, 'sibling')); fs.writeFileSync(path.join(t.outer, 'sibling', 'keep.txt'), 'kept');
    t.folder('bd-unmarked-Ab12cd');
    const stems = ['', '.', '..', 'bd-gone-Ab12cd'];
    for (const stem of stems) fs.writeFileSync(path.join(t.root, stem + MARKER), JSON.stringify({ made: Date.now() - 2 * DAY }));
    const { removed, left } = t.run();
    assert.deepEqual(removed, []);
    assert.deepEqual(left, [...stems.map(stem => `${stem}${MARKER} (marker with no folder)`), 'bd-unmarked-Ab12cd (no marker)'].sort());
    assert.deepEqual(fs.readdirSync(t.outer).sort(), ['barkdown-fixture', 'sibling']);
    assert.equal(fs.readFileSync(path.join(t.outer, 'sibling', 'keep.txt'), 'utf8'), 'kept');
    assert.equal(fs.readFileSync(path.join(t.root, 'bd-unmarked-Ab12cd', 'keep.txt'), 'utf8'), 'kept');
  } finally { t.done(); }
});

test('a link named like a fixture is left with its target, whether it points out of the root or inside it', () => {
  const t = sweepRoot(), type = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    fs.mkdirSync(path.join(t.outer, 'target')); fs.writeFileSync(path.join(t.outer, 'target', 'keep.txt'), 'kept');
    t.folder('inner_dir');
    fs.symlinkSync(path.join(t.outer, 'target'), path.join(t.root, 'bd-out-Ab12cd'), type);
    fs.symlinkSync(path.join(t.root, 'inner_dir'), path.join(t.root, 'bd-in-Ab12cd'), type);
    for (const name of ['bd-out-Ab12cd', 'bd-in-Ab12cd']) fs.writeFileSync(path.join(t.root, name + MARKER), JSON.stringify(t.old(name)));
    const { removed, left } = t.run();
    assert.deepEqual(removed, []);
    assert.deepEqual(left, ['bd-in-Ab12cd (link)', 'bd-out-Ab12cd (outside the root)', 'inner_dir (not a fixture name)']);
    for (const name of ['bd-out-Ab12cd', 'bd-in-Ab12cd']) assert.ok(fs.lstatSync(path.join(t.root, name)).isSymbolicLink(), `${name}: the link is kept`);
    for (const file of ['target/keep.txt', 'barkdown-fixture/inner_dir/keep.txt']) assert.equal(fs.readFileSync(path.join(t.outer, file), 'utf8'), 'kept', file);
  } finally { t.done(); }
});

test('a file named like a fixture is left', () => {
  const t = sweepRoot();
  try {
    fs.writeFileSync(path.join(t.root, 'bd-file-Ab12cd'), 'kept');
    fs.writeFileSync(markerOf(path.join(t.root, 'bd-file-Ab12cd')), JSON.stringify(t.old('bd-file-Ab12cd')));
    const { removed, left } = t.run();
    assert.deepEqual([removed, left], [[], ['bd-file-Ab12cd (not a folder)']]);
    assert.equal(fs.readFileSync(path.join(t.root, 'bd-file-Ab12cd'), 'utf8'), 'kept');
  } finally { t.done(); }
});

test('an old folder is left when its name is not one fixtureFolder makes, or its marker was not written for it or has no time', () => {
  const t = sweepRoot();
  try {
    for (const name of ['keep-me', 'Bd-upper-Ab12cd', 'bd-short-Ab12c', 'bd_under-Ab12cd']) t.folder(name, t.old(name));
    t.folder('bd-other-Ab12cd', t.old('bd-x-Ab12cd'));
    t.folder('bd-unnamed-Ab12cd', { made: Date.now() - 2 * DAY });
    t.folder('bd-null-Ab12cd', { name: 'bd-null-Ab12cd', made: null });
    t.folder('bd-text-Ab12cd', { name: 'bd-text-Ab12cd', made: '2020-01-01' });
    // A marker that is a link to a well-formed marker elsewhere is not one fixtureFolder wrote (file links need admin on Windows).
    const linked = process.platform !== 'win32';
    if (linked) { t.folder('bd-linked-Ab12cd'); fs.writeFileSync(path.join(t.outer, 'elsewhere'), JSON.stringify(t.old('bd-linked-Ab12cd'))); fs.symlinkSync(path.join(t.outer, 'elsewhere'), markerOf(path.join(t.root, 'bd-linked-Ab12cd'))); }
    const { removed, left } = t.run();
    assert.deepEqual(removed, []);
    assert.deepEqual(left, ['Bd-upper-Ab12cd (not a fixture name)', ...(linked ? ['bd-linked-Ab12cd (no marker)'] : []), 'bd-null-Ab12cd (no marker)', 'bd-other-Ab12cd (no marker)', 'bd-short-Ab12c (not a fixture name)', 'bd-text-Ab12cd (no marker)', 'bd-unnamed-Ab12cd (no marker)', 'bd_under-Ab12cd (not a fixture name)', 'keep-me (not a fixture name)']);
  } finally { t.done(); }
});

test('the root itself is left however old it is, with a marker of its own beside it', () => {
  const t = sweepRoot();
  try {
    fs.writeFileSync(markerOf(t.root), JSON.stringify(t.old('barkdown-fixture')));
    const past = new Date(Date.now() - 30 * DAY); fs.utimesSync(t.root, past, past);
    assert.deepEqual(t.run().removed, []);
    assert.ok(fs.lstatSync(t.root).isDirectory());
    assert.deepEqual(fs.readdirSync(t.outer).sort(), ['barkdown-fixture', `barkdown-fixture${MARKER}`]);
  } finally { t.done(); }
});

test('an entry the sweep cannot remove is left and named, and the sweep does not throw', { skip: process.platform === 'win32' && 'needs POSIX folder modes' }, () => {
  const t = sweepRoot(), held = path.join(t.root, 'bd-held-Ab12cd', 'held');
  try {
    t.folder('bd-held-Ab12cd', t.old('bd-held-Ab12cd'));
    fs.mkdirSync(held); fs.writeFileSync(path.join(held, 'keep.txt'), 'kept'); fs.chmodSync(held, 0o500);
    const { removed, left } = t.run();
    assert.deepEqual([removed, left], [[], ['bd-held-Ab12cd (EACCES)']]);
    assert.ok(fs.existsSync(markerOf(path.join(t.root, 'bd-held-Ab12cd'))), 'its marker stays, so a later sweep tries again');
  } finally { try { fs.chmodSync(held, 0o700); } catch {} t.done(); }
});

test('a folder is made only from a prefix whose names the sweep knows', () => {
  const dir = scratch(), root = path.join(dir, 'barkdown-fixture');
  try {
    for (const prefix of ['', 'x', 'Bad-', 'bd_x-', '../bd-', 'bd/x-', 'bd--', '-bd-']) {
      assert.throws(() => fixtureFolder(prefix, { root, values: NEUTRAL }), { message: `Refusing to make a fixture folder: the prefix ${JSON.stringify(prefix)} is not lowercase letters, digits and dashes ending in '-'.` });
    }
    assert.equal(fs.existsSync(root), false, 'nothing was made');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a script\'s folder holds only what it writes, has a marker beside it, and both are removed when it exits, pass or fail', () => {
  const dir = scratch(), root = path.join(dir, 'barkdown-fixture');
  try {
    for (const code of [0, 1]) {
      const script = `import fs from 'node:fs'; import path from 'node:path'; import { fixtureFolder, markerOf } from ${JSON.stringify(helperUrl)};
const values = ${JSON.stringify(NEUTRAL)}, folder = fixtureFolder('bd-exit-', { root: ${JSON.stringify(root)}, values });
const empty = fs.readdirSync(folder).length === 0; fs.writeFileSync(path.join(folder, 'data.bin'), Buffer.alloc(2e6));
console.log(JSON.stringify({ folder, empty, marked: fs.existsSync(markerOf(folder)) }));
${code ? "throw new Error('planted failure');" : ''}`;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
      assert.equal(run.status, code, run.stderr);
      const { folder, empty, marked } = JSON.parse(run.stdout.trim());
      assert.ok(empty && marked && path.basename(folder).startsWith('bd-exit-') && FOLDER_NAME.test(path.basename(folder)) && path.dirname(folder) === root, folder);
      assert.deepEqual(fs.readdirSync(root), [], `exit ${code}: the folder and its marker are gone`);
      assert.match(run.stderr, /^fixture folder bd-exit-\S+: 2\.0 MB$/m);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Every script in the test chain that takes a screenshot makes its folders through the helper.
// The refusal's own test plants the real temp folder on purpose, so it keeps it.
test('no screenshot script in the test chain makes a folder in the temp or home folder', () => {
  const chain = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).scripts.test;
  const scripts = [...new Set(chain.match(/tests\/[^\s"&|;]+/g))].filter(file => fs.existsSync(path.join(appDir, file)) && file !== 'tests/visual-machine-text.test.mjs');
  const shooting = scripts.filter(file => /\.screenshot\(/.test(fs.readFileSync(path.join(appDir, file), 'utf8')));
  assert.ok(shooting.length >= 20, `found ${shooting.length} screenshot scripts in the chain`);
  assert.deepEqual(shooting.filter(file => /\bos\.(tmpdir|homedir)\(/.test(fs.readFileSync(path.join(appDir, file), 'utf8'))), []);
});
