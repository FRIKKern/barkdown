// Every app a script launches goes through tests/lib/playwright.mjs, which refuses a profile Settings would show
// as a machine path and answers the tool lookup with fixture tools. The first row proves what the launch does;
// the second walks every script that takes a picture of Settings, by syntax (TypeScript's parser, the root's
// devDependency), and proves each launches through it with a profile from fixtureFolder().
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, profileProblem, LAUNCH, REAL_TOOLS } from './lib/playwright.mjs';
import { ROOTS } from './lib/fixture-folder.mjs';
import { FIXTURE, stubTools } from './visual-fixtures.mjs';
import { ts, parseScript, profileValues, profileSources } from './lib/profile-trace.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');

test('a launch without a fixture profile is refused before the app starts, and a launched app gets the fixture tools', async () => {
  const root = ROOTS[process.platform] ?? ROOTS.linux, inRoot = path.join(root, 'bd-launch-profile-abc123');
  const said = args => profileProblem(args);
  assert.match(said([appDir]), /no --user-data profile/, 'no profile: the default one lives under home');
  assert.match(said([appDir, `--user-data=${path.join(os.tmpdir(), 'bd-x')}`]), /under this machine's temp folder/, 'a temp profile');
  assert.match(said([appDir, `--user-data=${path.join(os.homedir(), 'bd-x')}`]), /under this machine's home folder/, 'a home profile');
  assert.match(said([appDir, `--user-data=${path.resolve(appDir, 'fixture-like', 'bd-x')}`]), /not a folder from fixtureFolder\(\)/, 'a profile outside the fixture root');
  // main.js takes the first --user-data= flag; every one must be a fixture folder, in either order.
  assert.match(said([`--user-data=${inRoot}`, `--user-data=${path.join(os.tmpdir(), 'bd-x')}`]), /temp folder/, 'a temp profile after a fixture one');
  assert.match(said([`--user-data=${path.join(os.tmpdir(), 'bd-x')}`, `--user-data=${inRoot}`]), /temp folder/, 'a temp profile before a fixture one');
  assert.match(said([appDir, '--user-data=']), /not a folder from fixtureFolder\(\)/, 'an empty profile is the working folder');
  assert.equal(said([appDir, `--user-data=${inRoot}`]), null, 'a profile under the fixture root');

  // Through the launch itself, with Playwright's launch swapped for a recorder: nothing starts when refused.
  const launched = [], evaluated = [], argv = process.argv[1], original = _electron.launch[LAUNCH];
  const app = { evaluate: async (fn, arg) => { evaluated.push([fn, arg]); } };
  _electron.launch[LAUNCH] = async options => { launched.push(options); return app; };
  try {
    await assert.rejects(_electron.launch({ args: [appDir] }), /Refusing to launch: no --user-data profile/);
    await assert.rejects(_electron.launch({ args: [appDir, `--user-data=${path.join(os.tmpdir(), 'bd-x')}`] }), /Refusing to launch: .*temp folder/);
    assert.equal(launched.length, 0, 'a refused launch starts nothing');
    await assert.rejects(_electron.launch({ args: [appDir, `--user-data=${path.join(os.tmpdir(), 'bd-x')}`, `--user-data=${inRoot}`] }), /Refusing to launch: .*temp folder/);
    assert.equal(launched.length, 0, 'a refused launch starts nothing');
    assert.equal(await _electron.launch({ args: [appDir, `--user-data=${inRoot}`] }), app);
    assert.equal(launched.length, 1, 'a fixture profile launches');
    assert.deepEqual(evaluated, [[stubTools, FIXTURE.tools]], 'the launched app answers the tool lookup with the fixture');
    // Launched the way the scripts launch it, from scripts not on the list: each gets the fixture tools.
    const real = { executablePath: process.execPath, args: [appDir, '--profiles', `--user-data=${inRoot}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' }, timeout: 180000 };
    for (const script of ['tests/editor-subsup.live.mjs', 'tests/provider-discovery.live.mjs', 'tests/provider-login.live.mjs', 'tests/visual-capture.mjs', 'tests/status-shots.mjs']) {
      evaluated.length = 0;
      process.argv[1] = path.join(appDir, script);
      await _electron.launch(real);
      assert.deepEqual(evaluated, [[stubTools, FIXTURE.tools]], `${script} gets the fixture tools`);
    }
    for (const script of Object.keys(REAL_TOOLS)) {
      evaluated.length = 0;
      process.argv[1] = path.join(appDir, script);
      await _electron.launch(real);
      assert.deepEqual(evaluated, [], `${script} keeps the real lookup`);
    }
  } finally { _electron.launch[LAUNCH] = original; process.argv[1] = argv; }
});

// A script opens Settings when it names the sheet, its opener, a pane or the Settings key.
const OPENS_SETTINGS = /bw-settings|openSettings|data-pane=|\+,['"`]/;
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : files(path.join(dir, e.name))) : [path.join(dir, e.name)]);
const scripts = () => files(here).filter(f => /\.(?:mjs|js|cjs)$/.test(f)).map(f => path.relative(appDir, f).split(path.sep).join('/'));
// The helper, its tracer and this test name the flag and Settings as text; they launch no app.
const NOT_LAUNCHERS = new Set(['tests/lib/playwright.mjs', 'tests/lib/profile-trace.mjs', 'tests/launch-profile.test.mjs']);

// What in a script is wrong with how it launches the app; empty when it imports _electron from the helper and every
// --user-data= value sits in a launch through it and comes only from fixtureFolder() (tests/lib/profile-trace.mjs).
export function launchProblems(source, name = 'script.mjs') {
  const script = parseScript(source, name), problems = [];
  const electron = script.importsOf(/^\.{1,2}\/(?:.*\/)?lib\/playwright\.mjs$|^\.\/playwright\.mjs$/, '_electron');
  const folders = script.importsOf(/^\.{1,2}\/(?:.*\/)?lib\/fixture-folder\.mjs$|^\.\/fixture-folder\.mjs$/, 'fixtureFolder');
  if (electron.size !== 1) problems.push('does not import _electron from tests/lib/playwright.mjs');
  const insideLaunch = node => { for (let n = node.parent; n; n = n.parent) if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'launch' && ts.isIdentifier(n.expression.expression) && electron.has(script.symbolOf(n.expression.expression))) return true; return false; };
  const { values, literals } = profileValues(script);
  for (const n of literals) problems.push(`line ${script.line(n)}: a --user-data= literal with no fixtureFolder() value`);
  if (!values.length) problems.push('launches with no --user-data= profile');
  for (const { value, at } of values) {
    if (!insideLaunch(at)) problems.push(`line ${script.line(at)}: a --user-data= profile outside a launch through the helper`);
    for (const leaf of profileSources(script, value, folders)) if (leaf.kind !== 'fixture') problems.push(`line ${script.line(leaf.node)}: ${leaf.kind === 'temp' ? 'a profile made in the temp folder' : leaf.why}`);
  }
  return [...new Set(problems)];
}

// Where a listed script may take a picture once Settings is open: only of the listed element, or never.
export function realToolsPictures(source, picture, name = 'script.mjs') {
  const at = source.search(OPENS_SETTINGS);
  if (at === -1) return [];
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), problems = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'screenshot' && node.getStart(sf) > at) {
      const of = node.expression.expression;
      const listed = picture && ts.isCallExpression(of) && ts.isPropertyAccessExpression(of.expression) && of.expression.name.text === 'locator'
        && of.arguments.length === 1 && ts.isStringLiteralLike(of.arguments[0]) && of.arguments[0].text === picture;
      if (!listed) problems.push(`line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: a picture after Settings opens that is not of ${picture ?? 'nothing'}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return problems;
}

test('every script that takes a picture of Settings launches through the helper with a profile from fixtureFolder()', () => {
  const settings = scripts().filter(file => !NOT_LAUNCHERS.has(file)).filter(file => { const s = fs.readFileSync(path.join(appDir, file), 'utf8'); return OPENS_SETTINGS.test(s) && s.includes('screenshot('); });
  assert.ok(settings.length >= 30, `the walk finds the scripts that open Settings and take pictures (${settings.length})`);
  const wrong = settings.flatMap(file => launchProblems(fs.readFileSync(path.join(appDir, file), 'utf8'), file).map(problem => `${file}: ${problem}`));
  assert.deepEqual(wrong, [], 'launch every app through tests/lib/playwright.mjs with --user-data= a folder from fixtureFolder()');

  // The real tool lookup is kept for exactly these scripts, each for its reason, and each takes no picture of
  // Settings but its listed element.
  assert.deepEqual(Object.keys(REAL_TOOLS).sort(), ['tests/first-run-clean.live.mjs', 'tests/provider-tools.live.mjs']);
  for (const [file, { reason, picture }] of Object.entries(REAL_TOOLS)) {
    assert.ok(typeof reason === 'string' && reason.length > 20, `${file} says why it keeps the real lookup`);
    const source = fs.readFileSync(path.join(appDir, file), 'utf8');
    assert.deepEqual(realToolsPictures(source, picture, file), [], `${file} takes no picture of Settings but ${picture ?? 'none'}`);
    assert.deepEqual(launchProblems(source, file), [], `${file} launches through the helper with a fixture profile`);
  }

  // Nothing but the helper and this test reaches Playwright's own launch.
  const reaching = scripts().filter(file => fs.readFileSync(path.join(appDir, file), 'utf8').includes('barkdown.launch-fixtures') || /\bLAUNCH\b/.test(fs.readFileSync(path.join(appDir, file), 'utf8')));
  assert.deepEqual(reaching.sort(), ['tests/launch-profile.test.mjs', 'tests/lib/playwright.mjs'], "only the helper and this test reach Playwright's own launch");
});
