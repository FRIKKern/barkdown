// A save refused by a conflict at quit (A3). Real Electron + owned local Paper runtime. Another writer moves the note
// while the person types; they quit at once, so the save is refused (412) and the words are kept as a retained draft.
// After the restart the other writer moves the note once more. Opening the note names the words ("Words were not
// saved"), and its one action puts them back. Then: a marker for a failure that was not a conflict, at an older
// revision, is not shown, so old words do not come back over newer ones (that marker is written through the app's
// own IPC; the rule itself is in tests/paper-unsaved.test.mjs).
// Run: heavy env TMPDIR=/private/tmp/ BARKDOWN_TEST_BP_SOURCE=<packaged runtime> node tests/paper-quit-conflict.live.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appDir = path.resolve('.'), userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-quit-conflict-')));
const out = path.join(appDir, 'test-results/paper-quit-conflict', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
setTimeout(() => { console.error('paper-quit-conflict: stuck'); process.exit(1); }, 900000).unref();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Quit conflict' });
createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { decided: true, enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);

const results = [], errors = [];
let app, page, stderr = [];
const step = name => { results.push(name); console.log('ok ' + name); };
const launch = async () => {
  stderr = [];
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData], timeout: 180000, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1300, height: 900 });
  const started = Date.now();
  for (;;) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); if (Date.now() - started > 300000) throw new Error('runtime not ready'); await new Promise(r => setTimeout(r, 500)); }
};
const quit = async () => { let timer; try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000); })]); } finally { clearTimeout(timer); } app = null; };
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const pane = () => page.locator('.bw-paper-pane:not([hidden])');
let note;
const open = () => page.evaluate(n => window.__barkdown.openTarget({ kind: 'doc', id: n.id, source: 'barkpark', paperOwner: n.paperOwner }), note);
const read = () => page.evaluate(n => window.barkdown.barkpark.get(n.id, undefined, n.paperOwner), note);
const otherWriter = line => page.evaluate(async ({ n, line }) => { const p = await window.barkdown.barkpark.get(n.id, undefined, n.paperOwner); return (await window.barkdown.barkpark.applyOps(n.id, [{ op: 'append-block', block: { type: 'paragraph', content: [{ type: 'text', value: line }] } }], p.rev, p.binding)).rev; }, { n: note, line });
const saved = () => page.waitForFunction(() => { const p = document.querySelector('.bw-paper-pane:not([hidden])'); return p?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !p.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const once = (text, words) => text.split(words).length === 2;
const WORDS = 'Words refused by a conflict at quit.';
try {
  await launch();
  note = await page.evaluate(i => window.barkdown.barkpark.createNoteWith(i), { requestId: crypto.randomUUID(), title: 'Harbour log', markdown: 'Saved base line.' });
  await page.evaluate(() => window.__barkdown.refreshLibrary());
  await open(); await pane().locator('.ProseMirror', { hasText: 'Saved base line.' }).waitFor(); await saved();
  const base = (await read()).rev;

  // 1. Another writer moves the note; the person types and quits at once. The save is refused and the words kept.
  const refused = await otherWriter('Other writer, before the quit.');
  await pane().locator('.ProseMirror p').last().click(); await page.keyboard.press('End');
  await page.keyboard.type(' ' + WORDS, { delay: 0 });
  await quit();
  const quitLog = stderr.join('').split('\n').filter(l => l.startsWith('[quit]'));
  assert.ok(quitLog.some(l => /1 note not saved at quit: 1 kept as retained drafts/.test(l)), quitLog.join(' | ') || 'no quit line');
  step(`conflict at quit: the library was at rev ${refused} (the tab at ${base}), the words were kept as a retained draft`);

  // 2. After the restart the note moves on once more; opening it names the words.
  await launch();
  const movedOn = await otherWriter('Other writer, after the restart.');
  const before = await read();
  assert.ok(!before.markdown.includes(WORDS), 'the refused words are not on the note');
  assert.ok(movedOn > refused);
  await open();
  const told = pane().locator('[data-unsaved-words]');
  await told.waitFor({ timeout: 60000 });
  assert.match(await told.innerText(), /Words were not saved/);
  await shot('01-reopened-note-names-the-refused-words');
  step(`reopened at rev ${movedOn}, past the refusal at ${refused}: the note says "Words were not saved"`);

  // 3. Its action puts the words back: one revision-checked write; the text it replaced is in the history.
  const marker = await page.evaluate(({ n, rev }) => window.barkdown.paperDrafts.unsaved({ id: n.id, paperOwner: n.paperOwner, rev }), { n: note, rev: movedOn });
  await told.locator('[data-act="restore"]').click(); await told.locator('[data-act="restore"]').click();
  await pane().locator('.ProseMirror', { hasText: WORDS }).waitFor({ timeout: 60000 });
  const back = await read();
  assert.ok(once(back.markdown, WORDS), 'the kept words are on the note once: ' + back.markdown);
  assert.ok(once(back.markdown, 'Saved base line.'));
  assert.equal(back.rev, movedOn + 1, 'one write');
  assert.equal(await told.count(), 0, 'the notice is gone');
  assert.equal(await page.evaluate(({ n, rev }) => window.barkdown.paperDrafts.unsaved({ id: n.id, paperOwner: n.paperOwner, rev }), { n: note, rev: back.rev }), null, 'the marker is cleared');
  await saved();
  await shot('02-words-put-back');
  step(`"Put the words back" wrote rev ${back.rev}; the words are on the note once and the marker is cleared`);

  // 4. A marker for a failure that was not a conflict, at an older revision, is not shown: its words may be on a newer
  //    revision already, and putting them back would bring old words over new ones.
  await page.evaluate(({ n, key, rev }) => window.barkdown.paperDrafts.markUnsaved({ id: n.id, paperOwner: n.paperOwner, key, rev }), { n: note, key: marker.key, rev: base });
  await page.evaluate(() => { const b = window.__barkdown, c = b.state.chats[b.state.current]; return b.controllers.get(c.active).navigate(); });
  await pane().locator('.ProseMirror', { hasText: WORDS }).waitFor(); await saved();
  await page.waitForTimeout(1500);
  assert.equal(await pane().locator('[data-unsaved-words]').count(), 0, 'an older marker that was not a conflict is not shown');
  step('a marker at an older revision without a conflict is not shown, so no old words come back');
  assert.deepEqual(errors, []);
  await quit();
  console.log('PASS', results);
} catch (error) {
  if (page && !page.isClosed()) await shot('99-failure').catch(() => {});
  console.error('FAIL', results, errors, stderr.join('').split('\n').filter(l => !/IMK/.test(l)).slice(-20));
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  console.log('Evidence:', out, 'Retained data:', userData);
}
