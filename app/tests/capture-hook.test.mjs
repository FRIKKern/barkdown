// Every script takes its pictures through tests/lib/playwright.mjs, whose hook refuses a screenshot of a page
// that shows this machine's home folder, temp folder or login name, and refuses screen captures that would
// skip that check. The scan rows keep every script on the helper; the hook rows prove what the helper does.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import playwright, { chromium, checked } from './lib/playwright.mjs';

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
  'app/tests/visual-machine-text.test.mjs': "the refusal's own test: refuses before its one screenshot, into a temp folder it removes; a capture-fingerprint input",
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
// Frozen evidence copies under docs/, pinned as a set: a new one, or one gone, changes the pin.
const DOCS_PINNED = {
  playwright: [50, '8916a20e139b33fe4d3954fe405dad7feef8f7004022d4fc1e95dd394e6d8c43'],
  raw: [6, 'd4fee6f2335d7a6901a002e2fdc8ccc0003259da30cf486add7c45bf9b045132'],
};

// Every file outside docs/, whatever its extension; under docs/ (about 3 GB of pictures and records),
// the files with a script extension or none.
export const inScope = relative => !relative.split('/').includes('node_modules')
  && (!relative.startsWith('docs/') || /\.[cm]?[jt]sx?$|(^|\/)[^./]+$/.test(relative));
export function matches(source) {
  return { playwright: NAMES_PLAYWRIGHT.test(source), raw: RAW_CAPTURE.test(source) };
}
function scan() {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  const found = { playwright: [], raw: [] }, decode = new TextDecoder('utf-8');
  for (const relative of [...new Set(listed.split('\0').filter(Boolean))].filter(inScope).sort()) {
    const file = path.join(root, relative);
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
});

test('no script captures the screen except through a checked screenshot', () => {
  const found = tree().raw;
  assert.deepEqual(found.filter(f => !f.startsWith('docs/') && !(f in RAW_ALLOWED)), [], 'these capture the screen outside the checked screenshot');
  assert.deepEqual(pin(found), DOCS_PINNED.raw, 'the frozen evidence copies under docs/ that capture the screen');
  for (const file of Object.keys(RAW_ALLOWED)) assert.ok(found.includes(file), `${file} is listed and still captures`);
});

test('the scan finds each way of naming Playwright, in any file outside docs and in scripts under it', () => {
  for (const source of ["import { _electron } from 'playwright';", 'const { chromium } = require("playwright");', 'await import(`playwright-core`);',
    "createRequire(x)('playwright/lib/index.js')", "from '@playwright/test'"]) assert.equal(matches(source).playwright, true, source);
  for (const source of ['// playwright drives the window', "'playwrights'", "from './lib/playwright.mjs'"]) assert.equal(matches(source).playwright, false, source);
  for (const source of ["cdp.send('Page.captureScreenshot')", 'win.webContents.capturePage()', 'ffmpeg -f avfoundation -i 1']) assert.equal(matches(source).raw, true, source);
  for (const relative of ['app/x.png', 'tests/x', 'scripts/a.txt', 'docs/cycles/evidence/C1/run.mjs', 'docs/visual/x/capture.cjs', 'docs/tool']) assert.equal(inScope(relative), true, relative);
  for (const relative of ['docs/visual/runs/a.png', 'docs/cycles/evidence/C1/report.json', 'app/node_modules/x.js']) assert.equal(inScope(relative), false, relative);
});

// The hook rows run one headless Chromium. Every value planted is this machine's own, read at run time.
test('the hook checks every screenshot, by page, locator and element, and refuses one that shows this machine', { timeout: 60_000 }, async () => {
  const connection = Object.getPrototypeOf(playwright._connection);
  assert.equal(connection.sendMessageToServer[Symbol.for('barkdown.capture-hook')], true, 'the hook sits on the method every Playwright call is sent through');
  const temp = os.tmpdir(), out = fs.mkdtempSync(path.join(temp, 'capture-hook-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const ways = { page: file => page.screenshot({ path: file }), locator: file => page.locator('p').screenshot({ path: file }),
      element: async file => (await page.$('p')).screenshot({ path: file }), noPath: async file => fs.writeFileSync(file, await page.screenshot()) };
    await page.setContent('<p>Command line: <code>C:/Barkdown visual fixture/bin/barkdown.cmd</code></p>');
    for (const [way, take] of Object.entries(ways)) {
      const before = checked.screenshots, file = path.join(out, `clean-${way}.png`);
      await take(file);
      assert.equal(checked.screenshots, before + 1, `${way}: the screenshot passed through the hook`);
      assert.equal(fs.existsSync(file), true, `${way}: a clean frame is written`);
    }
    const planted = { temp: `<p>Run <code>${path.join(temp, 'barkdown-live-1', 'bin')}</code></p>`, home: `<p title="Open ${os.homedir()}">Open</p>`,
      login: `<p>Signed in as ${os.userInfo().username}</p>` };
    for (const [kind, html] of Object.entries(planted)) {
      await page.setContent(html);
      for (const [way, take] of Object.entries(ways)) {
        const file = path.join(out, `${kind}-${way}.png`);
        await assert.rejects(take(file), /Refusing to capture: the page shows this machine's/, `${kind} by ${way}`);
        assert.equal(fs.existsSync(file), false, `${kind} by ${way}: no picture is written`);
      }
    }
  } finally { await browser.close(); fs.rmSync(out, { recursive: true, force: true }); }
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
