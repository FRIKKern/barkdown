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
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const boot = async () => {
  app = await launch(); page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
try {
  await boot();
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
  await page.getByLabel('Preparation profile').selectOption(b.id);
  await page.locator('.bw-preparation-notice button').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.id);
  assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
  await page.locator('#bw-prompt').fill('Other notebook is still editable.');
  await page.evaluate(() => window.barkdown.settings.set({ theme: 'dark' }));
  assert.deepEqual(await page.evaluate(() => window.barkdown.paperDrafts.list()), []);
  await shot('03-other-profile');
  report.checks.push('Actual notice profile selector switches to B; its composer and owned settings remain writable with no A recovery records.');
  assert.equal(writes, 0, 'raw source capture must not submit an unrequested server edit');
  report.status = 'passed'; persist(); console.log(JSON.stringify({ out, status: report.status, checks: report.checks }));
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) { report.visibleFailure = await page.locator('body').innerText().catch(() => 'Unavailable'); await shot('failure').catch(() => {}); }
  persist(); throw error;
} finally { if (app) await app.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); }
