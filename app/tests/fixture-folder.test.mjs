// The live scripts' folders come from tests/lib/fixture-folder.mjs: one fixed root per platform that holds
// nothing of this machine, a marker in each folder, removal at exit, and a sweep that touches marked folders only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOTS, MARKER, fixtureFolder, rootProblem, sweep } from './lib/fixture-folder.mjs';

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

test('the sweep removes only marked folders older than a day; an unmarked folder survives whatever its age', () => {
  const root = scratch(), now = Date.now(), day = 24 * 60 * 60 * 1000;
  try {
    const make = (name, marker) => { fs.mkdirSync(path.join(root, name)); if (marker !== undefined) fs.writeFileSync(path.join(root, name, MARKER), marker); };
    make('old-marked-', JSON.stringify({ made: now - 2 * day }));
    make('new-marked-', JSON.stringify({ made: now - 1000 }));
    make('old-unmarked-');
    make('bad-marker-', 'not json');
    const past = new Date(now - 30 * day); fs.utimesSync(path.join(root, 'old-unmarked-'), past, past);
    fs.writeFileSync(path.join(root, 'loose-file'), 'kept');
    assert.deepEqual(sweep(root, { now }), ['old-marked-']);
    assert.deepEqual(fs.readdirSync(root).sort(), ['bad-marker-', 'loose-file', 'new-marked-', 'old-unmarked-']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a script\'s folders carry the marker and are removed when it exits, pass or fail', () => {
  const dir = scratch(), root = path.join(dir, 'barkdown-fixture');
  try {
    for (const code of [0, 1]) {
      const script = `import fs from 'node:fs'; import path from 'node:path'; import { fixtureFolder, MARKER } from ${JSON.stringify(helperUrl)};
const values = ${JSON.stringify(NEUTRAL)}, folder = fixtureFolder('bd-exit-', { root: ${JSON.stringify(root)}, values });
fs.writeFileSync(path.join(folder, 'data.bin'), Buffer.alloc(2e6)); console.log(JSON.stringify({ folder, marked: fs.existsSync(path.join(folder, MARKER)) }));
${code ? "throw new Error('planted failure');" : ''}`;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
      assert.equal(run.status, code, run.stderr);
      const { folder, marked } = JSON.parse(run.stdout.trim());
      assert.ok(marked && path.basename(folder).startsWith('bd-exit-') && path.dirname(folder) === root, folder);
      assert.equal(fs.existsSync(folder), false, `exit ${code}: the folder is gone`);
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
