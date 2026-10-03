import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-ui-'));
const out = process.env.BARKDOWN_TERMINAL_OUT || userData;
fs.mkdirSync(out, { recursive: true });
const registry = require('../main/profile-registry').createProfileRegistry(path.join(userData, 'profile-data'));
const a = registry.createProfile({ name: 'Terminal A' }),
  b = registry.createProfile({ name: 'Terminal B' });
const profiles = [a, b].map((p) => p.profileId || p.id);
const folders = profiles.map((id, index) => {
  const folder = path.join(userData, 'folder-' + (index ? 'B' : 'A'));
  fs.mkdirSync(folder);
  const store = require('../main/store').createStore(registry.storeFor(id).storeDir, { create: false });
  const ws = store.readJson('workspace.json');
  ws.chats.same = {
    id: 'same',
    title: index ? 'B conversation' : 'A conversation',
    folder,
    draft: index ? 'B draft' : 'A draft',
    messages: [],
    events: [],
    sessions: {},
    apiHistory: [],
    runId: null,
    following: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tabs: [{ id: 'same-terminal', type: 'terminal', title: 'Terminal' }],
    active: 'same-terminal',
    closedTargets: [],
  };
  ws.current = 'same';
  ws.order = ['same'];
  store.writeJson('workspace.json', ws);
  return folder;
});
registry.selectProfile(profiles[0]);
const script = fileURLToPath(new URL('./fixtures/terminal-descendants.cjs', import.meta.url));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Progress on stdout, so a run that stalls shows where; and no wait without an end.
const logFile = path.join(out, 'log.txt');
const step = name => { const line = `[${new Date().toISOString().slice(11, 19)}] ${name}`; console.log(line); try { fs.appendFileSync(logFile, line + '\n'); } catch {} };
// A watchdog for a hosted runner: if the process is still alive after twelve minutes, say so and leave,
// so the job's log shows the phase reached instead of a cancelled step with nothing in it.
const diagnostics = []; const note = line => { const text = String(line).trimEnd().slice(0, 600); if (!text) return; diagnostics.push(text); if (diagnostics.length > 200) diagnostics.shift(); try { fs.appendFileSync(path.join(out, 'app-output.txt'), text + '\n'); } catch {} };
// What the screen shows, taken by the operating system: a native dialog or a blank window is invisible to the page's own tools.
function desktopShot(name) {
  if (process.platform !== 'win32') return;
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${path.join(out, name).replaceAll("'", "''")}')`], { timeout: 30000, stdio: 'ignore' }); step('desktop screenshot: ' + name); }
  catch (error) { step('desktop screenshot failed: ' + error.message.slice(0, 200)); }
}
function report(why) {
  step(why); desktopShot('desktop-' + Date.now() + '.png');
  step('the app printed ' + diagnostics.length + ' lines; the last ones:'); for (const line of diagnostics.slice(-40)) step('  ' + line);
  try { step('windows: ' + (app ? app.windows().map(w => w.url()).join(' | ') || 'none' : 'no app')); } catch (error) { step('windows unreadable: ' + error.message); }
}
setTimeout(() => { report('watchdog: the tour did not finish within 8 minutes; exiting'); try { app?.process().kill('SIGKILL'); } catch {} process.exit(3); }, 8 * 60 * 1000).unref();
const within = (promise, ms, what) => Promise.race([promise, delay(ms).then(() => { throw new Error(`${what} did not finish within ${ms / 1000} s`); })]);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
let app,
  page,
  failure = null,
  passed = false;
// The tour speaks the host shell: PowerShell on Windows, $SHELL elsewhere (main/terminal.js shellSpec).
const POSIX = process.platform !== 'win32';
const shellLabel = POSIX ? (process.env.SHELL || '/bin/bash').split('/').pop() : 'PowerShell';
const runNode = (script, marker) => POSIX ? `'${process.execPath}' '${script}' '${marker}'` : `& '${process.execPath}' '${script}' '${marker}'`;
const appendOnce = counter => POSIX ? `printf 'once\n' >> '${counter}'` : `Add-Content -LiteralPath '${counter}' -Value once`;
let legacyData = null;
const trees = [],
  errors = [];
