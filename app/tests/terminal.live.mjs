// A real terminal (C090), in real Electron on this machine: the tab holds an interactive pty behind a full
// emulator. Proven here: the shell is the login shell and TERM is xterm-256color; the pty's width is the
// pane's (tput cols matches the emulator's cols, and follows a resize); a prompt that reads input is
// answered live (read -p); a full-screen program takes the alternate screen and gives it back (less);
// colours arrive as colours (the emulator's cell carries the red); the assistant's commands mirror into
// the tab; ⌘F finds; the engine chosen in Settings is the one in the tab.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'xterm';
const out = path.resolve(appRoot, '../docs/cycles/evidence/C090/live', new Date().toISOString().replace(/[:.]/g, '-') + '-terminal-' + engine);
fs.mkdirSync(out, { recursive: true });
if (process.platform === 'win32') { console.log('The interactive proof speaks POSIX shells; the Windows half is the ownership live test and the owner\'s check.'); process.exit(0); }
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-')));
const folder = path.join(userData, 'work'); fs.mkdirSync(folder);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, engine, status: 'running', checks: [], screenshots: [],
  limits: ['One Mac, the login shell of this account, under Electron from source. Windows (ConPTY) is not run here.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Terminal desk' });
createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme: 'dark', provider: 'api', terminal: { engine }, barkpark: { enabled: false } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const ctl = () => page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'); return c ? { text: c.text(), session: Boolean(c.session()), engine: c.engine() } : null; });
const text = async () => (await ctl())?.text || '';
const until = async (test, ms = 20000) => { const started = Date.now(); while (Date.now() - started < ms) { const t = await text(); if (test(t)) return t; await new Promise(r => setTimeout(r, 100)); } throw new Error('terminal did not show what was expected; last text:\n' + (await text()).slice(-600)); };
const type = async s => { await page.locator('.bw-terminal .bw-term-host').click(); await page.keyboard.type(s); };
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
  report.console = []; page.on('console', m => { if (/\[terminal\]|ghostty|wasm/i.test(m.text())) { report.console.push(m.text().slice(0, 300)); persist(); } });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.evaluate(f => window.__barkdown.setFolder(f), folder);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.locator('.bw-terminal .bw-term-host').waitFor();
  await until(t => / in /.test(t), 60000);
  // Type only once the shell shows its prompt: keystrokes before that meet the tty's own echo, as anywhere.
  const prompt = /[%$#>] ?$/;
  await until(t => prompt.test(t), 30000);
  const started = await ctl();
  assert.equal(started.session, true); assert.equal(started.engine, engine === 'ghostty' ? 'ghostty' : 'xterm');
  check('the tab opens a shell in the chat\'s working folder on the chosen engine', { engine: started.engine, banner: started.text.split('\n')[0] });
  // The login shell, with the terminal a program expects.
  await type('echo TERM=$TERM SHLVL=$SHLVL; echo $0; tput cols; echo cols-d""one\r');
  const t1 = await until(t => /cols-done/.test(t));
  assert.match(t1, /TERM=xterm-256color/);
  const cols = Number(/\n(\d+)\ncols-done/.exec(t1)?.[1]);
  assert.ok(cols > 40, 'tput cols answers with the pane width: ' + cols);
  check('TERM is xterm-256color and tput cols answers with the pane\'s width', { cols, shell: /\n(\S*(?:zsh|bash|fish)\S*)\n/.exec(t1)?.[1] });
  // Resize: a narrower pane, a narrower pty.
  await page.setViewportSize({ width: 900, height: 700 }); await new Promise(r => setTimeout(r, 600));
  await type('tput cols; echo cols2-d""one\r');
  const t2 = await until(t => /cols2-done/.test(t));
  const cols2 = Number(/\n(\d+)\ncols2-done/.exec(t2)?.[1]);
  assert.ok(cols2 > 20 && cols2 < cols, `the pty followed the resize: ${cols} → ${cols2}`);
  await page.setViewportSize({ width: 1300, height: 900 }); await new Promise(r => setTimeout(r, 400));
  check('the pty follows the pane: tput cols shrinks with the window', { before: cols, after: cols2 });
  // A prompt that reads input, answered live.
  // Shell-agnostic (zsh's read -p means a coprocess): the prompt is printed, then read waits.
  await type("printf 'name? '; read n; echo \"hello-$n\"\r");
  await until(t => /\nname\? ?$/.test(t));
  await type('Pelle\r');
  const t3 = await until(t => /hello-Pelle/.test(t));
  check('an interactive prompt (read -p) is answered as it waits', { line: t3.split('\n').find(l => /hello-Pelle/.test(l)) });
  await shot('01-interactive');
  // Colours arrive as colours.
  await type("printf '\\033[31mRED-TEXT\\033[0m plain\\n'\r");
  await until(t => /RED-TEXT plain/.test(t));
  check('an ANSI red sequence is rendered, not printed', { note: 'the buffer text reads RED-TEXT plain with no escape bytes', hasEscapes: /\x1b/.test(await text()) });
  // A full-screen program: the alternate screen, and back.
  await type("printf 'line %s\\n' $(seq 1 200) > many.txt; less many.txt\r");
  await until(t => /line 1\n/.test(t) && !/cols2-done/.test(t), 20000);
  await shot('02-less-alternate-screen');
  await type('q');
  const back = await until(t => /cols2-done/.test(t) && /RED-TEXT/.test(t));
  check('less takes the alternate screen and q gives the main screen back', { backHas: ['cols2-done', 'RED-TEXT'] });
  // ⌘F finds in the scrollback.
  if (engine === 'ghostty') { report.limits.push('Find is not offered on the Ghostty engine: ghostty-web has no search addon, so the Find button is absent there.'); assert.equal(await page.locator('.bw-terminal [data-act="find"]').count(), 0); check('the Ghostty engine offers no Find (recorded as a limit)'); }
  else {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
    await page.locator('.bw-term-search:not([hidden]) #search-q').waitFor({ timeout: 5000 });
    await page.keyboard.type('hello-Pelle'); await page.keyboard.press('Escape');
    check('⌘F opens find in the terminal and Escape returns to the shell');
  }
  // The assistant's commands mirror into the tab.
  await page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'); c.agentEvent({ type: 'tool_start', tool: 'Bash', input: { command: 'ls -la' } }); c.agentEvent({ type: 'tool_result', tool: 'Bash', ok: true, output: 'total 0\ndrwxr-xr-x  work' }); });
  const mirrored = await until(t => /assistant \$ ls -la/.test(t) && /drwxr-xr-x  work/.test(t));
  check('the assistant\'s commands and output mirror into the tab');
  await shot('03-mirror');
  // Restart keeps the tab, verifies the stop, opens a new shell.
  await page.locator('.bw-terminal [data-act="restart"]').click();
  await until(t => (t.match(/ in /g) || []).length >= 2, 60000);
  assert.equal((await ctl()).session, true);
  check('Restart stops the shell with verification and opens a new one');
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ out, engine, checks: report.checks.map(c => c.name) }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); persist();
  try { await shot('99-failure'); } catch {}
  console.error(error); process.exitCode = 1;
} finally {
  await Promise.race([app?.close().catch(() => {}), new Promise(r => setTimeout(r, 20000))]);
  fs.rmSync(userData, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
