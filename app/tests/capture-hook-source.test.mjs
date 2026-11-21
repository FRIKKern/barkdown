// What the screenshot check (tests/lib/playwright.mjs) may reach, read from its source by TypeScript's parser,
// with no browser. Everything it uses is listed here, in one place: the globals and each use made of them, the
// modules it loads, the member names it reads, and the names it re-exports from Playwright. Anything else is red
// by name. An honest change to the helper costs one line here, with its reason. Under `process` that leaves two
// uses: printing the count at exit and setting the exit code; the check takes no cue from where it runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { freeNamesOf, memberNamesOf } from './lib/import-scan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const helper = fs.readFileSync(path.join(here, 'lib/playwright.mjs'), 'utf8');
const launchFixtures = fs.readFileSync(path.join(here, 'lib/launch-fixtures.mjs'), 'utf8');

// Each global, with the uses the helper makes of it and why.
const GLOBALS = Object.freeze({
  Buffer: [['Buffer.from', 'Buffer.isBuffer'], 'tells a PNG or JPEG from other bytes'],
  console: [['console.error'], 'prints the count, and any picture the check did not look at, at exit'],
  Error: [['Error.stackTraceLimit', 'new Error'], 'refuses with a message, and reads which module made a write'],
  globalThis: [['globalThis[STATE]'], "keeps the run's one count, shared by every copy of the helper"],
  Object: [['Object.getPrototypeOf'], "finds Playwright's Connection to hook"],
  process: [['process.exitCode', 'process.on'], 'prints the count when the run ends (on), and fails the run when a picture was not looked at (exitCode)'],
  Set: [['new Set'], 'the CDP methods it refuses'],
  String: [['String()'], 'turns a path or an expression into text'],
  Symbol: [['Symbol.for'], 'marks the hook and the shared count once per process'],
  WeakSet: [['new WeakSet'], 'remembers the pictures the check looked at'],
});
// Each module it loads, and why.
const LOADS = Object.freeze({
  '../visual-machine-text.mjs': 'the page check',
  './screenshot-count.mjs': "the chain's record of the count",
  './launch-fixtures.mjs': "the launch fixtures, handed Electron's launcher and nothing else (the last row)",
  'node:fs': 'watches the writes Playwright makes',
  'node:module': "loads Playwright as the app's tests do",
  playwright: 'the library it hooks',
});
// The member names it reads (property access, a literal key, a destructuring key), by group.
const MEMBERS = Object.freeze({
  'Playwright internals the hook stands on': ['_connection', 'sendMessageToServer', 'call', '_type', 'method', 'expression', 'ownerFrame', 'page'],
  'what a screenshot result holds': ['binary'],
  "the run's state": ['checked', 'screenshots', 'written', 'lookedAt', 'unchecked', 'length'],
  'collections': ['add', 'has', 'push'],
  'bytes': ['isBuffer', 'from', 'subarray', 'equals'],
  'errors and stacks': ['stack', 'stackTraceLimit', 'split', 'error'],
  'text and patterns': ['test'],
  'modules and objects': ['promises', 'writeFile', 'getPrototypeOf', 'for', 'url'],
  'the process, at exit': ['on', 'exitCode'],
  'the stack frame of the module that made a write': ['3'],
});
// The names it re-exports from Playwright, for the scripts that import them from the helper.
const PLAYWRIGHT_REEXPORTS = Object.freeze(['_electron', 'chromium', 'devices', 'errors', 'firefox', 'request', 'selectors', 'webkit']);

test('the screenshot check reaches only its listed globals and modules, and the process only to report at exit', () => {
  const { free, loads } = freeNamesOf(helper);
  const listed = name => Object.hasOwn(GLOBALS, name);
  const off = Object.entries(free).flatMap(([name, uses]) => listed(name) ? uses.filter(use => !GLOBALS[name][0].includes(use)) : uses.map(use => `${use} (a global not on the list)`));
  assert.deepEqual(off, [], 'what the helper reaches off its list');
  assert.deepEqual(loads.filter(load => !Object.hasOwn(LOADS, load)), [], 'modules the helper loads off its list');
  for (const [name, [uses]] of Object.entries(GLOBALS)) for (const use of uses) assert.ok(free[name]?.includes(use), `${use} is listed and still used`);
  for (const load of Object.keys(LOADS)) assert.ok(loads.includes(load), `${load} is listed and still loaded`);
});

test('the screenshot check reads only its listed member names, and re-exports only the listed Playwright names', () => {
  const { members, exported, computed } = memberNamesOf(helper);
  const fromPlaywright = exported.filter(name => name.startsWith('playwright.')).map(name => name.slice('playwright.'.length));
  const read = [...members, ...exported.filter(name => !name.startsWith('playwright.')).map(name => name.slice(name.indexOf('.') + 1))];
  const allowed = Object.values(MEMBERS).flat();
  assert.deepEqual(computed, [], 'element access by a key that is not a literal or a declared const');
  assert.deepEqual([...new Set(read)].filter(name => !allowed.includes(name)), [], 'member names the helper reads off its list');
  assert.deepEqual(allowed.filter(name => !read.includes(name)), [], 'member names listed but no longer read');
  assert.deepEqual(fromPlaywright, [...PLAYWRIGHT_REEXPORTS].sort(), 'the names re-exported from Playwright');
});

// The launch fixtures are not on these lists, so they must not become a way around them: they load nothing of the
// screenshot check or its count and reach no shared state, and the helper hands them Electron's launcher only.
test("the launch fixtures take nothing from the screenshot check or its count, and the helper hands them only Electron's launcher", () => {
  const { free, loads } = freeNamesOf(launchFixtures);
  const OF_THE_CHECK = /(?:^|\/)(?:playwright|screenshot-count|import-scan)\.mjs$|^playwright(?:-core)?(?:\/|$)|^@playwright\//;
  assert.deepEqual(loads.filter(load => OF_THE_CHECK.test(load)), [], 'modules of the check or its count that the launch fixtures load');
  assert.equal(Object.hasOwn(free, 'globalThis'), false, 'the launch fixtures reach no shared state');
  assert.doesNotMatch(launchFixtures, /barkdown\.capture-hook/, "the launch fixtures name none of the check's marks");
  const ts = createRequire(import.meta.url)('typescript');
  const sf = ts.createSourceFile('playwright.mjs', helper, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const uses = [], imported = [], reexported = [];
  const visit = node => {
    if (ts.isIdentifier(node) && node.text === 'fixLaunch' && !ts.isImportSpecifier(node.parent)) uses.push(ts.isCallExpression(node.parent) && node.parent.expression === node ? node.parent.arguments.map(a => a.getText(sf)).join(', ') : `not a call: ${node.parent.getText(sf).slice(0, 60)}`);
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === './launch-fixtures.mjs') imported.push(...(node.importClause?.namedBindings?.elements ?? []).map(e => e.name.text), ...(node.importClause?.name ? ['default'] : []), ...(node.importClause?.namedBindings && !node.importClause.namedBindings.elements ? ['*'] : []));
    if (ts.isExportDeclaration(node) && node.moduleSpecifier?.text === './launch-fixtures.mjs') reexported.push(...(node.exportClause?.elements ?? [{ name: { text: '*' } }]).map(e => e.name.text));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  assert.deepEqual(imported, ['fixLaunch'], 'the helper imports only fixLaunch from the launch fixtures');
  assert.deepEqual(uses, ['_electron'], "the helper calls fixLaunch once, with Electron's launcher only");
  assert.deepEqual(reexported.sort(), ['LAUNCH', 'REAL_TOOLS', 'profileProblem'], 'the names the helper passes on from the launch fixtures');
});
