// Captures refuse a frame that would show the capturing machine's home folder, temp folder or login name
// (tests/visual-machine-text.mjs), before any picture is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { machineTraces, findMachineText, refuseMachineText } from './visual-machine-text.mjs';
import { FIXTURE, pinFixtures } from './visual-fixtures.mjs';
import * as fixtures from './visual-fixtures.mjs';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REFUSED = /^Refusing to capture: the page shows this machine's (temp folder|home folder|login name)\./;

// Each platform's shapes, with values injected so every platform's forms are checked on any machine.
const PLATFORMS = {
  windows: { traces: { home: 'C:\\Users\\kari', temp: 'C:\\Users\\kari\\AppData\\Local\\Temp', login: 'kari' },
    refused: [['C:\\Users\\kari\\AppData\\Local\\Temp\\barkdown-visual-x\\bin\\barkdown.cmd', 'temp folder'], ['c:/users/KARI/AppData/Local/Temp/x', 'temp folder'],
      ['C:\\Users\\kari\\Documents', 'home folder'], ['file:///C:/Users/kari/Documents', 'home folder'], ['"C:/Users/Kari"', 'home folder'], ['Signed in as Kari', 'login name']],
    clean: ['C:/Barkdown visual fixture/bin/barkdown.cmd', 'Skari and karin', 'C:\\Users\\karin\\x'] },
  macos: { traces: { home: '/Users/ola', temp: '/var/folders/ab/xyz/T/', login: 'ola' },
    refused: [['/var/folders/ab/xyz/T/barkdown-visual-1/bin/barkdown', 'temp folder'], ['/Users/ola/Library', 'home folder'], ['file:///Users/ola/My%20notes', 'home folder'], ['by Ola.', 'login name']],
    clean: ['a cola and a viola', '/Users/olav/x', 'C:/Barkdown visual fixture/data'] },
  linux: { traces: { home: '/home/ci', temp: '/scratch/t', login: 'ci' },
    refused: [['/scratch/t/barkdown-visual-1', 'temp folder'], ['/home/ci/.config', 'home folder'], ['/srv/ci/work', 'login name']],
    clean: ['ci checks passed', 'a /scratch/tfile name', 'CI'] },
  rootHome: { traces: { home: '/', temp: 'C:\\', login: '' }, refused: [], clean: ['/usr/bin/barkdown', 'C:\\x'] },
};

test('each platform\'s home, temp and login forms are refused; fixture and look-alike text is not', () => {
  for (const [platform, { traces, refused, clean }] of Object.entries(PLATFORMS)) {
    const t = machineTraces(traces);
    for (const [text, kind] of refused) assert.equal(findMachineText([text], t), kind, `${platform}: ${text}`);
    for (const text of clean) assert.equal(findMachineText([text], t), null, `${platform}: ${text}`);
  }
});

// The real machine values, planted into a page the way a pane would draw them, stop the capture before
// the screenshot is taken. A hidden pane holding the same value is not drawn and does not stop it.
test('a frame drawing this machine\'s temp folder, home folder or login name is refused and no picture is written', { timeout: 60_000 }, async () => {
  const temp = os.tmpdir(), out = fs.mkdtempSync(path.join(temp, 'visual-machine-text-'));
  const login = os.userInfo().username, home = os.homedir();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const capture = async (html, file) => { await page.setContent(html); await refuseMachineText(page); await page.screenshot({ path: path.join(out, file) }); };
    const planted = {
      'body.png': `<p>Run <code>${temp}${path.sep}barkdown-visual-1${path.sep}bin${path.sep}barkdown</code></p>`,
      'aria.png': `<button aria-label="Open ${home.replace(/\\/g, '/')}/notes">Open</button>`,
      'title.png': `<span title="Signed in as ${login}">Account</span>`,
      'input.png': `<input value="${fs.realpathSync.native(temp)}">`,
    };
    for (const [file, html] of Object.entries(planted)) {
      await assert.rejects(capture(html, file), { message: REFUSED }, file);
      assert.equal(fs.existsSync(path.join(out, file)), false, `${file} was not written`);
    }
    await capture(`<section hidden><code>${temp}${path.sep}hidden-pane </code></section><span hidden title="${home}${path.sep}hidden-title"></span><p>Command line: <code>C:/Barkdown visual fixture/bin/barkdown.cmd</code></p>`, 'clean.png');
    assert.equal(fs.existsSync(path.join(out, 'clean.png')), true, 'a clean frame is captured');
  } finally { await browser.close(); fs.rmSync(out, { recursive: true, force: true }); }
});

// The tour pins what Settings would otherwise fill from the machine, through the same function the page runs.
test('the tour shows a fixed command-line path and data folder in Settings', () => {
  const state = { settings: { userData: '/Users/ola/Library/Barkdown', control: { fullYolo: true, command: '/Users/ola/Library/Barkdown/bin/barkdown' } } };
  pinFixtures(FIXTURE, state);
  assert.deepEqual([state.settings.userData, state.settings.control], ['C:/Barkdown visual fixture/data', { fullYolo: true, command: 'C:/Barkdown visual fixture/bin/barkdown.cmd' }]);
  assert.match(fs.readFileSync(path.join(here, 'visual-capture.mjs'), 'utf8'), /const fixtures=async\(\)=>\{await p\.evaluate\(pinFixtures,FIXTURE\);\};/);
});

