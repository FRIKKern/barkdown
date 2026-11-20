// Every script takes its pictures through tests/lib/playwright.mjs, whose hook refuses a screenshot of a page
// that shows this machine's home folder, temp folder or login name, and refuses screen captures that would
// skip that check. The scan rows keep every script on the helper; the hook rows prove what the helper does.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import playwright, { chromium, checked } from './lib/playwright.mjs';
import { fixtureFolder } from './lib/fixture-folder.mjs';
import { machineValues } from './lib/machine-values.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// A file names Playwright when it holds the package name as a quoted module specifier, subpaths included.
const NAMES_PLAYWRIGHT = /(['"`])(?:playwright|playwright-core|@playwright\/test)(?:\/[^'"`\r\n]*)?\1/;
// Screen captures that bypass Playwright's screenshot: over CDP, through Electron, or of the whole desktop.
const RAW_CAPTURE = /captureScreenshot|startScreencast|capturePage|desktopCapturer|\b(?:avfoundation|gdigrab|x11grab|screencapture)\b/;

// Files that name Playwright without going through the helper, each with its reason.
export const PLAYWRIGHT_ALLOWED = Object.freeze({
  'app/tests/lib/playwright.mjs': 'the helper itself',
  'app/tests/capture-hook.test.mjs': 'this test, which plants the names it scans for',
  'app/tests/visual-capture.mjs': 'the visual tour: refuses on the line of every screenshot (pinned by visual-machine-text.test.mjs); a capture-fingerprint input',
  'app/tests/status-shots.mjs': 'the status shots: refuses on the line of every screenshot (pinned by visual-machine-text.test.mjs); a capture-fingerprint input',
  'scripts/playwright-electron-focus.cjs': 'the install-time patch: resolves the package folder, takes no picture',
  'scripts/nightly-schedule.mjs': 'passes the package name to npx to install the browser',
  'scripts/record-validation.cjs': "reads Playwright's version",
  'package.json': 'the dependency pin',
  'package-lock.json': 'the dependency pin',
  'evidence/validation.json': 'a recorded version string',
});
export const RAW_ALLOWED = Object.freeze({
  'app/tests/lib/playwright.mjs': 'the helper, which refuses these',
  'app/tests/capture-hook.test.mjs': 'this test, which plants the names it scans for',
  'app/main/browser-tools.js': "the app's browser tool, which hands a page picture to the agent and writes no file",
  'app/tests/browser-tools.test.mjs': "a stand-in for that browser tool's debugger",
  '.github/workflows/release.yml': "a timed grab of the CI runner's screen into app/test-results, kept as a run artifact",
});
// Frozen evidence copies under docs/, pinned as count and sha256 of the sorted list: a new one, or one gone,
// changes the pin. The set can only shrink: a lower count is the only change the ceiling row lets through.
const DOCS_CEILING = { playwright: 71, raw: 12 };
const DOCS_PINNED = {
  playwright: [71, 'c1f6446848d2f23e51f090d2671dadd6f27181ac37e8c963a8bbb9b2f5f22a60'],
  raw: [12, '25bb062052b675f825589cc89237c9c97c3cff87b630e5f9d90cbf9a2b4c8e36'],
};

// Every file is read, at any depth and whatever its ending, except under docs/ (about 3 GB of evidence)
// a file whose ending names one of these binary kinds. Each says why such a file holds no script text.
const PICTURE = 'binary image data', RECORDING = 'binary video data', FONT = 'binary font data', ARCHIVE = 'compressed bytes', COMPILED = 'compiled machine or VM code';
export const DOCS_SKIPPED = Object.freeze({
  '.7z': ARCHIVE, '.beam': COMPILED, '.dll': COMPILED, '.dmg': ARCHIVE, '.exe': COMPILED, '.gif': PICTURE, '.gz': ARCHIVE,
  '.icns': PICTURE, '.ico': PICTURE, '.jpeg': PICTURE, '.jpg': PICTURE, '.lib': COMPILED, '.mov': RECORDING, '.mp4': RECORDING,
  '.otf': FONT, '.pdf': 'a compressed print document', '.png': PICTURE, '.tgz': ARCHIVE, '.ttf': FONT, '.webm': RECORDING,
  '.webp': PICTURE, '.woff': FONT, '.woff2': FONT, '.zip': ARCHIVE,
});
export const inScope = relative => !relative.split('/').includes('node_modules')
  && !(relative.startsWith('docs/') && path.posix.extname(relative).toLowerCase() in DOCS_SKIPPED);
export function matches(source) {
  return { playwright: NAMES_PLAYWRIGHT.test(source), raw: RAW_CAPTURE.test(source) };
}
function scan(top = root) {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 });
  const found = { playwright: [], raw: [] }, decode = new TextDecoder('utf-8');
  for (const relative of [...new Set(listed.split('\0').filter(Boolean))].filter(inScope).sort()) {
    const file = path.join(top, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const hit = matches(decode.decode(fs.readFileSync(file)));
    for (const kind of ['playwright', 'raw']) if (hit[kind]) found[kind].push(relative);
  }
  return found;
}
const pin = files => { const docs = files.filter(f => f.startsWith('docs/')).sort(); return [docs.length, crypto.createHash('sha256').update(docs.join('\n')).digest('hex')]; };
let scanned;
const tree = () => (scanned ??= scan());

test('every script reaches Playwright through tests/lib/playwright.mjs', () => {
  const found = tree().playwright;
  assert.deepEqual(found.filter(f => !f.startsWith('docs/') && !(f in PLAYWRIGHT_ALLOWED)), [], 'these name Playwright directly; import it from app/tests/lib/playwright.mjs');
  assert.deepEqual(pin(found), DOCS_PINNED.playwright, 'the frozen evidence copies under docs/ that name Playwright');
  for (const file of Object.keys(PLAYWRIGHT_ALLOWED)) assert.ok(found.includes(file), `${file} is listed and still names Playwright`);
  const chain = JSON.parse(fs.readFileSync(path.join(root, 'app/package.json'), 'utf8')).scripts.test;
  const chained = new Set(chain.match(/tests\/[^\s"&|;]+/g).map(file => `app/${file}`));
  assert.deepEqual(Object.keys(PLAYWRIGHT_ALLOWED).filter(file => chained.has(file)), [], 'a script in the test chain is never let past the helper');
});

test('no script captures the screen except through a checked screenshot', () => {
  const found = tree().raw;
  assert.deepEqual(found.filter(f => !f.startsWith('docs/') && !(f in RAW_ALLOWED)), [], 'these capture the screen outside the checked screenshot');
  assert.deepEqual(pin(found), DOCS_PINNED.raw, 'the frozen evidence copies under docs/ that capture the screen');
  for (const file of Object.keys(RAW_ALLOWED)) assert.ok(found.includes(file), `${file} is listed and still captures`);
});

test('the scan finds each way of naming Playwright, in any file but the binary kinds under docs/', () => {
  for (const source of ["import { _electron } from 'playwright';", 'const { chromium } = require("playwright");', 'await import(`playwright-core`);',
    "createRequire(x)('playwright/lib/index.js')", "from '@playwright/test'"]) assert.equal(matches(source).playwright, true, source);
  for (const source of ['// playwright drives the window', "'playwrights'", "from './lib/playwright.mjs'"]) assert.equal(matches(source).playwright, false, source);
  for (const source of ["cdp.send('Page.captureScreenshot')", 'win.webContents.capturePage()', 'ffmpeg -f avfoundation -i 1']) assert.equal(matches(source).raw, true, source);
  for (const relative of ['app/x.png', 'tests/x', 'docs/cycles/evidence/C1/run.mjs', 'docs/a/report.json', 'docs/a/notes.md', 'docs/a/b.svg', 'docs/a/run.weird', 'docs/tool']) assert.equal(inScope(relative), true, relative);
  for (const relative of ['docs/visual/runs/a.png', 'docs/a/B.JPG', 'docs/a/clip.webm', 'app/node_modules/x.js']) assert.equal(inScope(relative), false, relative);
});

test('a script under docs/ with an ending on no list is caught by name; a picture there is not read', () => {
  const dir = fixtureFolder('capture-scan-plant-');
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const writes = { 'docs/evidence/C1/run.weird': "import { chromium } from 'playwright';\n", 'docs/evidence/C1/tool': "require('playwright')\n",
      'docs/evidence/C1/shot.png': "import { chromium } from 'playwright';\n", 'scripts/grab.txt': "cdp.send('Page.captureScreenshot')\n" };
    for (const [name, body] of Object.entries(writes)) { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), body); }
    assert.deepEqual(scan(dir), { playwright: ['docs/evidence/C1/run.weird', 'docs/evidence/C1/tool'], raw: ['scripts/grab.txt'] });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the binary kinds skipped under docs/ are exactly these, and the pinned evidence copies can only shrink', () => {
  assert.deepEqual(Object.keys(DOCS_SKIPPED), ['.7z', '.beam', '.dll', '.dmg', '.exe', '.gif', '.gz', '.icns', '.ico', '.jpeg', '.jpg', '.lib', '.mov', '.mp4',
    '.otf', '.pdf', '.png', '.tgz', '.ttf', '.webm', '.webp', '.woff', '.woff2', '.zip']);
  for (const kind of ['playwright', 'raw']) assert.ok(DOCS_PINNED[kind][0] <= DOCS_CEILING[kind], `${kind}: the pinned docs/ set grew past ${DOCS_CEILING[kind]}`);
});

// The hook rows run one headless Chromium. Every value planted is this machine's own, read at run time
// (tests/lib/machine-values.mjs); the folders the rows write in come from fixtureFolder().
test('the hook checks every screenshot, by page, locator and element, and refuses one that shows this machine', { timeout: 60_000 }, async () => {
  const connection = Object.getPrototypeOf(playwright._connection);
  assert.equal(connection.sendMessageToServer[Symbol.for('barkdown.capture-hook')], true, 'the hook sits on the method every Playwright call is sent through');
  const { home, temp, login } = machineValues(), out = fixtureFolder('capture-hook-');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const ways = { page: file => page.screenshot({ path: file }), locator: file => page.locator('p').screenshot({ path: file }),
      element: async file => (await page.$('p')).screenshot({ path: file }), noPath: async file => fs.writeFileSync(file, await page.screenshot()) };
    await page.setContent('<p>Command line: <code>C:/Barkdown visual fixture/bin/barkdown.cmd</code></p>');
    for (const [way, take] of Object.entries(ways)) {
      const before = { ...checked }, file = path.join(out, `clean-${way}.png`);
      await take(file);
      assert.equal(checked.screenshots, before.screenshots + 1, `${way}: the screenshot passed through the hook`);
      assert.equal(checked.written, before.written + (way === 'noPath' ? 0 : 1), `${way}: the write Playwright makes is watched`);
      assert.equal(fs.existsSync(file), true, `${way}: a clean frame is written`);
    }
    // Each plant must be refused for its own kind, so a check that misses one kind cannot pass on another.
    const words = { temp: 'temp folder', home: 'home folder', login: 'login name' };
    const planted = { temp: `<p>Run <code>${path.join(temp, 'barkdown-live-1', 'bin')}</code></p>`, home: `<p title="Open ${home}">Open</p>`,
      login: `<p>Signed in as ${login}</p>` };
    for (const [kind, html] of Object.entries(planted)) {
      await page.setContent(html);
      for (const [way, take] of Object.entries(ways)) {
        const file = path.join(out, `${kind}-${way}.png`);
        await assert.rejects(take(file), new RegExp(`Refusing to capture: the page shows this machine's ${words[kind]}\\.`), `${kind} by ${way}`);
        assert.equal(fs.existsSync(file), false, `${kind} by ${way}: no picture is written`);
      }
    }
  } finally { await browser.close(); fs.rmSync(out, { recursive: true, force: true }); }
});

// A script that takes pictures ends its run with the check's count. The script runs in its own process, so
// the line is the one that process prints at exit; a picture the check skipped fails that run and names it.
test('a script that takes pictures ends its run with "screenshots checked: N", N above 0 and one per picture', { timeout: 60_000 }, () => {
  const out = fixtureFolder('capture-count-'), script = path.join(out, 'takes-pictures.mjs');
  try {
    const helper = pathToFileURL(path.join(root, 'app/tests/lib/playwright.mjs')).href;
    fs.writeFileSync(script, `import { chromium } from ${JSON.stringify(helper)};
const out = ${JSON.stringify(out)}, browser = await chromium.launch(), page = await browser.newPage();
await page.setContent('<p>Command line: <code>C:/Barkdown visual fixture/bin/barkdown.cmd</code></p>');
await page.screenshot({ path: out + '/page.png' });
await page.locator('p').screenshot({ path: out + '/locator.png' });
await (await page.$('p')).screenshot({ path: out + '/element.png' });
await browser.close();
`);
    const run = spawnSync(process.execPath, [script], { cwd: path.join(root, 'app'), encoding: 'utf8', timeout: 50_000 });
    assert.equal(run.status, 0, `the script failed:\n${run.stderr}`);
    const count = run.stderr.match(/^screenshots checked: (\d+)$/gm) ?? [];
    assert.equal(count.length, 1, `one count line, at the end of the run:\n${run.stderr}`);
    const n = Number(count[0].split(': ')[1]);
    assert.ok(n > 0, 'N is above 0');
    assert.equal(n, 3, 'N is one per picture');
    for (const file of ['page.png', 'locator.png', 'element.png']) assert.equal(fs.existsSync(path.join(out, file)), true, `${file} is written`);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

// A picture Playwright would write that the check never looked at is not written: the write is refused by name,
// and the run fails and names it again under its count. The script below writes as Playwright does, from a
// module in a playwright-core folder, a picture the check has not seen.
test('a picture the check did not look at is not written, and the run fails naming it', { timeout: 60_000 }, () => {
  const out = fixtureFolder('capture-unlooked-'), writer = path.join(out, 'playwright-core', 'write.mjs'), script = path.join(out, 'run.mjs');
  const picture = path.join(out, 'unlooked.png');
  try {
    const helper = pathToFileURL(path.join(root, 'app/tests/lib/playwright.mjs')).href;
    fs.mkdirSync(path.dirname(writer));
    fs.writeFileSync(writer, "import fs from 'node:fs';\nexport const write = (file, data) => fs.promises.writeFile(file, data);\n");
    fs.writeFileSync(script, `import ${JSON.stringify(helper)};
import { write } from ${JSON.stringify(pathToFileURL(writer).href)};
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
try { await write(${JSON.stringify(picture)}, png); } catch (error) { console.error(error.message); }
`);
    const run = spawnSync(process.execPath, [script], { cwd: path.join(root, 'app'), encoding: 'utf8', timeout: 50_000 });
    assert.notEqual(run.status, 0, `the run passed:\n${run.stderr}`);
    assert.ok(run.stderr.includes(`Refusing to write ${picture}: the screenshot check did not look at this picture.`), `the write is refused by name:\n${run.stderr}`);
    assert.ok(run.stderr.split(/\r?\n/).includes(`a picture the screenshot check did not look at: ${picture}`), `the run names it under its count:\n${run.stderr}`);
    assert.equal(fs.existsSync(picture), false, 'the picture is not written');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('a capture over CDP or through a main-process evaluate is refused', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), cdp = await page.context().newCDPSession(page);
    for (const method of ['Page.captureScreenshot', 'Page.startScreencast']) await assert.rejects(cdp.send(method, {}), /Refusing to capture/, method);
    const handle = await page.evaluateHandle(() => window);
    await assert.rejects(handle.evaluate(w => w.webContents?.capturePage()), /Refusing to capture/, 'a capturePage evaluate');
    await assert.rejects(page.evaluate('desktopCapturer.getSources({ types: ["screen"] })'), /Refusing to capture/, 'a desktopCapturer evaluate');
  } finally { await browser.close(); }
});
