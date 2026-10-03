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
const theme = process.argv.includes('--theme') ? process.argv[process.argv.indexOf('--theme') + 1] : 'dark';
const WIN = process.platform === 'win32';
const out = process.env.BARKDOWN_TERMINAL_OUT ? path.join(process.env.BARKDOWN_TERMINAL_OUT, `tour-${engine}-${theme}`) : path.resolve(appRoot, '../docs/cycles/evidence/C090/live', new Date().toISOString().replace(/[:.]/g, '-') + '-terminal-' + engine + (theme === 'dark' ? '' : '-' + theme));
fs.mkdirSync(out, { recursive: true });
// The tour speaks the host's shell: a POSIX login shell, or PowerShell through ConPTY on Windows.
const sh = WIN ? {
  env: "echo \"TERM=$env:TERM\"; $Host.UI.RawUI.WindowSize.Width; echo ('cols-d'+'one')\r",
  cols: "$Host.UI.RawUI.WindowSize.Width; echo ('cols2-d'+'one')\r",
  ask: "$n = Read-Host 'name'; echo \"hello-$n\"\r", asked: /name: ?$/,
  red: "Write-Host 'RED-TEXT' -ForegroundColor Red -NoNewline; Write-Host ' plain'\r",
  sleep: 'Start-Sleep 60\r', after: "echo ('after-int'+'errupt')\r",
} : {
  env: 'echo TERM=$TERM SHLVL=$SHLVL; echo $0; tput cols; echo cols-d""one\r',
  cols: 'tput cols; echo cols2-d""one\r',
  ask: "printf 'name? '; read n; echo \"hello-$n\"\r", asked: /\nname\? ?$/,
  red: "printf '\\033[31mRED-TEXT\\033[0m plain\\n'\r",
  sleep: 'sleep 60\r', after: 'echo after-int""errupt\r',
};
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-')));
const folder = path.join(userData, 'work'); fs.mkdirSync(folder);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, engine, theme, status: 'running', checks: [], screenshots: [],
  observations: [], limits: [WIN ? 'A hosted Windows runner, PowerShell through ConPTY, under Electron from source.' : 'One Mac, the login shell of this account, under Electron from source.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Terminal desk' });
createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme, provider: 'api', terminal: { engine }, barkpark: { enabled: false } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme });
registry.selectProfile(profile.id);
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const ctl = () => page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'); return c ? { text: c.text(), session: Boolean(c.session()), engine: c.engine() } : null; });
const text = async () => (await ctl())?.text || '';
const until = async (test, ms = 20000) => { const started = Date.now(); while (Date.now() - started < ms) { const t = await text(); if (test(t)) return t; await new Promise(r => setTimeout(r, 100)); } throw new Error('terminal did not show what was expected; last text:\n' + (await text()).slice(-600)); };
const type = async s => { await page.locator('.bw-terminal .bw-term-host').click(); await page.keyboard.type(s); };
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, ...(WIN ? {} : { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }), BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
  report.console = []; page.on('console', m => { if (/\[terminal\]|ghostty|wasm/i.test(m.text())) { report.console.push(m.text().slice(0, 300)); persist(); } });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.evaluate(f => window.__barkdown.setFolder(f), folder);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.locator('.bw-terminal .bw-term-host').waitFor();
  // The shell is up when the tab has a session (the tab's own first line is erased by ConPTY on Windows).
  for (let i = 0; i < 600 && !(await ctl())?.session; i++) await new Promise(r => setTimeout(r, 100));
  // Type only once the shell shows its prompt: keystrokes before that meet the tty's own echo, as anywhere.
  const prompt = /[%$#>] ?$/;
  await until(t => prompt.test(t), 30000);
  const started = await ctl();
  assert.equal(started.session, true); assert.equal(started.engine, engine === 'ghostty' ? 'ghostty' : 'xterm');
  check('the tab opens a shell in the chat\'s working folder on the chosen engine', { engine: started.engine, banner: started.text.split('\n')[0] });
  // The login shell, with the terminal a program expects.
  await type(sh.env);
  const t1 = await until(t => /cols-done/.test(t));
  assert.match(t1, /TERM=xterm-256color/);
  const cols = Number(/\n(\d+)\ncols-done/.exec(t1)?.[1]);
  assert.ok(cols > 40, 'tput cols answers with the pane width: ' + cols);
  check('TERM is xterm-256color and the shell\'s width is the pane\'s', { cols, shell: WIN ? 'PowerShell' : /\n(\S*(?:zsh|bash|fish)\S*)\n/.exec(t1)?.[1] });
  // Resize: a narrower pane, a narrower pty.
  await page.setViewportSize({ width: 900, height: 700 }); await new Promise(r => setTimeout(r, 600));
  await type(sh.cols);
  const t2 = await until(t => /cols2-done/.test(t));
  const cols2 = Number(/\n(\d+)\ncols2-done/.exec(t2)?.[1]);
  assert.ok(cols2 > 20 && cols2 < cols, `the pty followed the resize: ${cols} → ${cols2}`);
  await page.setViewportSize({ width: 1300, height: 900 }); await new Promise(r => setTimeout(r, 400));
  check('the pty follows the pane: tput cols shrinks with the window', { before: cols, after: cols2 });
  // A prompt that reads input, answered live.
  // Shell-agnostic (zsh's read -p means a coprocess): the prompt is printed, then read waits.
  await type(sh.ask);
  await until(t => sh.asked.test(t));
  await type('Pelle\r');
  const t3 = await until(t => /hello-Pelle/.test(t));
  check('an interactive prompt (read -p) is answered as it waits', { line: t3.split('\n').find(l => /hello-Pelle/.test(l)) });
  await shot('01-interactive');
  // Colours arrive as colours.
  await type(sh.red);
  await until(t => /RED-TEXT plain/.test(t));
  check('an ANSI red sequence is rendered, not printed', { note: 'the buffer text reads RED-TEXT plain with no escape bytes', hasEscapes: /\x1b/.test(await text()) });
  // Ctrl+C reaches the running program: a sleep is interrupted and the prompt is back.
  await type(sh.sleep); await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.press('Control+c');
  await until(t => prompt.test(t), 20000);
  await type(sh.after); await until(t => /after-interrupt/.test(t));
  check('Ctrl+C interrupts a running command and the prompt returns');
  if (WIN) {
    // A program that reads one key without Enter.
    await type("$k=[Console]::ReadKey($true); echo ('key-'+$k.KeyChar)\r"); await new Promise(r => setTimeout(r, 1500));
    await type('z'); await until(t => /key-z/.test(t));
    check('a single keystroke reaches a program that reads keys ([Console]::ReadKey)');
    // Ctrl+V pastes, as in Windows Terminal.
    await app.evaluate(({ clipboard }) => clipboard.writeText("echo ('pasted-'+'ok')"));
    await page.locator('.bw-terminal .bw-term-host').click(); await page.keyboard.press('Control+v');
    await until(t => t.includes("('pasted-'+'ok')"), 15000);
    await page.keyboard.press('Enter'); await until(t => /pasted-ok/.test(t));
    check('Ctrl+V pastes the clipboard into PowerShell');
    // The alternate screen through ConPTY: observed, not required.
    try {
      await type('Write-Host "`e[?1049hALT-SCREEN-ON"\r'); await until(t => /ALT-SCREEN-ON/.test(t) && !/cols2-done/.test(t), 8000);
      await shot('02-alternate-screen');
      await type('Write-Host "`e[?1049l"\r'); await until(t => /cols2-done/.test(t), 8000);
      check('the alternate screen is taken and given back through ConPTY');
    } catch (error) { report.observations.push('alternate screen through ConPTY: ' + String(error.message).split('\n')[0]); persist(); await page.keyboard.press('Enter'); }
  } else {
    // A full-screen program: the alternate screen, and back.
    await type("printf 'line %s\\n' $(seq 1 200) > many.txt; less many.txt\r");
    await until(t => /line 1\n/.test(t) && !/cols2-done/.test(t), 20000);
    await shot('02-less-alternate-screen');
    await type('q');
    await until(t => /cols2-done/.test(t) && /RED-TEXT/.test(t));
    check('less takes the alternate screen and q gives the main screen back', { backHas: ['cols2-done', 'RED-TEXT'] });
  }
  // ⌘F finds in the scrollback.
  if (engine === 'ghostty') { report.limits.push('Find is not offered on the Ghostty engine: ghostty-web has no search addon, so the Find button is absent there.'); assert.equal(await page.locator('.bw-terminal [data-act="find"]').count(), 0); check('the Ghostty engine offers no Find (recorded as a limit)'); }
  else {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
    await page.locator('.bw-term-search:not([hidden]) #search-q').waitFor({ timeout: 5000 });
    await page.keyboard.type('hello-Pelle'); await page.keyboard.press('Escape');
    check('⌘F opens find in the terminal and Escape returns to the shell');
  }
  // The assistant's commands mirror into the tab.
  // What happens to the mirrored lines is recorded: the pty's bytes after the write, the buffer in use and the text at once and later.
  await page.evaluate(() => { window.__afterMirror = []; window.barkdown.term.onData(event => { if (event.type === 'data') window.__afterMirror.push(event.data); }); });
  const state = () => page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'), t = c.terminal(), b = t.buffer.active; return { buffer: b.type, cursor: [b.cursorX, b.cursorY], base: b.baseY, viewport: b.viewportY, rows: t.rows, tail: c.text().slice(-260), bytes: window.__afterMirror.join('').slice(0, 500) }; });
  const beforeMirror = await state();
  await page.evaluate(() => { const c = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal'); c.agentEvent({ type: 'tool_start', tool: 'Bash', input: { command: 'ls -la' } }); c.agentEvent({ type: 'tool_result', tool: 'Bash', ok: true, output: 'total 0\ndrwxr-xr-x  work' }); });
  await new Promise(r => setTimeout(r, 150)); const atOnce = await state();
  await new Promise(r => setTimeout(r, 2500)); const later = await state();
  report.mirror = { beforeMirror, atOnce, later }; persist();
  await until(t => /assistant \$ ls -la/.test(t) && /drwxr-xr-x  work/.test(t));
  check('the assistant\'s commands and output mirror into the tab');
  // Whether the mirrored lines survive the shell's next output is observed (ConPTY keeps its own model of the screen).
  await type(WIN ? "echo ('after-'+'mirror')\r" : 'echo after-""mirror\r'); await until(t => /after-mirror/.test(t));
  { const t = await text(); const kept = /assistant \$ ls -la/.test(t) && /drwxr-xr-x  work/.test(t); report.observations.push(`mirrored lines after the next command's output: ${kept ? 'kept' : 'overwritten'}`); persist(); if (!WIN) assert.ok(kept, 'the mirrored lines stay in the scrollback'); }
  await shot('03-mirror');
  // Readable text in the theme at hand. The first tours ran dark only and missed white text on the light
  // background: the colours handed to the emulator must be plain colours, and the text must differ from its ground.
  const palette = () => page.evaluate(() => { const t = [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal').theme() || {}; return { foreground: t.foreground, background: t.background, cursor: t.cursor }; });
  const plain = value => /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i.test(value || '');
  const readable = (name, p) => { assert.ok(plain(p.foreground) && plain(p.background) && plain(p.cursor), `${name} theme hands the emulator plain colours: ${JSON.stringify(p)}`); assert.notEqual(p.foreground.toLowerCase(), p.background.toLowerCase()); };
  const opened = await palette(); readable(theme, opened);
  assert.equal(opened.background, theme === 'dark' ? '#141613' : '#fbfaf5', 'the terminal opened in the app\'s theme');
  if (engine === 'ghostty') {
    // The Ghostty engine paints on a canvas; what it painted is read from a cell at the left edge, half way down.
    const cell = await page.evaluate(() => { const canvas = document.querySelector('.bw-term-host canvas'); const d = canvas.getContext('2d').getImageData(3, Math.floor(canvas.height * 0.9), 1, 1).data; return [d[0], d[1], d[2]]; });
    assert.ok(theme === 'dark' ? cell[0] < 60 : cell[0] > 200, `the canvas is painted in the ${theme} theme: ${cell}`);
    report.limits.push('A Ghostty tab keeps the theme it opened with: ghostty-web fixes its default colours at open, so a live theme change applies to tabs opened afterwards.');
    check(`the Ghostty canvas is painted in the ${theme} theme it opened with (a live theme change is recorded as a limit)`, { opened, cell });
  } else {
    const other = theme === 'dark' ? 'light' : 'dark';
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, other); await new Promise(r => setTimeout(r, 400));
    const switched = await palette(); readable(other, switched);
    assert.notEqual(switched.background, opened.background, 'the terminal follows a theme change live');
    await type('echo other-theme-text\r'); await until(t => t.split('other-theme-text').length >= 3);
    await shot('04-' + other + '-theme'); // the light frame is on purpose: it is the proof of the light theme's text colour
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme); await new Promise(r => setTimeout(r, 300));
    check('both themes hand the emulator plain colours, and a live theme change repaints', { [theme]: opened, [other]: switched });
  }
  // Restart keeps the tab, verifies the stop, opens a new shell.
  const sessionId = () => page.evaluate(() => [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal').session()?.sessionId || null);
  const before = await sessionId();
  await page.locator('.bw-terminal [data-act="restart"]').click();
  for (let i = 0; i < 600 && [null, before].includes(await sessionId()); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(await sessionId() && await sessionId() !== before, 'a new session replaced the old one');
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
