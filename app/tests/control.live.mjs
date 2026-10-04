// Barkdown controlling itself (C094), in real Electron with an owned local library: the `barkdown` command
// the app writes at start drives the window the way a person does, and the assistant's `app` tool goes
// through the same gate. Model replies are scripted (the API SDK over a local fixture); nothing here is a
// claim about a real model. The Full YOLO switch is clicked in Settings, as a person does: no command can.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.BARKDOWN_CONTROL_OUT || path.resolve(appRoot, '../docs/cycles/evidence/C094/live', new Date().toISOString().replace(/[:.]/g, '-') + '-control');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-control-live-')));
const folder = path.join(userData, 'work'); fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'README.md'), '# Work\n');
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: appRoot, encoding: 'utf8' }).trim() !== '', host: `${process.platform} ${os.release()} ${process.arch}`, model: 'Scripted replies through the API SDK; not a real model', status: 'running', checks: [], screenshots: [], transcript: [] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = name => { report.checks.push(name); persist(); console.log('ok  ' + name); };
const transport = await createToolFixture(body => { const last = body.messages.at(-1); const text = typeof last.content === 'string' ? last.content : (last.content.find(b => b.type === 'text')?.text || ''); return { text: `Scripted reply to: ${text.split('\n').at(-1).slice(0, 80)}` }; });
const site = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Control fixture</title><h1>A page the command opened</h1>'); });
await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
const siteUrl = `http://127.0.0.1:${site.address().port}/`;
const watchdog = setTimeout(() => { console.error('control tour: watchdog'); report.status = 'timeout'; persist(); process.exit(1); }, 9 * 60 * 1000);
let app, page, client;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
// The command a person would type: the launcher the app wrote, on the app's own runtime.
const launcher = path.join(userData, 'bin', process.platform === 'win32' ? 'barkdown.cmd' : 'barkdown');
const bd = (...argv) => new Promise(resolve => {
  const env = { ...process.env }; delete env.BARKDOWN_CONTROL;
  const child = spawn(launcher, ['--user-data', userData, ...argv], { env, shell: process.platform === 'win32' }); let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => { report.transcript.push({ command: 'barkdown ' + argv.join(' '), code, out: (stdout || stderr).trim().slice(0, 700) }); persist(); resolve({ code, out: stdout, err: stderr }); });
  child.stdin.end();
});
const ok = async (...argv) => { const r = await bd(...argv); assert.equal(r.code, 0, `barkdown ${argv.join(' ')}: ${r.err || r.out}`); return r.out; };
const json = async (...argv) => JSON.parse(await ok(...argv, '--json')).result;
const state = fn => page.evaluate(fn);
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(async source => { window.__barkdown.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } }); document.documentElement.dataset.theme = 'dark'; await window.__barkdown.refreshLibrary(); }, source);

  // ---- looking
  const status = await json('status');
  assert.equal(status.app, 'Barkdown'); assert.equal(status.fullYolo, false); assert.equal(status.pid, app.process().pid);
  check('status: the command finds the running app and Full YOLO is off at first');
  const overview = await ok();
  assert.match(overview, /chat new/); assert.match(overview, /settings set .*\[needs Full YOLO\]/);
  fs.writeFileSync(path.join(out, 'barkdown-help.txt'), overview);
  check('the overview lists every command and marks what needs Full YOLO');

  // ---- an agent is a chat: add one, with a folder and a first message, and wait for its reply
  const added = await json('agent', 'add', 'Helper', '--folder', folder, '--message', 'Say hello to the desk', '--wait');
  assert.match(added.text, /Scripted reply to: Say hello to the desk/);
  assert.equal(await state(() => window.__barkdown.state.chats[window.__barkdown.state.current].title), 'Helper');
  await page.locator('#bw-transcript', { hasText: 'Scripted reply to: Say hello to the desk' }).waitFor();
  check('agent add: a new chat with its folder, a first message, and the reply read back');
  const again = await json('chat', 'send', 'And a second question', '--chat', 'Helper', '--wait');
  assert.match(again.text, /Scripted reply to: And a second question/);
  const read = await ok('chat', 'read', 'Helper', '--last', '2');
  assert.match(read, /You: And a second question/); assert.match(read, /Assistant: Scripted reply/);
  const chats = await json('chat', 'list');
  assert.ok(chats.some(c => c.title === 'Helper' && c.folder === folder && c.current));
  await json('chat', 'set', '--chat', 'Helper', '--model', 'claude-sonnet-5-5', '--effort', 'low');
  assert.equal(await state(() => { const s = window.__barkdown.state; return s.chats[s.current].model; }), 'claude-sonnet-5-5');
  await ok('chat', 'rename', 'Helper', 'Desk helper');
  await page.locator('#bw-sidebar', { hasText: 'Desk helper' }).waitFor();
  check('chat send / read / list / set / rename act on the chat a person sees');
  await shot('01-agent-added');

  // ---- notes
  const note = await json('note', 'new', '# Notes from the command line\n\nWritten by `barkdown note new`.\n\n- first\n- second');
  assert.equal(note.title, 'Notes from the command line');
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Written by' }).waitFor();
  const noteText = await ok('note', 'read', 'Notes from the command line');
  assert.match(noteText, /Written by `barkdown note new`/); assert.match(noteText, /- first/);
  assert.ok((await json('note', 'list')).some(n => n.id === note.id));
  await ok('note', 'page', note.id);
  await page.locator('#bw-sidebar', { hasText: 'Notes from the command line' }).waitFor();
  check('note new / read / list / page: a note with its text, open beside the chat and in Pages');
  await shot('02-note-created');

  // ---- work tabs and the terminal
  const web = await json('tab', 'open', 'web', siteUrl);
  assert.equal(web.type, 'web');
  await page.waitForFunction(id => window.__barkdown.controllers.get(id)?.webContentsId?.() != null, web.id);
  let tabs = await json('tab', 'list');
  assert.ok(tabs.some(t => t.id === web.id && t.active && t.url === siteUrl)); assert.ok(tabs.some(t => t.type === 'doc'));
  await ok('favorite', 'add');
  assert.ok((await json('favorite', 'list')).some(f => f.kind === 'web' && f.where === siteUrl));
  await ok('tab', 'activate', '1'); assert.ok((await json('tab', 'list'))[0].active);
  const terminalTab = await json('tab', 'open', 'terminal');
  await ok('tab', 'rename', terminalTab.id, 'Shell'); assert.ok((await json('tab', 'list')).some(t => t.title === 'Shell'));
  await ok('tab', 'close', web.id);
  tabs = await json('tab', 'list'); assert.ok(!tabs.some(t => t.type === 'web'));
  check('tab open / activate / rename / list / close and favorite add work on the chat\'s tabs');
  const ran = await ok('terminal', 'run', 'echo ctl-$((40+2))', '--wait', '3');
  assert.match(ran, /ctl-42/);
  // Inside the app's own terminal the command is on the path and finds the app without being told where.
  const inside = await ok('terminal', 'run', 'barkdown status | grep -c "app: Barkdown" | sed "s/^/found-/"', '--wait', '6');
  assert.match(inside, /found-1/);
  assert.match(await ok('terminal', 'read', '--lines', '30'), /ctl-42/);
  check('terminal run / read: the terminal tab runs a command, and `barkdown` works inside it');
  await shot('03-terminal');

  // ---- what needs Full YOLO is refused, and what is never a command stays refused
  for (const argv of [['settings', 'set', 'theme', 'light'], ['profile', 'create', 'Second desk'], ['chat', 'delete', 'Desk helper']]) { const r = await bd(...argv); assert.equal(r.code, 4, argv.join(' ')); assert.match(r.err, /Full YOLO/); }
  assert.equal(await json('settings', 'get', 'theme'), 'dark');
  for (const argv of [['fullyolo', 'on'], ['app', 'quit'], ['app', 'relaunch'], ['updates', 'install']]) { const r = await bd(...argv); assert.equal(r.code, 4, argv.join(' ')); }
  assert.equal((await json('status')).fullYolo, false);
  check('without Full YOLO: settings, profiles and deletions are refused; the switch, quit and restart are never commands');

  // ---- a person switches Full YOLO on, in Settings
  await ok('ui', 'show', 'settings', 'assistant');
  const yolo = page.locator('.bw-settings label[for="full-yolo"]');
  await yolo.scrollIntoViewIfNeeded(); await shot('04-settings-full-yolo-off');
  await yolo.click();
  await page.waitForFunction(() => document.querySelector('#full-yolo')?.checked && window.__barkdown.state.settings.control?.fullYolo === true);
  assert.equal((await json('status')).fullYolo, true);
  await shot('05-settings-full-yolo-on');
  await page.locator('.bw-settings [data-act="cancel"]').click();
  check('a person turns Full YOLO on with the switch in Settings › Assistant');
  await ok('settings', 'set', 'theme', 'light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await ok('settings', 'set', 'theme', 'dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await ok('settings', 'set', 'approvals', 'ask'); assert.equal(await json('settings', 'get', 'approvals'), 'ask'); await ok('settings', 'set', 'approvals', 'none');
  const second = await json('profile', 'create', 'Second desk');
  assert.ok((await json('profile', 'list')).some(p => p.id === second.id && !p.selected));
  await ok('chat', 'new', 'Scratch'); await ok('chat', 'delete', 'Scratch');
  assert.ok(!(await json('chat', 'list')).some(c => c.title === 'Scratch'));
  check('with Full YOLO: settings change live, a profile is created, a chat is deleted');
  for (const argv of [['settings', 'set', 'control.fullYolo', 'false'], ['fullyolo', 'off'], ['app', 'quit'], ['settings', 'set', 'apiKey', 'x']]) { const r = await bd(...argv); assert.equal(r.code, 4, argv.join(' ')); }
  assert.equal((await json('status')).fullYolo, true);
  assert.equal(app.process().exitCode, null);
  check('with Full YOLO on, Barkdown still cannot switch Full YOLO, quit, or write a secret');

  // ---- the assistant's own way in: the `app` tool on the bridge each run is given
  const chatId = await state(() => window.__barkdown.state.current);
  const spec = await page.evaluate(id => window.barkdown.browser.bridge(id), chatId);
  client = new Client({ name: 'control-tour', version: '0' });
  await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'pipe' }));
  const names = (await client.listTools()).tools.map(t => t.name);
  assert.ok(names.includes('app') && names.includes('app_commands'));
  const tool = async (name, args) => { const r = await client.callTool({ name, arguments: args }); return { error: Boolean(r.isError), text: r.content.map(c => c.text).join('\n') }; };
  assert.match((await tool('app_commands', { group: 'chat' })).text, /chat\.new/);
  const spawned = await tool('app', { command: 'chat.new', args: { title: 'Started by an assistant', message: 'Summarise the README', wait: true } });
  assert.equal(spawned.error, false, spawned.text); assert.match(spawned.text, /Scripted reply to: Summarise the README/);
  assert.equal(await state(() => window.__barkdown.state.current), chatId, 'an assistant\'s helper chat does not take the view from the person');
  await page.locator('#bw-sidebar', { hasText: 'Started by an assistant' }).waitFor();
  const own = await tool('app', { command: 'tab.list' });
  assert.equal(own.error, false); assert.match(own.text, /Notes from the command line/, 'a command without a chat means the assistant\'s own chat, not the one in view');
  for (const command of ['fullyolo.off', 'app.quit']) { const r = await tool('app', { command }); assert.equal(r.error, true); assert.match(r.text, /\[forbidden\]/); }
  const selfSend = await tool('app', { command: 'chat.send', args: { message: 'to myself' } }); assert.equal(selfSend.error, true);
  check('the assistant\'s app tool: starts a helper chat and reads its reply; its own chat is the default; the switch and quit are refused');
  await shot('06-assistant-started-a-chat');

  // ---- the person switches it off again; the assistant and the command are back to everyday work
  await ok('ui', 'show', 'settings', 'assistant');
  await page.locator('.bw-settings label[for="full-yolo"]').click();
  await page.waitForFunction(() => window.__barkdown.state.settings.control?.fullYolo === false);
  await page.locator('.bw-settings [data-act="cancel"]').click();
  const denied = await tool('app', { command: 'settings.set', args: { key: 'theme', value: 'light' } });
  assert.equal(denied.error, true); assert.match(denied.text, /full_yolo_required/);
  assert.equal((await bd('settings', 'set', 'theme', 'light')).code, 4);
  const log = await json('log', '--limit', '50');
  assert.ok(log.some(e => e.command === 'settings.set' && e.ok && e.origin === 'cli')); assert.ok(log.some(e => e.command === 'chat.new' && e.origin === 'assistant'));
  fs.writeFileSync(path.join(out, 'control-log.json'), JSON.stringify(log, null, 2) + '\n');
  check('Full YOLO off again: administrative commands are refused for both callers; the log names who did what');
  assert.deepEqual(transport.errors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); console.error(error); try { await shot('failure'); } catch {} process.exitCode = 1; }
finally { persist(); clearTimeout(watchdog); try { await client?.close(); } catch {} try { await app?.close(); } catch {} await transport.close(); site.close(); console.log(`${report.status}: ${report.checks.length} checks · ${out}`); process.exit(process.exitCode || 0); }
