// The wider catalogue (C095), in real Electron with an owned local library: the `barkdown` command the app
// writes edits, undoes, deletes and recovers notes, sends images, gives a chat a goal, exports and imports
// the profile, reads the Paper switch and asks a provider whether it is signed in. Model replies are
// scripted (the API SDK over a local fixture). Full YOLO is clicked in Settings, as a person does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
import { tinyPng } from './png.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.BARKDOWN_CONTROL_OUT || path.resolve(appRoot, '../docs/cycles/evidence/C095/live', new Date().toISOString().replace(/[:.]/g, '-') + '-wider');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-control-wider-')));
const folder = path.join(userData, 'work'); fs.mkdirSync(folder);
const image = path.join(folder, 'red.png'); fs.writeFileSync(image, tinyPng(4, 4, [220, 40, 40]));
const notImage = path.join(folder, 'red.png.txt'); fs.writeFileSync(notImage, 'not an image\n');
const exports = path.join(userData, 'exports'); fs.mkdirSync(exports);
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
const state = fn => page.evaluate(fn);
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

  // ---- administrative: refused until a person switches Full YOLO on
  for (const argv of [['note', 'delete', 'Anything'], ['profile', 'export', exports], ['profile', 'import', exports], ['paper', 'switch'], ['paper', 'rollback'], ['paper', 'reconcile', 'drafts.x', 'keep'], ['provider', 'login', 'codex'], ['profile', 'discard', 'x']]) await refused(4, /Full YOLO/, ...argv);
  check('without Full YOLO: deleting notes, export, import, the switch and sign-in are refused');
  await fullYolo(true);
  check('a person turns Full YOLO on in Settings › Assistant');

  // ---- the Paper switch, first, as a library that has not switched would meet it
  const paper = await json('paper', 'status'); report.paperStatus = paper; persist();
  await refused(1, /not a Paper changed after the switch/, 'paper', 'compare', 'drafts.nothing');
  if (['none', 'intent', 'replacing'].includes(paper.status)) {
    const switched = await json('paper', 'switch');
    assert.equal(switched.status, 'selected'); assert.match(switched.text, /a person restarts Barkdown/);
    await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 120000 });
    await shot('00-switched-restart-offered');
    // The restart is the person's: the tour closes Barkdown and opens it again, as they would.
    await app.close(); await launch();
    const notice = page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' });
    await notice.waitFor({ timeout: 60000 }); await notice.locator('[data-dismiss]').click();
    assert.equal((await json('paper', 'status')).status, 'selected');
    await fullYolo(true); // kept across the restart only where the keychain seals it
    check('paper switch moves the library to Paper; after a person\'s restart the library is on Paper');
  } else { report.paperSwitch = `not run: the library is already ${paper.status}`; check(`paper status reads the switch (${paper.status})`); }
  await ok('agent', 'add', 'Desk', '--folder', folder);

  // ---- notes: edit in place, undo, the revision guard
  const note = await json('note', 'new', '# Release plan\n\n- draft the notes');
  await paneText().filter({ hasText: 'draft the notes' }).waitFor();
  const first = await json('note', 'read', 'Release plan');
  assert.ok(Number.isSafeInteger(first.rev), 'note read prints the revision');
  const edited = await json('note', 'edit', 'Release plan', '- ship on Friday');
  assert.ok(edited.rev > first.rev); assert.ok(edited.edit);
  await paneText().filter({ hasText: 'ship on Friday' }).waitFor();
  assert.match((await json('note', 'read', 'Release plan')).text, /- draft the notes[\s\S]*- ship on Friday/);
  await page.locator('#agent-edit:not([hidden])').waitFor();
  await shot('01-note-edited-undo-offered');
  check('note edit appends to a note: the open tab shows it, and the note offers Undo as for an assistant\'s edit');
  await ok('note', 'undo', 'Release plan');
  await page.waitForFunction(() => !document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('ship on Friday'));
  assert.doesNotMatch((await json('note', 'read', 'Release plan')).text, /ship on Friday/);
  await refused(1, /no edit to undo/, 'note', 'undo', 'Release plan');
  check('note undo takes the edit back, once');
  await refused(2, /--rev/, 'note', 'edit', 'Release plan', 'Everything new', '--mode', 'replace');
  const current = await json('note', 'read', 'Release plan');
  await refused(1, /changed since it was read/, 'note', 'edit', 'Release plan', 'Stale', '--mode', 'replace', '--rev', String(current.rev - 1));
  await ok('note', 'edit', 'Release plan', '- one line only', '--mode', 'replace', '--rev', String(current.rev));
  const replaced = await json('note', 'read', 'Release plan');
  assert.equal(replaced.title, 'Release plan', 'the title stays'); assert.doesNotMatch(replaced.text, /draft the notes/); assert.match(replaced.text, /one line only/);
  check('note edit --mode replace needs the revision read, and refuses a stale one');

  // ---- images on a message
  const sent = await json('chat', 'send', 'What colour is this?', '--chat', 'Desk', '--image', image, '--wait');
  assert.match(sent.text, /Scripted reply to: What colour is this\?/);
  assert.ok(seen.some(types => types.includes('image') && types.includes('text')), 'the model received the image beside the text');
  assert.equal(await state(() => { const s = window.__barkdown.state; return [...s.chats[s.current].messages].reverse().find(m => m.role === 'user')?.images?.length; }), 1);
  await page.locator('#bw-transcript img').first().waitFor();
  await refused(1, /not a PNG, JPEG, GIF or WebP/, 'chat', 'send', 'And this?', '--chat', 'Desk', '--image', notImage);
  await refused(1, /no file/, 'chat', 'send', 'And this?', '--chat', 'Desk', '--image', path.join(folder, 'missing.png'));
  await shot('02-image-sent');
  check('chat send --image attaches an image as a pasted one; a file that is not an image is refused');

  // ---- goals
  const goal = await json('goal', 'new', 'Tidy the release notes', '--minutes', '30', '--no-start');
  assert.equal(goal.status, 'planned');
  assert.ok((await json('goal', 'list')).some(g => g.id === goal.id && g.objective === 'Tidy the release notes'));
  await ok('goal', 'open');
  await page.locator('.bw-goals', { hasText: 'Tidy the release notes' }).waitFor();
  await shot('03-goal-open');
  await page.locator('.bw-goals [data-close]').click();
  const cancelled = await json('goal', 'cancel', goal.id);
  assert.equal(cancelled.status, 'cancelled');
  for (const name of ['review', 'accept', 'complete', 'reconcile']) await refused(4, /person/, 'goal', name, goal.id);
  check('goal new / list / open / cancel; accepting, completing and reconciling stay a person\'s');

  // ---- providers: asking is everyday; signing in is Full YOLO and finished by a person
  const asked = await json('provider', 'check', 'codex');
  assert.ok(['signed-in', 'signed-out', 'unavailable', 'failed'].includes(asked.state), JSON.stringify(asked));
  await refused(2, /claude or codex/, 'provider', 'check', 'api');
  assert.match((await json('provider', 'cancel', 'claude')).text, /No sign-in is in progress/);
  await refused(4, /no sign-out/, 'provider', 'logout');
  check('provider check asks the provider, cancel is safe when nothing runs, and there is no sign-out');

  // ---- deleting and recovering a note
  const deleted = await json('note', 'delete', 'Release plan');
  assert.equal(deleted.status, 'deleted', JSON.stringify(deleted));
  const gone = await json('note', 'deleted');
  assert.ok(gone.some(r => r.title === 'Release plan' && r.status === 'deleted'));
  const recovered = await json('note', 'recover', 'Release plan');
  assert.notEqual(recovered.id, note.id, 'a recovered note is a separate copy');
  await paneText().filter({ hasText: 'one line only' }).waitFor();
  assert.ok((await json('note', 'list')).some(n => n.id === recovered.id));
  await shot('04-note-recovered');
  check('note delete keeps a snapshot; note deleted lists it; note recover opens a separate copy');

  await refused(1, /not a Paper changed/, 'paper', 'reconcile', 'drafts.nothing', 'keep');

  // ---- carrying the profile: import from an export, then export this one (which pauses editing)
  const exported = await json('profile', 'export', exports);
  assert.ok(fs.existsSync(path.join(exported.folder, 'manifest.json')), 'the export has its manifest');
  assert.match(exported.text, /restarts Barkdown/);
  assert.equal((await json('profile', 'portable')).export?.status, 'exported');
  await page.locator('.bw-preparation-notice').filter({ hasNotText: 'Sealing' }).waitFor({ timeout: 20000 });
  await shot('05-profile-exported');
  check('profile export writes a verified export into the folder given; profile portable reports it; the restart stays a person\'s');
  await refused(4, /restart/, 'profile', 'restart');
  const imported = await json('profile', 'import', exported.folder);
  assert.ok(imported.profile?.id && imported.papers >= 1, JSON.stringify(imported));
  assert.ok((await json('profile', 'list')).some(p => p.id === imported.profile.id && !p.selected), 'the import is a new profile, not switched to');
  await refused(1, /no manifest/, 'profile', 'import', folder);
  check('profile import makes a new profile from the export and does not switch to it; a folder that is not an export is refused');

  const log = await json('log', '--limit', '80');
  for (const command of ['note.edit', 'note.undo', 'note.delete', 'note.recover', 'goal.new', 'goal.cancel', 'profile.export', 'profile.import']) assert.ok(log.some(e => e.command === command && e.ok && e.origin === 'cli'), command + ' is in the log');
  fs.writeFileSync(path.join(out, 'control-log.json'), JSON.stringify(log, null, 2) + '\n');
  check('the log names every change and who asked');
  assert.deepEqual(transport.errors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); console.error(error); try { await shot('failure'); } catch {} process.exitCode = 1; }
finally { persist(); clearTimeout(watchdog); try { await app?.close(); } catch {} await transport.close(); console.log(`${report.status}: ${report.checks.length} checks · ${out}`); process.exit(process.exitCode || 0); }
