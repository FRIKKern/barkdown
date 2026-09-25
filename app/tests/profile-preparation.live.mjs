// Real Electron, shipped Paper canvas, Chromium IME, profile IPC and local disk.
// HTTP serves a deterministic Paper and refuses writes; no real server-save claim.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cleanSource } from './helpers/capture-lifecycle.mjs';
import { openFixturePaper } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const capture = process.env.BARKDOWN_PREPARATION_CAPTURE === '1';
const source = capture ? cleanSource(path.resolve('..'), { allowEvidence: true }).commit : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(capture ? '../docs/cycles/evidence/C076/preparation-native' : 'test-results/preparation', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-preparation-native-'));
const paper = { _id: 'draft-fixture', slug: 'draft-fixture', title: 'Words worth keeping', rev: 1,
  blocks: [{ id: 'intro', type: 'paragraph', content: [{ type: 'text', value: 'An offline draft stays yours.' }] },
    { id: 'note', type: 'note', label: 'Original label', text: 'A thought still taking shape.' },
    { id: 'code', type: 'code', value: 'original code', lang: 'text' }] };
let writes = 0;
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.method !== 'GET') { writes++; res.statusCode = 503; res.end(JSON.stringify({ message: 'Fixture offline: keep your draft' })); }
  else if (req.url.startsWith('/v1/data/doc/')) res.end(JSON.stringify({ document: paper }));
  else if (req.url.startsWith('/v1/data/query/')) res.end(JSON.stringify({ documents: [paper], total: 1, count: 1, hasMore: false, nextOffset: null, perspective: 'published', limit: 200, offset: 0 }));
  else if (req.url.startsWith('/v1/')) res.end(JSON.stringify({ documents: [] }));
  else { res.statusCode = 404; res.end('{}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const a = registry.createProfile({ name: 'Writing desk' }), b = registry.createProfile({ name: 'Other notebook' });
for (const profile of [a, b]) createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', {
  theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', server: `http://127.0.0.1:${server.address().port}` },
});
const report = { source, capture, userData, scope: 'Production coordinator, main/preload/renderer IPC and shipped canvas; deterministic HTTP reads, no live Barkpark save claim.', checks: [], screenshots: [] };
const persist = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`],
  ...(capture ? { recordVideo: { dir: out, size: { width: 1300, height: 900 } } } : {}), env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); if (capture) await new Promise(resolve => setTimeout(resolve, 650)); };
const boot = async () => {
  app = await launch(); page = await app.firstWindow();
  if (capture) (report.videos ||= []).push(path.basename(await page.video().path()));
  page.setDefaultTimeout(20000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
try {
  await boot();
  const folder = path.join(userData, 'working-folder'); fs.mkdirSync(folder);
  const file = path.join(folder, 'note.md'), original = '# Saved file\n', projectDraft = '# Unsaved project text'; fs.writeFileSync(file, original);
  await page.evaluate(folder => { window.__barkdown.setFolder(folder); window.__barkdown.openTarget({ kind: 'project', path: 'note.md' }); }, folder);
  const projectEditor = page.locator('.bw-pane:not([hidden]) .cm-content'); await projectEditor.waitFor();
  await projectEditor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(projectDraft);
  await page.locator('.bw-dot-dirty').waitFor();
  await assert.rejects(page.evaluate(() => window.__barkdown.prepareProfile()), /project file buffers/);
  assert.equal(fs.readFileSync(file, 'utf8'), original); assert.equal(await projectEditor.innerText(), projectDraft);
  await shot('07-project-buffer-refused');
  await projectEditor.click(); await page.keyboard.press('Control+s'); await page.waitForFunction(() => !document.querySelector('.bw-dot-dirty'));
  assert.equal(fs.readFileSync(file, 'utf8'), projectDraft);
  const legacy = await page.evaluate(() => window.barkdown.docs.create({ title: 'Legacy migration source', markdown: 'Original legacy text.' }));
  await page.evaluate(id => window.__barkdown.openTarget({ kind: 'doc', id, source: 'local' }), legacy.id);
  const legacyEditor = page.locator('.bw-doc-pane:not(.bw-paper-pane):not([hidden]) .ProseMirror'); await legacyEditor.waitFor();
  // Hold the actual persistence adapter after real Tiptap input: a pending save
  // must still count as unsaved, and refusal must not discard the visible text.
  const pendingSaveMarker = path.join(folder, 'legacy-save-held');
  await app.evaluate(({ app }, marker) => {
    const docs = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./documents'), save = docs.save;
    let release; const gate = new Promise(resolve => release = resolve); global.legacySaveHeld = false;
    docs.save = async (...args) => { process.getBuiltinModule('fs').writeFileSync(marker, 'held'); await gate; return save(...args); };
    global.releaseLegacy = () => { docs.save = save; release(); };
  }, pendingSaveMarker);
  try {
    await legacyEditor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('Human legacy buffer must survive.');
    for (let i = 0; i < 100 && !fs.existsSync(pendingSaveMarker); i++) await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(fs.existsSync(pendingSaveMarker), true);
    await assert.rejects(page.evaluate(() => window.__barkdown.prepareProfile()), /unsaved editors/);
    assert.match(await legacyEditor.innerText(), /Human legacy buffer must survive/);
    assert.equal((await page.evaluate(id => window.barkdown.docs.get(id), legacy.id)).markdown, legacy.markdown);
    await shot('08-legacy-save-refused');
  } finally { await app.evaluate(() => global.releaseLegacy()); }
  await page.waitForFunction(() => [...window.__barkdown.controllers.values()].filter(c => c.type === 'doc').every(c => !c.isDirty?.()));
  report.checks.push('Real CodeMirror dirty file and actual Tiptap pending save refuse preparation; text stays visible, file bytes change only on explicit Save, and legacy persistence completes after its test barrier releases.');
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.locator('.bw-terminal #in').waitFor();
  await page.waitForFunction(() => document.querySelector('.bw-terminal #out')?.textContent.includes('PowerShell in'));
  const terminalTab = await page.evaluate(() => [...window.__barkdown.controllers.values()].find(c => c.type === 'terminal').tab.id);
  const marker = path.join(folder, 'owned-tree.jsonl'), script = fileURLToPath(new URL('./fixtures/terminal-descendants.cjs', import.meta.url));
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  await page.locator('.bw-terminal #in').fill(`& ${quote(process.execPath)} ${quote(script)} ${quote(marker)}`);
  await page.locator('.bw-terminal #in').press('Enter');
  for (let i = 0; i < 150 && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim().split('\n').length < 3); i++) await new Promise(resolve => setTimeout(resolve, 50));
  const tree = fs.readFileSync(marker, 'utf8').trim().split('\n').map(line => JSON.parse(line).pid);
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  assert.equal(tree.length, 3); assert(tree.every(alive));
  await page.locator('.bw-terminal #in').fill('echo retained but never run');
  await shot('09-owned-terminal-before-preparation');
  await openFixturePaper(page, 'draft-fixture');
  await page.locator('.bw-paper-pane .bp-canvas-code-area').waitFor();
  const originalChat = await page.evaluate(() => window.__barkdown.state.current);
  await page.locator('#bw-prompt').fill('Keep this unsent conversation draft.');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
  await assert.rejects(page.evaluate(() => window.__barkdown.prepareProfile()), /Finish composing/);
  assert.equal(fs.existsSync(path.join(registry.storeFor(a.id).storeDir, 'profile-launch-admission.json')), false);
  assert.match(await page.locator('#bw-prompt').inputValue(), /にほん/);
  await cdp.send('Input.insertText', { text: '日本' });
  await page.locator('#bw-prompt').fill('Keep this unsent conversation draft.');
  report.checks.push('Chromium IME refuses preparation without ending active composition or writing launch closure.');
  await page.evaluate(() => document.querySelector('bp-paper-canvas').toggleSourceMode());
  const raw = '# My unsubmitted source  \n\nKeep **these spaces**.\n';
  await page.locator('.bp-canvas-source').fill(raw);
  const result = await page.evaluate(() => window.__barkdown.prepareProfile());
  assert.equal(result.phase, 'prepared'); assert.equal(result.profileId, a.id); assert.equal(result.draftKeys.length, 1);
  const key = result.draftKeys[0];
  const retained = await page.evaluate(key => window.barkdown.paperDrafts.read(key), key);
  assert.equal(retained.content.draft.snapshot.raw_source, raw);
  const workspace = await page.evaluate(() => window.barkdown.state.load());
  assert.equal(workspace.chats[originalChat].draft, 'Keep this unsent conversation draft.');
  assert.equal(workspace.chats[originalChat].tabs.find(tab => tab.id === terminalTab).commandDraft, 'echo retained but never run');
  assert(tree.every(pid => !alive(pid)), 'owned terminal root and descendants must be stopped');
  assert.equal((await page.evaluate(({ id, chatId }) => window.barkdown.term.status(id, chatId), { id: terminalTab, chatId: originalChat })).state, 'stopped');
  await assert.rejects(page.evaluate(({ id, folder, chatId }) => window.barkdown.term.start(id, folder, chatId), { id: terminalTab, folder, chatId: originalChat }), /preparing/);
  report.checks.push('Production preparation verifies owned terminal root/child/grandchild shutdown, retains its unsent command and rejects a new terminal launch.');
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
  assert.match(await page.locator('.bw-paper-pane #meta').innerText(), /Editing paused/);
  await page.keyboard.type('Must not overwrite');
  assert.equal(await page.locator('.bp-canvas-source').inputValue(), raw);
  await assert.rejects(page.evaluate(() => window.barkdown.settings.set({ theme: 'light' })), /preparing/);
  const chatCount = await page.evaluate(() => Object.keys(window.__barkdown.state.chats).length);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'new-chat'));
  assert.equal(await page.evaluate(() => Object.keys(window.__barkdown.state.chats).length), chatCount);
  await shot('01-prepared-drafts');
  report.checks.push('Production IPC retains exact raw Paper source and unsent chat draft, verifies preparation and blocks native keyboard/menu/new mutations.');
  await page.getByRole('button', { name: 'Review retained drafts' }).click();
  await page.waitForFunction(text => document.querySelector('.bw-retained-text')?.value === text, raw);
  assert.equal(await page.getByLabel('Retained text', { exact: true }).getAttribute('readonly'), '');
  await shot('04-retained-draft-reader');
  await page.getByRole('button', { name: 'Close retained drafts' }).click();
  const mainPid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, mainPid);
  const exited = new Promise(resolve => app.process().once('exit', resolve));
  process.kill(mainPid, 'SIGKILL'); await exited; app = null;
  await boot();
  await page.locator('.bw-preparation-notice').waitFor();
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
  assert.deepEqual(await page.evaluate(key => window.barkdown.paperDrafts.read(key), key), retained);
  await assert.rejects(page.evaluate(() => window.barkdown.settings.set({ theme: 'light' })), /preparing/);
  assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats[originalChat].draft, 'Keep this unsent conversation draft.');
  await page.locator('.bw-paper-pane .bp-canvas-code-area').waitFor();
  const repeated = await page.evaluate(() => window.__barkdown.prepareProfile());
  assert.equal(repeated.id, result.id); assert.deepEqual(repeated.draftKeys, result.draftKeys);
  await page.evaluate(async () => { window.dispatchEvent(new Event('beforeunload')); await window.barkdown.preparation.status(); });
  assert.doesNotMatch(await page.locator('#bw-toasts').innerText(), /Changes are not saved/);
  await page.setViewportSize({ width: 900, height: 760 }); await shot('02-read-only-restart');
  report.checks.push('Abrupt actual main-process exit and restart retain drafts byte-for-byte; repeat preparation verifies the same record while the profile stays read-only.');
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  await page.waitForFunction(async () => (await window.barkdown.preparation.status()).restartRequired);
  const cancelled = await page.evaluate(() => window.barkdown.preparation.status());
  assert.equal(cancelled.record.phase, 'aborted'); assert.equal(cancelled.readOnly, true);
  assert.notEqual(cancelled.record.writerReopened.generation, result.writerBefore.generation);
  await assert.rejects(page.evaluate(() => window.barkdown.settings.set({ theme: 'light' })), /preparing/);
  const stale = await app.evaluate(({ app }) => {
    const docs = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./documents');
    try { docs.writer.run('test:stale-aborted-host', () => true); return 'unexpected write'; } catch (error) { return error.message; }
  });
  assert.match(stale, /earlier library generation/);
  await shot('05-cancelled-restart-required');
  report.checks.push('Actual Cancel preparation action creates a fresh writer generation; the current host stays read-only and its captured writer refuses.');
  await page.getByLabel('Preparation profile').selectOption(b.id);
  await page.locator('.bw-preparation-notice [data-switch]').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.id);
  assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
  await page.locator('#bw-prompt').fill('Other notebook is still editable.');
  await page.evaluate(() => window.barkdown.settings.set({ theme: 'dark' }));
  assert.deepEqual(await page.evaluate(() => window.barkdown.paperDrafts.list()), []);
  await assert.rejects(page.evaluate(key => window.barkdown.paperDrafts.copy(key, 'record'), key), /ENOENT/);
  await shot('03-other-profile');
  report.checks.push('Actual notice profile selector switches to B; its composer and owned settings remain writable with no A recovery records.');
  await app.close(); app = null; registry.selectProfile(a.id); await boot();
  await page.locator('.bw-preparation-notice').waitFor();
  assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
  assert.equal((await page.evaluate(() => window.barkdown.preparation.status())).restartRequired, false);
  await page.evaluate(async () => { const saved = await window.barkdown.state.load(); await window.barkdown.state.save(saved); });
  await page.getByRole('button', { name: 'Review retained drafts' }).click();
  await page.waitForFunction(text => document.querySelector('.bw-retained-text')?.value === text, raw);
  await page.getByRole('button', { name: 'Copy full record', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.bw-retained-status')?.textContent === 'Full record copied.');
  const copied = JSON.parse(await app.evaluate(({ clipboard }) => clipboard.readText()));
  assert.deepEqual(copied, retained);
  await page.setViewportSize({ width: 900, height: 760 }); await shot('06-retained-copy-after-reopen');
  await page.getByRole('button', { name: 'Close retained drafts' }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.keyboard.press('Control+,');
  await page.getByRole('button', { name: 'View drafts', exact: true }).click();
  await page.waitForFunction(text => document.querySelector('.bw-retained-text')?.value === text, raw);
  await page.getByRole('button', { name: 'Close retained drafts' }).click();
  await page.locator('.bw-paper-pane .bp-canvas-code-area').waitFor();
  const next = await page.evaluate(() => window.__barkdown.prepareProfile());
  assert.notEqual(next.id, result.id); assert.notEqual(next.closureId, result.closureId);
  assert.deepEqual(await page.evaluate(key => window.barkdown.paperDrafts.read(key), key), retained);
  const prior = JSON.parse(fs.readFileSync(path.join(registry.storeFor(a.id).storeDir, 'preparation-history', result.id + '.json')));
  assert.equal(prior.phase, 'aborted'); assert.deepEqual(prior.writerReopened, cancelled.record.writerReopened);
  report.checks.push('Fresh host writes with new authority; the actual recovery reader copies the exact retained record, and a second preparation archives the first while preserving its draft.');
  assert.equal(writes, 0, 'raw source capture must not submit an unrequested server edit');
  report.status = 'passed'; persist(); console.log(JSON.stringify({ out, status: report.status, checks: report.checks }));
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) { report.visibleFailure = await page.locator('body').innerText().catch(() => 'Unavailable'); await shot('failure').catch(() => {}); }
  persist(); throw error;
} finally { if (app) await app.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); }
