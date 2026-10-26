// The next complete journey (docs/PLAN.md), on one Mac, as one run: create a local profile → write with an
// assistant beside you → restart, cleanly and by a forced kill → move the profile to another installation and
// keep going there. A ledger records every piece of work as it is made: what the person typed, what the agent
// wrote with `barkdown note edit`, a picture, the main chat and a side chat. After every restart and the move
// the whole ledger is read back from the app; one missing entry fails the run.
// Model replies are scripted (the API SDK over a local fixture). The second installation is a second user-data
// root on the same Mac, not a second machine (ACCEPTANCE.md A3 still asks for one).
//   BARKDOWN_TEST_BP_SOURCE=<built Barkpark checkout> TMPDIR=/private/tmp/ node tests/journey.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
import { LINE_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const source = process.env.BARKDOWN_TEST_BP_SOURCE && path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE);
if (!source || !fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(appRoot, '../docs/cycles/evidence/journey/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-journey-')));
const first = path.join(root, 'installation-one'), second = path.join(root, 'installation-two'), carry = path.join(root, 'carried-between');
for (const dir of [first, second, carry]) fs.mkdirSync(dir);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), upstream: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  host: `${process.platform} ${os.release()} ${process.arch}`, model: 'Scripted replies through the API SDK; not a real model', status: 'running', checks: [], screenshots: [], transcript: [],
  limits: ['Two user-data roots on one Mac, one after the other: not a second machine, OS or Postgres. The native folder picker is stubbed in the main process. The forced kill comes after the save is acknowledged; typing still inside the save delay is boot-draft.live\'s case.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };
const transport = await createToolFixture(body => { const last = body.messages.at(-1); const text = typeof last.content === 'string' ? last.content : last.content.find(b => b.type === 'text')?.text || ''; return { text: `Scripted reply to: ${text.split('\n').at(-1).slice(0, 80)}` }; });
const watchdog = setTimeout(() => { console.error('journey: watchdog'); report.status = 'timeout'; persist(); process.exit(1); }, 25 * 60 * 1000);

let app, page, userData;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async dir => {
  userData = dir;
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${dir}`], timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url, BARKDOWN_MOCK_KEYCHAIN: '1' } });
  app.process().stderr?.on('data', chunk => (report.mainStderr ||= []).push(String(chunk).slice(0, 300)));
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
  // A slower machine on demand (CI runners are): Chromium's CPU throttling, e.g. BARKDOWN_TEST_CPU_THROTTLE=4.
  if (Number(process.env.BARKDOWN_TEST_CPU_THROTTLE) > 1) await (await app.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.BARKDOWN_TEST_CPU_THROTTLE) });
};
const quit = async () => { let timer; try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000); })]); } finally { clearTimeout(timer); } };
// A forced exit: no quit handlers, no flush. Whatever the app acknowledged as saved must already be durable.
const kill = async () => { const child = app.process(); const gone = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await gone; };
const runtimeReady = async () => {
  const started = Date.now();
  for (;;) {
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(error => ({ phase: 'pending', error: error.message }));
    if (status.phase === 'ready') return;
    if (status.phase === 'failed') throw new Error('Profile runtime failed: ' + status.error);
    if (Date.now() - started > 300000) throw new Error('Profile runtime not ready after 5 minutes');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const bd = (...argv) => new Promise(resolve => {
  const env = { ...process.env }; delete env.BARKDOWN_CONTROL;
  const child = spawn(path.join(userData, 'bin', 'barkdown'), ['--user-data', userData, ...argv], { env }); let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => { report.transcript.push({ command: 'barkdown ' + argv.join(' '), code, out: (stdout || stderr).trim().slice(0, 500) }); persist(); resolve({ code, out: stdout, err: stderr }); });
  child.stdin.end();
});
const json = async (...argv) => { const r = await bd(...argv, '--json'); assert.equal(r.code, 0, `barkdown ${argv.join(' ')}: ${r.err || r.out}`); return JSON.parse(r.out).result; };
const pane = () => page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
const paperSaved = () => page.waitForFunction(() => { const p = document.querySelector('.bw-paper-pane:not([hidden])'); return p?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !p.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const pick = folder => app.evaluate(({ dialog }, chosen) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] }); }, folder);
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const closeSettings = () => page.locator('.bw-settings [data-act="cancel"]').click();
const dismissAll = async () => { for (const notice of await page.locator('.bw-preparation-notice [data-dismiss]').all()) await notice.click().catch(() => {}); };
const fullYolo = async () => {
  await json('ui', 'show', 'settings', 'assistant');
  if (!await page.locator('#full-yolo').isChecked()) await page.locator('.bw-settings label[for="full-yolo"]').click();
  await page.waitForFunction(() => window.__barkdown.state.settings.control?.fullYolo === true);
  await closeSettings();
};
const useLocalLibrary = () => page.evaluate(async source => { window.__barkdown.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } }); document.documentElement.dataset.theme = 'dark'; await window.__barkdown.refreshLibrary(); }, source);
// What the person is about to type into: every open editor of the note, its text and its save state.
const editors = () => page.evaluate(() => [...document.querySelectorAll('.bw-paper-pane')].map(p => ({ hidden: p.hidden, shown: Boolean(p.offsetParent), save: p.querySelector('#save-state')?.textContent || '', paragraphs: [...p.querySelectorAll('.ProseMirror p')].map(x => x.textContent.slice(0, 40)) })));
const typeAtEnd = async text => { (report.typing ||= []).push({ text, editors: await editors() }); persist(); await pane().locator('p').last().click(); await page.keyboard.press(LINE_END); await page.keyboard.press('Enter'); await page.keyboard.type(text); await paperSaved(); };

// The ledger: every piece of work, in the order it was made, and how to find it again.
const ledger = { note: 'Harbour ledger', lines: [], chats: [] };
const verify = async moment => {
  const read = await json('note', 'read', ledger.note);
  const missing = ledger.lines.filter(line => !read.text.includes(line));
  assert.deepEqual(missing, [], `${moment}: lines missing from "${ledger.note}"`);
  const order = ledger.lines.map(line => read.text.indexOf(line));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `${moment}: the lines are in the order they were written · ` + JSON.stringify({ text: read.text, editors: await editors() }));
  await pane().filter({ hasText: ledger.lines.at(-1) }).waitFor({ timeout: 60000 }).catch(async () => { await page.locator(`#bw-pages :text-is("${ledger.note}")`).first().click(); await pane().filter({ hasText: ledger.lines.at(-1) }).waitFor(); });
  const chats = await page.evaluate(() => Object.values(window.__barkdown.state.chats).map(c => ({ id: c.id, texts: c.messages.map(m => m.text) })));
  for (const { id, title, texts } of ledger.chats) {
    const chat = chats.find(c => c.id === id);
    assert.ok(chat, `${moment}: chat "${title}" is there`);
    assert.deepEqual(chat.texts.filter(t => texts.includes(t)), texts, `${moment}: every message in "${title}"`);
  }
  await page.locator(`#bw-pages :text-is("${ledger.note}")`).first().waitFor({ timeout: 30000 });
  const picture = await page.waitForFunction(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img')].some(img => img.complete && img.naturalWidth === 1), null, { timeout: 30000 }).then(() => true, () => false);
  assert.ok(picture, `${moment}: the picture shows · ` + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img')].map(img => ({ src: img.src, complete: img.complete, width: img.naturalWidth })))));
  return { lines: ledger.lines.length, chats: ledger.chats.map(c => `${c.title}: ${c.texts.length} messages`) };
};

try {
  // 1. Create a local profile on a new installation.
  await launch(first);
  await page.keyboard.press('Control+,');
  await page.locator('#profile-name').fill('Journey desk'); await page.locator('#profile-create').click();
  await page.waitForFunction(() => document.querySelector('#profile-choice')?.options.length === 2);
  const initial = await page.evaluate(() => window.__barkdown.state.profileId);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId !== id, initial);
  const desk = await page.evaluate(() => window.__barkdown.state.profileId);
  await useLocalLibrary(); await runtimeReady();
  await fullYolo();
  const paper = await json('paper', 'status');
  if (paper.status !== 'selected') {
    await json('paper', 'switch');
    await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 150000 });
    await quit(); await launch(first); await runtimeReady(); await dismissAll();
  }
  assert.equal(await page.evaluate(() => window.__barkdown.state.authority), 'paper');
  check('a new profile is created from Settings with its own local library, on Paper', { switched: paper.status !== 'selected' });

  // 2. Write with an assistant beside you.
  await page.locator('#bw-new-page').click();
  await pane().locator('h1').click({ timeout: 60000 });
  await page.keyboard.type(ledger.note); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  ledger.lines.push('Cobalt lanterns mark the quay where the words must arrive.');
  await page.keyboard.type(ledger.lines.at(-1)); await paperSaved();
  const { id: noteId } = await json('note', 'read', ledger.note);
  await page.evaluate(async ({ id, dataUrl }) => {
    const paper = await window.barkdown.barkpark.get(id);
    const media = await window.barkdown.barkpark.uploadMedia({ binding: paper.binding, name: 'lantern.png', mime: 'image/png', dataUrl });
    const fresh = await window.barkdown.barkpark.get(id);
    await window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { id: 'lantern', type: 'image', src: media.src, alt: 'A cobalt lantern' } }], fresh.rev, fresh.binding);
  }, { id: noteId, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
  await page.evaluate(() => { for (const c of window.__barkdown.controllers.values()) if (c.el.matches('.bw-paper-pane')) void c.refresh(); });
  await page.locator('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img').waitFor();
  ledger.lines.push('The agent adds: the harbour master signs every ledger at dusk.');
  const edited = await json('note', 'edit', ledger.note, ledger.lines.at(-1));
  assert.ok(edited.edit, 'the edit has an Undo receipt');
  await pane().filter({ hasText: ledger.lines.at(-1) }).waitFor();
  await page.locator('#agent-edit:not([hidden])').waitFor();
  ledger.lines.push('The person carries on after the agent, in the same note.');
  await typeAtEnd(ledger.lines.at(-1));
  const main = await page.evaluate(() => window.__barkdown.state.current);
  const asked = 'Which lanterns mark the quay?';
  const reply = await json('chat', 'send', asked, '--chat', main, '--wait');
  ledger.chats.push({ id: main, title: 'main chat', texts: [asked, reply.text] });
  const side = await json('chat', 'side', 'Lantern research');
  const sideAsked = 'Find the oldest lantern on the quay.';
  const sideReply = await json('chat', 'send', sideAsked, '--chat', side.chat, '--wait');
  ledger.chats.push({ id: side.chat, title: 'Lantern research', texts: [sideAsked, sideReply.text] });
  await shot('01-written-with-the-agent');
  check('the person writes a note, the agent edits it with Undo offered, the person carries on; a picture, the main chat and a side chat', await verify('after writing'));

  // 3. Restart without losing work: a clean quit, then a forced kill straight after an acknowledged save.
  await quit(); await launch(first); await runtimeReady(); await dismissAll();
  assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), desk, 'the profile is still selected');
  check('a clean quit and reopen keeps everything', await verify('after a clean restart'));
  ledger.lines.push('Typed just before the power went.');
  await typeAtEnd(ledger.lines.at(-1));
  await kill(); await launch(first); await runtimeReady(); await dismissAll();
  check('a forced kill after the save is acknowledged loses nothing', await verify('after a forced kill'));
  await shot('02-after-forced-kill');

  // 4. Move the profile to another installation and continue there.
  await pick(carry); await openSettings();
  await page.locator('#profile-export').click();
  await page.locator('.bw-preparation-notice', { hasText: 'The export completed' }).waitFor({ timeout: 180000 });
  await quit();
  const exportDir = path.join(carry, fs.readdirSync(carry)[0]);
  await launch(second); await useLocalLibrary(); await runtimeReady();
  await pick(exportDir); await openSettings();
  await page.locator('#profile-import').click();
  await page.waitForFunction(() => /^Imported /.test(document.querySelector('#profile-import-status')?.textContent || '') || document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 300000 });
  const said = await page.locator('#profile-import-status').textContent();
  assert.match(said, /^Imported “Journey desk \(imported\)”/, said);
  const home = await page.evaluate(() => window.__barkdown.state.profileId);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId !== id, home, { timeout: 60000 });
  await runtimeReady(); await closeSettings().catch(() => {});
  check('the profile is exported from Settings and imported on the other installation', await verify('after the move'));
  await shot('03-moved');
  await fullYolo();
  ledger.lines.push('Written by the agent on the other installation.');
  await json('note', 'edit', ledger.note, ledger.lines.at(-1));
  await pane().filter({ hasText: ledger.lines.at(-1) }).waitFor();
  ledger.lines.push('And the person continues here too.');
  await typeAtEnd(ledger.lines.at(-1));
  await quit(); await launch(second); await runtimeReady(); await dismissAll();
  check('on the other installation the agent and the person keep writing, and it survives a restart', await verify('after continuing on the other installation'));
  await shot('04-continued-and-reopened');
  await quit();
  report.status = 'passed'; delete report.mainStderr; persist(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, out }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = (report.mainStderr || []).slice(-30); persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  throw error;
} finally {
  clearTimeout(watchdog); await transport.close?.();
}
