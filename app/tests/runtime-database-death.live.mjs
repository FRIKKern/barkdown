// The database dies while the app runs (A3). Real Electron, managed runtime. A note is open
// and saved; the profile's private Postgres is stopped at once, as a crash would; the person
// keeps typing. Asked of the app: what is said on screen, whether the runtime comes back by
// itself, whether the words typed during the outage are kept and saved, and whether every
// acknowledged word is still there after a restart.
// Needs a built Barkpark checkout at BARKDOWN_TEST_BP_SOURCE (default ../../barkpark-editor).
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { LINE_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const { toolchain } = require('../main/local-barkpark-source');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-database-death');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-db-death-')));
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [], observed: [],
  limits: ['One machine, one run, one note. The database is stopped with pg_ctl in immediate mode on the profile\'s private directory, which ends it the way a crash does; a disk failure or a corrupted cluster is not produced.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), pgData = path.join(dataDir, 'pgdata'), record = createRuntimeRecord({ dataDir, log: () => {} });
const pgCtl = path.join(toolchain({ source, port: 1, pgPort: 2 }).pgBin, 'pg_ctl');
const databaseRuns = () => { try { execFileSync(pgCtl, ['-D', pgData, 'status'], { stdio: 'ignore' }); return true; } catch { return false; } };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
let app, page, stderr = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  stderr = [];
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  await app.context().addInitScript(() => { window.__toasts = []; new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches?.('.bw-toast, .bw-toast *')) window.__toasts.push(n.textContent); }).observe(document.documentElement, { childList: true, subtree: true }); });
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const phase = () => page.evaluate(() => window.barkdown.barkpark.localStatus()).then(s => s.phase, () => 'pending');
const runtimeReady = async (limit = 300000) => { const started = Date.now(); for (;;) { const p = await phase(); if (p === 'ready') return Date.now() - started; if (p === 'failed') throw new Error('Profile runtime failed'); if (Date.now() - started > limit) throw new Error('Profile runtime not ready: ' + p); await new Promise(resolve => setTimeout(resolve, 500)); } };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
const saveState = () => page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || '');
const paperSaved = (timeout = 60000) => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout });
try {
  await launch(); await runtimeReady();
  const note = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: note.id, paperOwner: note.paperOwner });
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Tide table'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Acknowledged before the database died.'); await paperSaved();
  const read = () => page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: note.id, paperOwner: note.paperOwner });
  const before = await read();
  assert.match(before.markdown, /Acknowledged before the database died\./);
  const runtimeBefore = record.read();

  execFileSync(pgCtl, ['-D', pgData, '-m', 'immediate', '-w', '-t', '20', 'stop'], { stdio: 'ignore' });
  assert.equal(databaseRuns(), false, 'the database is gone');
  const diedAt = Date.now();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed while the database was gone.');
  // What the person sees while it is gone, and how the runtime comes back.
  const seen = new Set(), phases = [];
  let readyAgain = null;
  while (Date.now() - diedAt < 240000) {
    const p = await phase(), s = await saveState();
    if (phases.at(-1) !== p) phases.push(p);
    if (s) seen.add(s.replace(/rev \d+/, 'rev N').slice(0, 120));
    if (phases.includes('recovering') && p === 'ready') { readyAgain = Date.now() - diedAt; break; }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  report.observed.push({ phases, saveStates: [...seen], toasts: await page.evaluate(() => window.__toasts), readyAgainMs: readyAgain }); persist();
  await shot('01-after-the-database-came-back');
  assert.ok(readyAgain, 'the runtime came back by itself: ' + phases.join(' > '));
  assert.equal(databaseRuns(), true);
  const runtimeAfter = record.read();
  assert.ok(runtimeAfter && runtimeAfter.pid !== runtimeBefore.pid && !alive(runtimeBefore.pid), 'the runtime was restarted with its database');
  report.checks.push({ name: 'The database is stopped at once under an open note: the supervisor notices, restarts the runtime with its database, and reports ready again by itself', phases, readyAgainMs: readyAgain }); persist();

  // The words typed during the outage.
  assert.match(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').textContent(), /Typed while the database was gone\./, 'the editor kept the words');
  await paperSaved(60000);
  const savedBy = 'itself, when the library was back';
  const after = await read();
  assert.match(after.markdown, /Acknowledged before the database died\./); assert.match(after.markdown, /Typed while the database was gone\./);
  assert.equal(after.title, 'Tide table');
  await shot('02-words-typed-during-the-outage-saved');
  report.checks.push({ name: 'The words typed while the database was gone stayed in the editor and were saved after it came back; the acknowledged words are intact', savedBy, stateAfter: await saveState() }); persist();

  // A second outage, and this time the person quits while the library is still away.
  execFileSync(pgCtl, ['-D', pgData, '-m', 'immediate', '-w', '-t', '20', 'stop'], { stdio: 'ignore' });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed during the second outage and left unsaved.');
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent === 'Not saved', null, { timeout: 60000 });
  await page.locator('.bw-paper-pane:not([hidden]) #conflict [data-kept]:not([hidden])').waitFor({ timeout: 30000 });
  const offered = await page.locator('.bw-paper-pane:not([hidden]) #conflict').textContent();
  assert.match(offered, /The library did not answer\. It restarts by itself and your words are sent again then\. Your words are kept as a retained draft\./);
  await shot('03-not-saved-words-kept');
  await quit(); await launch(); await runtimeReady();
  const left = await read();
  const drafts = await page.evaluate(() => window.barkdown.paperDrafts.list());
  const mine = drafts.filter(d => d.documentId === note.id);
  assert.ok(mine.length >= 1, 'a retained draft of this note exists');
  // The note remembers which retained draft holds the words its last save could not deliver.
  const marked = await page.evaluate(({ id, paperOwner, rev }) => window.barkdown.paperDrafts.unsaved({ id, paperOwner, rev }), { id: note.id, paperOwner: note.paperOwner, rev: left.rev });
  assert.ok(marked?.key, 'the note names its unsaved words');
  const keptText = JSON.stringify((await page.evaluate(key => window.barkdown.paperDrafts.read(key), marked.key)).content.draft.snapshot);
  report.observed.push({ afterQuitWithUnsavedWords: { onThePaper: /Typed during the second outage/.test(left.markdown), retainedDrafts: mine.length, offeredOnScreen: offered.slice(0, 240) } }); persist();
  assert.match(left.markdown, /Typed while the database was gone\./, 'everything acknowledged is intact');
  if (!/Typed during the second outage/.test(left.markdown)) {
    assert.match(keptText, /Typed during the second outage and left unsaved\./, 'the retained draft holds the unsaved words');
    await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: note.id, paperOwner: note.paperOwner });
    const told = page.locator('.bw-paper-pane:not([hidden]) [data-unsaved-words]');
    await told.waitFor({ timeout: 60000 });
    await shot('04-reopened-note-says-words-were-not-saved');
    await told.locator('[data-act="drafts"]').click();
    await page.getByRole('dialog').locator('option', { hasText: 'Tide table' }).first().waitFor({ state: 'attached', timeout: 30000 });
    await shot('05-retained-drafts-opened-from-the-note');
    await page.keyboard.press('Escape');
    // The words are put back from the note itself: one revision-checked write, the replaced text in history.
    const restore = told.locator('[data-act="restore"]');
    await restore.click();
    assert.match(await restore.textContent(), /^Confirm: replace this note/);
    await restore.click();
    await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Typed during the second outage and left unsaved.' }).waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.bw-paper-pane:not([hidden]) [data-unsaved-words]'));
    const back = await read();
    for (const words of ['Acknowledged before the database died.', 'Typed while the database was gone.', 'Typed during the second outage and left unsaved.']) assert.equal(back.markdown.split(words).length, 2, `"${words}" is in the note exactly once`);
    assert.equal(back.title, 'Tide table'); assert.ok(back.rev > left.rev);
    assert.equal(await page.evaluate(({ id, paperOwner, rev }) => window.barkdown.paperDrafts.unsaved({ id, paperOwner, rev }), { id: note.id, paperOwner: note.paperOwner, rev: back.rev }), null);
    await shot('06-words-put-back');
    report.checks.push({ name: 'The kept words are put back from the note: one revision-checked write, every sentence once, the title kept, the mark cleared', fromRev: left.rev, rev: back.rev }); persist();
  }
  report.checks.push({ name: 'Words left unsaved at quit while the library was away are not lost: they are a retained draft, and the reopened note says so and opens the retained drafts', where: /Typed during the second outage/.test(left.markdown) ? 'on the Paper' : 'in a retained draft' }); persist();
  const again = await read(), afterSecond = again;
  assert.match(again.markdown, /Typed during the second outage and left unsaved\./, 'the words are there after another restart');
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()))).id, 'writing works');
  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(record.read(), null); assert.equal(databaseRuns(), false, 'a clean quit leaves nothing running');
  report.checks.push({ name: 'After a restart the note reads the same, revision included, and writing works; a clean quit leaves nothing running' }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').split('\n').filter(l => !/IMK/.test(l)).slice(-30);
  try { report.toasts = await page.evaluate(() => window.__toasts); report.saveState = await saveState(); report.phase = await phase(); } catch {}
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  let left = null; try { left = record.read(); } catch {}
  if (left?.pid && alive(left.pid)) { try { process.kill(-left.pid, 'SIGTERM'); } catch {} }
  try { execFileSync(pgCtl, ['-D', pgData, '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {}
  throw error;
}
