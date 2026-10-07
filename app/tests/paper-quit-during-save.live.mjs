// Shutdown during a save (A3). Real Electron, managed runtime. The person types and quits at
// once, before the editor's own save has run; and once more with the database already dead.
// After each restart: the words are on the note exactly once, or kept as a retained draft
// that the note names and can put back.
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
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-quit-during-save');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-quit-save-')));
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One machine, one run, one note. The quit is the app\'s own quit, asked for in the same moment the last key is pressed; a kill of the process while a save is in flight is not produced here (a killed host is covered by the reclaim rehearsal, where unsaved keystrokes of the last moments are lost).'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), pgData = path.join(dataDir, 'pgdata'), record = createRuntimeRecord({ dataDir, log: () => {} });
const pgCtl = path.join(toolchain({ source, port: 1, pgPort: 2 }).pgBin, 'pg_ctl');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
let app, page, stderr = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  stderr = [];
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => { const started = Date.now(); for (;;) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') return; if (s.phase === 'failed') throw new Error('Profile runtime failed: ' + s.error); if (Date.now() - started > 300000) throw new Error('Profile runtime not ready'); await new Promise(resolve => setTimeout(resolve, 500)); } };
const quit = async () => { let timer; try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000); })]); } finally { clearTimeout(timer); } };
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const once = (text, words) => text.split(words).length === 2;
try {
  await launch(); await runtimeReady();
  const note = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const open = () => page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: note.id, paperOwner: note.paperOwner });
  const read = () => page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: note.id, paperOwner: note.paperOwner });
  await open();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Ferry log'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Saved long before the quit.'); await paperSaved();
  const before = await read();

  // Quit in the moment the last key is pressed.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed in the last second before quitting.', { delay: 0 });
  assert.equal(await page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas').hasPendingChanges()), true, 'the editor has not saved these words yet');
  await quit();
  const quitLog = stderr.join('').split('\n').filter(l => l.startsWith('[quit]'));
  await launch(); await runtimeReady();
  const first = await read();
  assert.ok(once(first.markdown, 'Saved long before the quit.'));
  assert.ok(once(first.markdown, 'Typed in the last second before quitting.'), 'the words of the last second are on the note, once: ' + first.markdown);
  assert.ok(first.rev > before.rev);
  assert.equal(await page.evaluate(({ id, paperOwner, rev }) => window.barkdown.paperDrafts.unsaved({ id, paperOwner, rev }), { id: note.id, paperOwner: note.paperOwner, rev: first.rev }), null, 'nothing is marked unsaved');
  report.checks.push({ name: 'Quit in the moment the last key is pressed: the pending words are sent before the library stops and are on the note once after the restart', fromRev: before.rev, rev: first.rev, quitLog }); persist();

  // The same with the database already dead: nothing can be sent.
  await open();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Typed in the last second' }).waitFor({ timeout: 60000 });
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last().click();
  await page.keyboard.press(LINE_END);
  execFileSync(pgCtl, ['-D', pgData, '-m', 'immediate', '-w', '-t', '20', 'stop'], { stdio: 'ignore' });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed with the database dead, then quit at once.', { delay: 0 });
  await quit();
  const secondLog = stderr.join('').split('\n').filter(l => l.startsWith('[quit]'));
  assert.ok(secondLog.some(l => /1 note not saved at quit: 1 kept as retained drafts/.test(l)), secondLog.join(' | ') || 'no quit line');
  await launch(); await runtimeReady();
  const second = await read();
  assert.ok(once(second.markdown, 'Typed in the last second before quitting.'), 'everything acknowledged is intact');
  assert.ok(!second.markdown.includes('Typed with the database dead'), 'the unsent words are not on the note');
  await open();
  const told = page.locator('.bw-paper-pane:not([hidden]) [data-unsaved-words]');
  await told.waitFor({ timeout: 60000 });
  await shot('01-reopened-note-names-the-unsaved-words');
  await told.locator('[data-act="restore"]').click(); await told.locator('[data-act="restore"]').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Typed with the database dead, then quit at once.' }).waitFor({ timeout: 60000 });
  const back = await read();
  for (const words of ['Saved long before the quit.', 'Typed in the last second before quitting.', 'Typed with the database dead, then quit at once.']) assert.ok(once(back.markdown, words), `"${words}" is in the note exactly once`);
  assert.equal(back.title, 'Ferry log');
  await shot('02-words-put-back');
  report.checks.push({ name: 'Quit at once with the database dead: the words are kept as a retained draft at quit, the reopened note names them, and putting them back leaves every sentence in the note once', quitLog: secondLog }); persist();
  // Real recovery-store refusal in this disposable profile. Read-only renderer
  // admission controls the unsaved case; no production library or provider runs.
  const draftDir = path.join(dir, 'paper-drafts'), previousDraftDir = path.join(dir, 'paper-drafts-before-refusal');
  assert.equal(path.dirname(draftDir), path.resolve(dir));
  if (fs.existsSync(draftDir)) fs.renameSync(draftDir, previousDraftDir);
  fs.writeFileSync(draftDir, 'Controlled recovery-store obstruction; original directory retained beside it.');
  await app.evaluate(({ dialog }) => { globalThis.__quitRefusals = []; dialog.showMessageBox = async (_win, options) => { globalThis.__quitRefusals.push(options); return { response: 0 }; }; });
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last().click();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.writes = false; });
  await page.keyboard.type('Words that must survive a refused quit.', { delay: 0 });
  assert.equal(await page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas').hasPendingChanges()), true);
  await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); });
  const refusalStarted = Date.now();
  for (;;) {
    const refusals = await app.evaluate(() => globalThis.__quitRefusals);
    if (refusals.length) { report.refusal = refusals; break; }
    if (Date.now() - refusalStarted > 20000) throw new Error('Quit did not report the retained-draft refusal');
    await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => !document.querySelector('#app').inert);
  assert.match(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText(), /Words that must survive a refused quit/);
  assert.ok(alive(record.read().pid), 'refusal leaves the owned runtime running');
  await shot('03-quit-refused-words-still-open');
  await page.setViewportSize({ width: 720, height: 800 }); await shot('04-quit-refused-narrow');
  await page.setViewportSize({ width: 1300, height: 900 });
  fs.renameSync(draftDir, path.join(dir, 'retained-refusal-obstruction.txt'));
  if (fs.existsSync(previousDraftDir)) fs.renameSync(previousDraftDir, draftDir);
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.writes = true; });
  await quit(); await launch(); await runtimeReady();
  const afterRefusal = await read();
  const marker = await page.evaluate(({ id, paperOwner, rev }) => window.barkdown.paperDrafts.unsaved({ id, paperOwner, rev }), { id: note.id, paperOwner: note.paperOwner, rev: afterRefusal.rev });
  const retained = marker ? await page.evaluate(key => window.barkdown.paperDrafts.read(key), marker.key) : null;
  assert.ok(afterRefusal.markdown.includes('Words that must survive a refused quit.') || JSON.stringify(retained?.content.draft.snapshot).includes('Words that must survive a refused quit.'), 'retry/restart preserves the exact words in the note or verified owned retained copy');
  report.checks.push({ name: 'Recovery-store refusal keeps window and words open; after restoring disposable storage, retry/restart preserves current words', saved: afterRefusal.markdown.includes('Words that must survive a refused quit.'), retainedKey: marker?.key, limits: 'Renderer write permission is controlled to keep unsaved content pending; native error dialog is intercepted, its exact request recorded. The recovery-store filesystem failure and refusal/retry/restart are real.' }); persist();
  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(record.read(), null, 'a clean quit leaves nothing to reclaim');
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').split('\n').filter(l => !/IMK/.test(l)).slice(-30); persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  let left = null; try { left = record.read(); } catch {}
  if (left?.pid && alive(left.pid)) { try { process.kill(-left.pid, 'SIGTERM'); } catch {} }
  try { execFileSync(pgCtl, ['-D', pgData, '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {}
  throw error;
}
