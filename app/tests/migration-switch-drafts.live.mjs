// The Paper switch with Paper notes already open (C096): a note made on the local runtime before the switch
// is drafts.<id>, in a tab and in Pages. The switch must carry it through, and after a person's restart the
// note is still open and readable. Driven through the `barkdown` launcher; Full YOLO is clicked in Settings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.BARKDOWN_CONTROL_OUT || path.resolve(appRoot, '../docs/cycles/evidence/C096/live', new Date().toISOString().replace(/[:.]/g, '-') + '-switch-drafts');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-switch-drafts-')));
const folder = path.join(userData, 'work'); fs.mkdirSync(folder);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: appRoot, encoding: 'utf8' }).trim() !== '', host: `${process.platform} ${os.release()} ${process.arch}`, model: 'Scripted replies through the API SDK; not a real model', status: 'running', checks: [], screenshots: [], transcript: [] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = name => { report.checks.push(name); persist(); console.log('ok  ' + name); };
const seen = [];
const transport = await createToolFixture(body => { const last = body.messages.at(-1); const blocks = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content; seen.push(blocks.map(b => b.type)); const text = blocks.find(b => b.type === 'text')?.text || ''; return { text: `Scripted reply to: ${text.split('\n').at(-1).slice(0, 80)}` }; });
const watchdog = setTimeout(() => { console.error('wider tour: watchdog'); report.status = 'timeout'; persist(); process.exit(1); }, 14 * 60 * 1000);
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
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
const refused = async (code, pattern, ...argv) => { const r = await bd(...argv); assert.equal(r.code, code, `barkdown ${argv.join(' ')} → ${r.code}: ${r.err || r.out}`); if (pattern) assert.match(r.err, pattern); return r; };
const state = (fn, arg) => page.evaluate(fn, arg);
const paneText = () => page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
};
const fullYolo = async on => {
  await ok('ui', 'show', 'settings', 'assistant');
  if (await page.locator('#full-yolo').isChecked() !== on) await page.locator('.bw-settings label[for="full-yolo"]').click();
  await page.waitForFunction(on => window.__barkdown.state.settings.control?.fullYolo === on, on);
  await page.locator('.bw-settings [data-act="cancel"]').click();
};
try {
  await launch();
  await page.evaluate(async source => { window.__barkdown.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } }); document.documentElement.dataset.theme = 'dark'; await window.__barkdown.refreshLibrary(); }, source);
  await fullYolo(true);
  assert.equal((await json('paper', 'status')).status, 'none');
  await ok('agent', 'add', 'Desk', '--folder', folder);
  const note = await json('note', 'new', '# Field notes\n\nWritten before the switch.');
  assert.match(note.id, /^drafts\./, 'a note on the local runtime is drafts.<id>');
  await ok('note', 'page', note.id); await ok('favorite', 'add');
  await paneText().filter({ hasText: 'Written before the switch' }).waitFor();
  const placed = await state(id => { const s = window.__barkdown.state; return { tab: s.chats[s.current].tabs.some(t => t.type === 'doc' && t.path.at(-1) === id), page: JSON.stringify(s.pages || {}).includes(id), favorite: s.favorites.some(f => f.target.id === id) }; }, note.id);
  assert.deepEqual(placed, { tab: true, page: true, favorite: true });
  await shot('01-note-open-before-switch');
  check('a Paper note (drafts.<id>) is open in a tab, in Pages and in Favorites before the switch');
  const switched = await json('paper', 'switch');
  assert.equal(switched.status, 'selected');
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 120000 });
  check('paper switch completes with that note in the workspace');
  await app.close(); await launch();
  const notice = page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' });
  await notice.waitFor({ timeout: 60000 }); await notice.locator('[data-dismiss]').click();
  assert.equal((await json('paper', 'status')).status, 'selected');
  await page.waitForFunction(id => { const s = window.__barkdown.state; return Object.values(s.chats).some(c => c.tabs?.some(t => t.type === 'doc' && t.path.at(-1) === id)); }, note.id);
  await ok('chat', 'open', 'Desk');
  await paneText().filter({ hasText: 'Written before the switch' }).waitFor({ timeout: 60000 });
  assert.match((await json('note', 'read', note.id)).text, /Written before the switch/);
  assert.ok(await state(id => JSON.stringify(window.__barkdown.state.pages || {}).includes(id) && window.__barkdown.state.favorites.some(f => f.target.id === id), note.id), 'Pages and Favorites keep the note');
  await shot('02-note-open-after-restart');
  check('after a person\'s restart the library is on Paper and the note is still open, in Pages and in Favorites');
  assert.deepEqual(transport.errors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); console.error(error); try { await shot('failure'); } catch {} process.exitCode = 1; }
finally { persist(); clearTimeout(watchdog); try { await app?.close(); } catch {} await transport.close(); console.log(`${report.status}: ${report.checks.length} checks · ${out}`); process.exit(process.exitCode || 0); }
