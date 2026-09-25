// Real Electron, shipped Paper canvas, Chromium IME, profile IPC and local disk.
// HTTP serves a deterministic Paper and refuses writes; no real server-save claim.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cleanSource } from './helpers/capture-lifecycle.mjs';
import { openFixturePaper } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const capture = process.env.BARKDOWN_DRAFT_CAPTURE === '1';
const source = capture ? cleanSource(path.resolve('..'), { allowEvidence: true }).commit : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(capture ? '../docs/cycles/evidence/C076/paper-draft-native' : 'test-results/paper-draft', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-paper-draft-native-'));
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
const report = { source, capture, userData, scope: 'Native shipped canvas and Chromium IME with actual profile IPC and durable records; deterministic HTTP reads/refused writes, no live Barkpark or OS language-picker claim.', checks: [], screenshots: [] };
const persist = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const retain = () => page.evaluate(() => [...window.__barkdown.controllers.values()].find(c => c.el.matches('.bw-paper-pane')).retainRecovery());
try {
  app = await launch(); page = await app.firstWindow();
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  await openFixturePaper(page, 'draft-fixture');
  await page.locator('.bw-paper-pane .bp-canvas-code-area').waitFor({ timeout: 30000 });
  // Capture before the node's debounce fires, using its real input listener.
  const first = await page.evaluate(async () => {
    const c = [...window.__barkdown.controllers.values()].find(c => c.el.matches('.bw-paper-pane'));
    const code = c.el.querySelector('.bp-canvas-code-area'), title = c.el.querySelector('#title');
    code.value = 'const retained = "before debounce";'; code.dispatchEvent(new Event('input', { bubbles: true }));
    title.value = '  My unfinished title  '; title.dispatchEvent(new Event('input', { bubbles: true }));
    const receipt = await c.retainRecovery();
    return { receipt, record: await window.barkdown.paperDrafts.read(receipt.key), dirty: c.isDirty() };
  });
  assert.equal(first.receipt.current, true); assert.equal(first.dirty, true);
  assert.equal(first.record.content.draft.title, '  My unfinished title  ');
  assert.match(JSON.stringify(first.record.content.draft.snapshot), /before debounce/);
  report.checks.push('Actual debounced code and raw title retained through profile IPC before a server save.');
  await shot('01-unsaved-rich-draft');
  const label = page.locator('[data-test-id="paper-note-label"]'); await label.click();
  await page.keyboard.press('Control+End');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
  await assert.rejects(retain(), /Finish composing/);
  assert.match(await label.innerText(), /にほん/);
  await shot('02-composition-preserved');
  await cdp.send('Input.insertText', { text: '日本' });
  const composed = await retain();
  const committed = await page.evaluate(key => window.barkdown.paperDrafts.read(key), composed.key);
  assert.match(JSON.stringify(committed.content.draft.snapshot), /日本/);
  report.checks.push('Chromium IME refuses preparation mid-composition without ending it; committed Japanese text is then retained.');
  // Enter the canvas's public source-mode operation; it must stay in that mode.
  await page.evaluate(() => document.querySelector('bp-paper-canvas').toggleSourceMode());
  const raw = '# Exact source  \n\nKeep **my spacing**.\n';
  await page.locator('.bp-canvas-source').fill(raw);
  const markdown = await retain();
  const saved = await page.evaluate(key => window.barkdown.paperDrafts.read(key), markdown.key);
  assert.equal(saved.content.draft.snapshot.raw_source, raw);
  assert.equal(await page.locator('.bp-canvas-source').inputValue(), raw);
  await page.setViewportSize({ width: 900, height: 760 }); await shot('03-raw-source-narrow');
  report.checks.push('Exact Markdown source retained without leaving source mode.');
  const frozen = await page.evaluate(async () => {
    const c = [...window.__barkdown.controllers.values()].find(c => c.el.matches('.bw-paper-pane'));
    window.__draftFreeze = await c.freezeRecovery();
    return { current: window.__draftFreeze.assertCurrent(), inert: c.el.inert };
  });
  assert.equal(frozen.current, true); assert.equal(frozen.inert, true);
  await page.keyboard.type('This must not replace the draft');
  assert.equal(await page.locator('.bp-canvas-source').inputValue(), raw);
  assert.equal(await page.evaluate(() => window.__draftFreeze.assertCurrent()), true);
  await shot('04-frozen-source-narrow');
  await page.evaluate(() => { window.__draftFreeze.release(); delete window.__draftFreeze; });
  assert.equal(await page.locator('.bw-paper-pane').evaluate(pane => pane.inert), false);
  report.checks.push('Held Paper freeze blocks native keyboard input; explicit lease release restores interaction.');
  const before = await page.evaluate(() => window.barkdown.paperDrafts.list());
  assert(before.length >= 3);
  // Abrupt exit, not graceful close/flush, must not be needed to keep records.
  const mainPid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, mainPid);
  const exited = new Promise(resolve => app.process().once('exit', resolve));
  process.kill(mainPid, 'SIGKILL'); await exited; app = null;
  app = await launch(); page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const after = await page.evaluate(() => window.barkdown.paperDrafts.list());
  assert.deepEqual(after, before);
  assert.deepEqual(await page.evaluate(key => window.barkdown.paperDrafts.read(key), markdown.key), saved);
  report.checks.push('Abrupt desktop exit and restart preserve every retained version byte-for-byte.');
  await app.close(); app = null;
  registry.selectProfile(b.id);
  app = await launch(); page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.deepEqual(await page.evaluate(() => window.barkdown.paperDrafts.list()), []);
  await assert.rejects(page.evaluate(key => window.barkdown.paperDrafts.read(key), markdown.key), /ENOENT/);
  report.checks.push('Another profile sees none of the same-slug recovery records.');
  report.status = 'passed'; report.refusedServerWrites = writes; persist(); console.log(JSON.stringify({ out, checks: report.checks, status: report.status }));
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) {
    report.visibleFailure = await page.locator('body').innerText().catch(() => 'Unavailable');
    await shot('failure').catch(() => {});
  }
  persist(); throw error;
}
finally { if (app) await app.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); }