// A folder named through a link the test makes itself is still recognised by where it leads.
test('a temp folder reached through a link is refused by the folder it leads to', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-machine-link-'));
  try {
    const target = path.join(root, 'real-temp'), link = path.join(root, 'linked-temp');
    fs.mkdirSync(target); fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    const traces = machineTraces({ home: '/Users/ola', temp: link, login: 'ola' });
    assert.equal(findMachineText([path.join(fs.realpathSync.native(target), 'barkdown-visual-1')], traces), 'temp folder');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// The tool lookup is answered in the main process, by stubTools, which tests/lib/playwright.mjs runs after every
// launch (tests/launch-profile.test.mjs pins that). This row pins what the stub does, whichever registers first, and
// reads visual-fixtures.mjs by syntax (TypeScript's parser, the root's devDependency): nothing else in the tests
// names the channel, and visual-fixtures.mjs names it only inside stubTools.
test('the tour shows fixed tool paths in Settings › Assistant, never this machine\'s', async () => {
  assert.equal(typeof fixtures.stubTools, 'function', 'visual-fixtures.mjs answers the tool lookup');
  const calls = [];
  const ipcMain = { removeHandler: channel => calls.push(['removeHandler', channel]), handle: (channel, fn) => calls.push(['handle', channel, fn]) };
  fixtures.stubTools({ ipcMain }, FIXTURE.tools);
  const channel = calls[0]?.[1];
  assert.deepEqual(calls.map(([call, name]) => [call, name]), [['removeHandler', channel], ['handle', channel]], 'the stub replaces one handler');
  assert.ok(fs.readFileSync(path.join(here, '../main/main.js'), 'utf8').includes(`handle('${channel}', fresh => providerTools.all(`), `${channel} is the app's tool lookup`);
  assert.deepEqual(await calls[1][2](), { ok: true, value: FIXTURE.tools }, 'the stub answers with the fixture');
  // The app registering its own lookup after the stub still gets the fixture; any other channel is its own.
  const real = () => 'the real lookup', other = () => 'another channel';
  ipcMain.handle(channel, real);
  ipcMain.handle('agent:start', other);
  assert.deepEqual(calls.slice(2).map(([call, name]) => [call, name]), [['removeHandler', channel], ['handle', channel], ['handle', 'agent:start']], 'a later registration is replaced, another channel is not');
  assert.deepEqual(await calls[3][2](), { ok: true, value: FIXTURE.tools }, 'a lookup the app registers after the stub answers with the fixture');
  assert.equal(calls[4][2], other, 'another channel keeps its own handler');
  const traces = machineTraces();
  for (const name of ['claude', 'codex']) {
    const tool = FIXTURE.tools[name];
    assert.equal(tool.ok, true, `${name} is shown as found`);
    assert.ok(tool.path.startsWith('C:/Barkdown visual fixture/'), `${name}: ${tool.path} is a fixture path`);
    assert.equal(findMachineText([tool.path], traces), null, `${name}: ${tool.path} holds none of this machine's folders or login`);
  }

  const ts = createRequire(import.meta.url)('typescript');
  const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const naming = files(here).filter(file => fs.readFileSync(file, 'utf8').includes(channel)).map(file => path.relative(here, file).split(path.sep).join('/'));
  assert.deepEqual(naming, ['visual-fixtures.mjs'], `only visual-fixtures.mjs under app/tests names ${channel}`);
  const fixturesSource = fs.readFileSync(path.join(here, 'visual-fixtures.mjs'), 'utf8');
  const fsf = ts.createSourceFile('visual-fixtures.mjs', fixturesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const body = fsf.statements.find(st => ts.isFunctionDeclaration(st) && st.name?.text === 'stubTools')?.body;
  const outside = [];
  for (let at = fixturesSource.indexOf(channel); at !== -1; at = fixturesSource.indexOf(channel, at + 1)) {
    if (!body || at < body.getStart(fsf) || at >= body.end) outside.push(`line ${fsf.getLineAndCharacterOfPosition(at).line + 1}`);
  }
  assert.deepEqual(outside, [], `visual-fixtures.mjs names ${channel} only inside stubTools`);
});

test('a home folder with a space is refused as written and as a file URL', () => {
  for (const home of ['C:\\Users\\Kari Nordmann', '/Users/Ola Nordmann']) {
    const traces = machineTraces({ home, temp: '/scratch/t', login: 'zz-none' }), forward = home.replace(/\\/g, '/');
    assert.equal(findMachineText([`${home}${home.includes('\\') ? '\\' : '/'}notes`], traces), 'home folder', home);
    assert.equal(findMachineText([`file:///${forward.replace(/^\//, '')}/notes`.replace(/ /g, '%20')], traces), 'home folder', `${home} as a file URL`);
  }
});

// Every screenshot in both capture scripts is taken right after the refusal, on the same line.
test('every screenshot in the visual tour and the status shots is taken right after the refusal', () => {
  for (const script of ['visual-capture.mjs', 'status-shots.mjs']) {
    const lines = fs.readFileSync(path.join(here, script), 'utf8').split(/\r?\n/);
    const shots = lines.map((line, i) => [line, i + 1]).filter(([line]) => line.includes('screenshot('));
    assert.ok(shots.length >= 1, `${script} takes screenshots`);
    for (const [line, n] of shots) assert.match(line, /await refuseMachineText\((p|page)\);\s*(?:const png = PNG\.sync\.read\()?await (p|page)\.screenshot\(/, `${script}:${n}`);
  }
});

// The machine values are read at run time; none is written into these sources or the fixture pin.
test('the capture sources hold no home or temp folder of this machine', () => {
  const traces = machineTraces().filter(([kind]) => kind !== 'login name');
  for (const file of ['visual-machine-text.mjs', 'visual-machine-text.test.mjs', 'visual-fixtures.mjs', 'visual-capture.mjs', 'status-shots.mjs']) {
    assert.equal(findMachineText([fs.readFileSync(path.join(here, file), 'utf8')], traces), null, file);
  }
});