async function boot(managed = true, dataRoot = userData) {
  step('launching Electron');
  app = await electron.launch({
    executablePath: process.env.BARKDOWN_TEST_PACKAGED_EXE || require('electron'),
    args: [...(process.env.BARKDOWN_TEST_PACKAGED_EXE ? [] : [path.resolve('.')]), ...(managed ? ['--profiles'] : ['--legacy']), `--user-data=${dataRoot}`],
    recordVideo: { dir: out, size: { width: 1400, height: 900 } },
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ELECTRON_ENABLE_LOGGING: '1' },
  });
  // A cold machine (a hosted Windows runner, a first launch under a virus scanner) starts slowly: the
  // window and the loaded state get two minutes, and a failure says what the app printed. No diagnostic may hang.
  app.process().stderr?.on('data', chunk => note('main stderr: ' + chunk)); app.process().stdout?.on('data', chunk => note('main stdout: ' + chunk));
  app.on('window', w => note('window opened: ' + w.url()));
  step('the app process is up; waiting for the app window');
  // The app's window is the one showing renderer/index.html. On Windows the first page Playwright reports
  // has an empty address and goes away, so the window is chosen by what it shows, and main says what exists.
  const mainView = () => Promise.race([app.evaluate(({ BrowserWindow, webContents }) => ({ windows: BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().slice(-40), visible: w.isVisible(), title: w.getTitle() })), contents: webContents.getAllWebContents().map(c => `${c.getType()}:${c.getURL().slice(-30)}`) })).catch(e => ({ error: e.message })), delay(5000).then(() => ({ error: 'main did not answer in 5 s' }))]);
  page = null;
  for (let i = 0; i < 240 && !page; i++) {
    page = app.windows().find(w => !w.isClosed() && /renderer\/index\.html/.test(w.url())) || null;
    if (!page) { if (i % 20 === 0) step(`pages Playwright sees: [${app.windows().map(w => w.url() || '(empty)').join(', ')}]; main sees: ${JSON.stringify(await mainView())}`); await delay(500); }
  }
  if (!page) { report('the app window never appeared to Playwright'); throw new Error('the app window never appeared to Playwright'); }
  step('app window: ' + page.url().slice(-40));
  page.on('close', () => note('the app page closed'));
  page.on('pageerror', (e) => { errors.push(e.message); note('pageerror: ' + e.message); });
  page.on('console', message => note(`console ${message.type()}: ${message.text()}`));
  page.on('crash', () => note('the page crashed'));
  try { await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 120000 }); }
  catch (error) {
    const seen = await Promise.race([page.evaluate(() => ({ url: location.href, title: document.title, hasApp: Boolean(window.__barkdown), loaded: window.__barkdown?.state?.loaded, body: document.body?.innerText.slice(0, 300) })).catch(e => ({ evaluate: e.message })), delay(10000).then(() => ({ evaluate: 'no answer from the page in 10 s' }))]);
    report('boot did not reach the loaded state: ' + JSON.stringify(seen));
    throw error;
  }
  if (managed) await page.locator('.bw-terminal .bw-term-host').waitFor();
}
// A real terminal (C090): keystrokes go to the pty, the emulator's buffer is read through the controller.
const termCtl = () => page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'); return c ? { text: c.text(), session: Boolean(c.session()) } : null; });
const termText = async () => (await termCtl())?.text || '';
const typeInTerminal = async text => { await page.locator('.bw-terminal .bw-term-host').click(); await page.keyboard.type(text); };
// The shell must be up before keystrokes mean anything; a stopped shell is started with the tab's Start.
async function ensureShell() {
  for (let i = 0; i < 300; i++) { const c = await termCtl(); if (c?.session) return; if (c && /verified closed|Press Start/.test(c.text) && !c.session) { await page.locator('.bw-terminal [data-act="restart"]').click(); } await delay(100); }
  throw new Error('no shell in the terminal tab');
}
async function startTree(index) {
  const marker = path.join(folders[index], 'pids-' + trees.length + '.jsonl');
  await ensureShell();
  await typeInTerminal(runNode(script, marker) + '\r');
  for (
    let i = 0;
    i < 150 && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim().split('\n').length < 3);
    i++
  )
    await delay(100);
  assert.ok(fs.existsSync(marker), 'actual terminal command started');
  const pids = fs
    .readFileSync(marker, 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s).pid);
  assert.equal(pids.length, 3);
  const tree = { marker, pids };
  trees.push(tree);
  return tree;
}
try {
  step('launching the app');
  await boot();
  step('the app is loaded');
  for (let i = 0; i < 300 && !(await termText()).includes(shellLabel + ' in'); i++) await delay(100);
  assert.ok((await termText()).includes(shellLabel + ' in'), 'the shell banner names the shell');
  const sessionA = await page.evaluate(() => window.barkdown.term.status('same-terminal', 'same'));
  step('the shell banner is shown: ' + JSON.stringify((await termText()).slice(0, 200)));
  // What the pty really sends and what the emulator paints with: kept in the log for the platform at hand.
  await page.evaluate(() => { window.__raw = []; window.barkdown.term.onData(event => { if (event.type === 'data') window.__raw.push(event.data); }); });
  const ta = await startTree(0);
  step('a command ran in the shell and started its descendants');
  step('colours: ' + JSON.stringify(await page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'), t = c.terminal().options.theme || {}; return { engine: c.engine(), dataTheme: document.documentElement.dataset.theme, prefersDark: matchMedia('(prefers-color-scheme: dark)').matches, foreground: t.foreground, background: t.background, white: t.white, brightWhite: t.brightWhite, cssText: getComputedStyle(document.documentElement).getPropertyValue('--bw-text').trim(), cssTermBg: getComputedStyle(document.documentElement).getPropertyValue('--bw-term-bg').trim() }; })));
  step('pty bytes after the command: ' + JSON.stringify(await page.evaluate(() => window.__raw.join('').slice(0, 700))));
  step('terminal text: ' + JSON.stringify((await termText()).slice(-400)));
  desktopShot('desktop-a-running.png');
  await typeInTerminal('echo unsent A command'); // typed, not entered: it lives in the shell's line, as in any terminal
  await page.screenshot({ path: path.join(out, 'a-running.png') });
  await page.evaluate((folder) => window.__barkdown.setFolder(folder), folders[1]);
  assert.equal(
    await page.locator('.bw-terminal #path').getAttribute('title'),
    folders[0],
    'existing shell label keeps actual cwd',
  );
  await page.keyboard.press('Control+,');
  await page.locator('#profile-choice').selectOption(profiles[1]);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(
    (id) => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id,
    profiles[1],
  );
  assert.ok(
    ta.pids.every((p) => !alive(p)),
    'A descendants stop before B selection completes',
  );
  const foreign = await page.evaluate(async (session) => {
    try {
      await window.barkdown.term.input(session, 'echo wrong-owner');
      return null;
    } catch (e) {
      return e.message;
    }
  }, sessionA.session);
  assert.match(foreign, /no longer active/);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft');
  step('profile switch stopped A and refused the foreign session');
  const tb = await startTree(1);
  step('B has its own shell and descendants');
  await typeInTerminal('echo unsent B command'); // typed, not entered
  await page.screenshot({ path: path.join(out, 'b-running.png') });
  const mainPid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, mainPid);
  const exited = new Promise((resolve) => app.process().once('exit', resolve));
  process.kill(mainPid, 'SIGKILL');
  await within(exited, 30000, 'the killed app process exiting');
  step('the app was killed');
  app = null;
  await boot();
  for (let i = 0; i < 300 && !(await termText()).includes('process tree is verified closed'); i++) await delay(100);
  assert.ok((await termText()).includes('process tree is verified closed'));
  assert.ok(tb.pids.every((p) => !alive(p)));
  const before = fs.readFileSync(tb.marker + '.effects', 'utf8');
  await delay(200);
  assert.equal(fs.readFileSync(tb.marker + '.effects', 'utf8'), before);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft');
  await page.screenshot({ path: path.join(out, 'restart-stopped.png') });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.screenshot({ path: path.join(out, 'restart-narrow.png') });
  // A stopped shell is started explicitly; a command entered twice in a row runs once (the second Enter is an empty line).
  const counter=path.join(folders[1],'explicit-submit-count.txt');
  await ensureShell();
  await typeInTerminal(appendOnce(counter) + '\r\r');
  for(let i=0;i<100&&!fs.existsSync(counter);i++)await delay(50);
  assert.ok(fs.existsSync(counter));await delay(250);
  assert.deepEqual(fs.readFileSync(counter,'utf8').trim().split(/\r?\n/),['once'],'the command ran once');
  await page.screenshot({path:path.join(out,'explicit-start.png')});
  step('restart verified the old tree closed; an explicit start ran a command once');
  const tc = await startTree(1);
  await page.screenshot({ path: path.join(out, 'explicit-new-shell.png') });
  await within(app.close(), 60000, 'an ordinary quit with a running shell');
  app = null;
  step('an ordinary quit finished');
  assert.ok(
    tc.pids.every((p) => !alive(p)),
    'normal app quit drains descendants',
  );
  legacyData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-legacy-'));
  await boot(false, legacyData);
  await page.evaluate(folder => window.__barkdown.setFolder(folder), legacyData);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.locator('.bw-terminal .bw-term-host').waitFor();
  await ensureShell();
  await typeInTerminal('echo legacy-terminal-proof\r');
  for (let i = 0; i < 300 && (await termText()).split('legacy-terminal-proof').length < 3; i++) await delay(100);
  assert.ok((await termText()).split('legacy-terminal-proof').length >= 3, 'the legacy terminal ran the command');
  await page.screenshot({ path: path.join(out, 'legacy-terminal.png') });
  await within(app.close(), 60000, 'the legacy launch quitting');
  app = null;
  step('the legacy launch ran a command and quit');
  const legacyRoot = path.join(legacyData, 'barkdown');
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'terminal-sessions')));
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'terminal-owner.json')));
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'goal-processes')));
  const adoption = require('../main/profile-registry').createProfileRegistry(path.join(legacyData, 'adoption-proof'));
  const adopted = adoption.adoptLegacy({ legacyDir: legacyRoot });
  assert.ok(adopted.id, 'unchanged strict legacy adoption accepts actual terminal-used library');
  assert.deepEqual(errors, []);
  passed = true;
  console.log(JSON.stringify({ passed, userData, trees }));
} catch (error) {
  // Say why at once: a close that hangs afterwards must not swallow the reason.
  failure = String(error?.stack || error);
  step('FAILED: ' + failure.split('\n').slice(0, 3).join(' | '));
  console.error('FAILED:', failure);
  if (page && !page.isClosed()) console.error('terminal shows:\n' + await Promise.race([termText().catch(e => 'unreadable: ' + e.message), delay(5000).then(() => 'unreadable: timed out')]));
  process.exitCode = 1;
} finally {
  if(!passed&&page&&!page.isClosed())await Promise.race([page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}), delay(10000)]);
  // The app this test launched gets twenty seconds to quit; after that its own process is ended.
  if (app) { const child = app.process(); await Promise.race([app.close().catch(() => {}), delay(20000)]); if (child.exitCode === null && child.signalCode === null) { console.error('the app did not quit within 20 s; ending the process this test launched'); child.kill('SIGKILL'); await delay(1000); } }
  const stopped = [];
  for (const profileId of profiles) {
    const storeDir = registry.storeFor(profileId).storeDir,
      dir = path.join(storeDir, 'goal-processes');
    if (fs.existsSync(dir))
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.receipt.json'))) {
        const attemptId = file.replace('.receipt.json', '');
        stopped.push({
          profileId,
          attemptId,
          verified: await require('../main/goal-process').verifyOwnedWorker({ profileId, attemptId, storeDir }),
        });
      }
  }
  if (legacyData) {
    const storeDir = path.join(legacyData, 'terminal-runtime', 'legacy'),
      ownerFile = path.join(storeDir, 'terminal-owner.json');
    if (fs.existsSync(ownerFile)) {
      const { profileId } = JSON.parse(fs.readFileSync(ownerFile)),
        dir = path.join(storeDir, 'goal-processes');
      if (fs.existsSync(dir))
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.receipt.json'))) {
          const attemptId = file.replace('.receipt.json', '');
          stopped.push({
            profileId,
            attemptId,
            legacy: true,
            verified: await require('../main/goal-process').verifyOwnedWorker({ profileId, attemptId, storeDir }),
          });
        }
    }
  }
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    JSON.stringify(
      {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourceDirty: !!execFileSync(
          'git',
          ['status', '--porcelain', '--', 'main', 'renderer/src', 'tests', 'package.json'],
          { encoding: 'utf8' },
        ).trim(),
        capturedAt: new Date().toISOString(),
        userData,
        legacyData,
        passed,
        failure,
        errors,
        trees,
        stopped,
        reducedMotion: false,
        capture: `Actual Electron on ${process.platform}: a pty shell (node-pty) and native descendants; no provider or Barkpark runtime`,
      },
      null,
      2,
    ),
  );
  const allVerified = stopped.every((s) => s.verified);
  step(`cleanup: ${stopped.length} owned worker receipts, all verified stopped: ${allVerified}`);
  // Playwright's transport to a killed Electron can keep the event loop alive on Windows: leave explicitly.
  process.exit(allVerified && passed ? 0 : 1);
}
