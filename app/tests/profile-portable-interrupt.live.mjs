// Export and import interrupted by a host that dies (C085). Real Electron, managed runtimes,
// a real kill of the main process in the middle of each. The export is stalled while it copies
// the profile's files under the hold; the import is stalled after its database was restored
// and while that database still runs. After each kill the app is launched again:
// the interrupted export is named, discarded from the notice and taken again; the unfinished
// import is listed, cannot be opened, and is run again from its export folder.
// Needs a built Barkpark checkout at BARKDOWN_TEST_BP_SOURCE (default ../../barkpark-editor).
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { verifyExport } = require('../main/profile-export');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-portable-interrupt');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-portable-int-')));
const chosen = path.join(userData, 'chosen-by-the-person'), trash = path.join(userData, 'trash-stand-in'), marker = path.join(userData, 'stalled');
fs.mkdirSync(chosen); fs.mkdirSync(trash);
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One machine, one run, a small library. One stall point per operation: the export while it copies profile files under the hold, the import after its database was restored. The host is ended with SIGKILL. The native folder picker and the system trash are stubbed in the main process (the trash stand-in is a folder of this rehearsal). POSIX only.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
registry.selectProfile(profile.id);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
const records = () => registry.load().profiles.map(p => { try { return createRuntimeRecord({ dataDir: path.join(registry.storeFor(p.id).storeDir, 'local-barkpark', 'runtime'), log: () => {} }).read(); } catch { return null; } }).filter(Boolean);
let app, page, stderr = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  stderr = [];
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  // The picker answers with what the rehearsal chose; the trash is a folder of this rehearsal.
  await app.evaluate(({ shell }, trashDir) => { const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'); shell.trashItem = async item => { fs.renameSync(item, path.join(trashDir, path.basename(item) + '-' + Date.now())); }; }, trash);
};
const pick = folder => app.evaluate(({ dialog }, chosenFolder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenFolder] }); }, folder);
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
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
// Stall the main process at one call and end it there.
const killAtStall = async () => {
  const started = Date.now();
  while (!fs.existsSync(marker)) { if (Date.now() - started > 240000) throw new Error('The operation never reached its stall point'); await new Promise(resolve => setTimeout(resolve, 200)); }
  const pid = app.process().pid, at = fs.readFileSync(marker, 'utf8');
  process.kill(pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 4000));
  assert.equal(alive(pid), false, 'the host is gone');
  fs.rmSync(marker);
  return at;
};
const library = async () => (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => p.id).sort();
try {
  await launch(); await runtimeReady();
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const before = await library();
  assert.ok(before.length >= 3, JSON.stringify(before));

  // The export, killed while it copies the profile's files under the hold.
  await pick(chosen);
  await app.evaluate((_electron, { folder, file }) => {
    const fs = process.getBuiltinModule('fs'), original = fs.copyFileSync;
    fs.copyFileSync = (from, to, ...rest) => { if (String(to).startsWith(folder)) { fs.writeFileSync(file, String(to)); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600000); } return original(from, to, ...rest); };
  }, { folder: chosen, file: marker });
  await openSettings();
  page.locator('#profile-export').click().catch(() => {});
  const exportStalledAt = await killAtStall();
  const partial = fs.readdirSync(chosen);
  assert.equal(partial.length, 1); assert.ok(fs.existsSync(path.join(chosen, partial[0], 'database.dump'))); assert.ok(!fs.existsSync(path.join(chosen, partial[0], 'manifest.json')));
  const left = records();
  assert.ok(left.length === 1 && alive(left[0].pid), 'the runtime outlived its host, still held');
  report.checks.push({ name: 'The host is killed while the export copies profile files under the hold: a partial folder with a dump and no manifest, the runtime left running', stalledAt: path.relative(chosen, exportStalledAt) }); persist();

  await launch(); await runtimeReady();
  assert.ok(stderr.join('').includes('[runtime] reclaimed after host'), 'the leftover runtime was reclaimed');
  const notice = page.locator('.bw-preparation-notice', { hasText: 'An export of this profile was interrupted' });
  await notice.waitFor({ timeout: 30000 });
  assert.match(await notice.locator('p').textContent(), /Its folder is incomplete and cannot be imported: .*Barkdown export - Writing desk/);
  assert.equal(await notice.locator('[data-discard-export]').isVisible(), true); assert.equal(await notice.locator('[data-abort]').isHidden(), true);
  await assert.rejects(page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID())), /preparing|paused|held|unavailable|admission/i, 'writing is refused while the interrupted export stands');
  await shot('01-interrupted-export-named');
  await notice.locator('[data-discard-export]').click();
  const discarded = page.locator('.bw-preparation-notice', { hasText: 'The interrupted export was discarded' });
  await discarded.waitFor({ timeout: 120000 });
  assert.match(await discarded.locator('p').textContent(), /its partial folder is in the trash/);
  assert.equal(await discarded.locator('[data-restart]').isVisible(), true);
  await shot('02-interrupted-export-discarded');
  assert.deepEqual(fs.readdirSync(chosen), [], 'the partial folder left the chosen folder');
  assert.equal(fs.readdirSync(trash).length, 1, 'and is in the trash');
  const journal = JSON.parse(fs.readFileSync(path.join(dir, 'profile-export-last.json'), 'utf8'));
  assert.equal(journal.status, 'discarded');
  await quit(); await launch(); await runtimeReady();
  const after = page.locator('.bw-preparation-notice', { hasText: 'The interrupted export was discarded' });
  await after.waitFor({ timeout: 30000 }); await after.locator('[data-dismiss]').click();
  assert.deepEqual(await library(), before, 'the library is intact');
  await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const grown = await library();
  assert.equal(grown.length, before.length + 1, 'writing works again');
  report.checks.push({ name: 'The next launch reclaims the runtime and names the interrupted export; Discard reopens the runtime, moves the partial folder to the trash and releases the preparation; after a restart the library is intact and writable', runtimeAfterDiscard: journal.hold }); persist();

  // The export, taken again.
  await pick(chosen); await openSettings();
  await page.locator('#profile-export').click();
  const exported = page.locator('.bw-preparation-notice', { hasText: 'The export completed' });
  await exported.waitFor({ timeout: 180000 });
  const exportDir = path.join(chosen, fs.readdirSync(chosen)[0]);
  const verified = verifyExport(exportDir);
  assert.equal(verified.manifest.counts.papers + (verified.manifest.counts.drafts || 0), grown.length);
  await quit(); await launch(); await runtimeReady();
  const completed = page.locator('.bw-preparation-notice', { hasText: 'The export completed' });
  await completed.waitFor({ timeout: 30000 }); await completed.locator('[data-dismiss]').click();
  report.checks.push({ name: 'The export taken again completes and verifies', files: verified.files }); persist();

  // The import, killed after its database was restored and while that database runs.
  await pick(exportDir);
  await app.evaluate((_electron, { media, file }) => {
    const fs = process.getBuiltinModule('fs'), original = fs.existsSync;
    fs.existsSync = target => { if (String(target) === media) { fs.writeFileSync(file, String(target)); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600000); } return original(target); };
  }, { media: path.join(exportDir, 'media'), file: marker });
  await openSettings();
  page.locator('#profile-import').click().catch(() => {});
  await killAtStall();
  const half = registry.load().profiles.find(p => p.id !== profile.id);
  assert.ok(half, 'a half-made profile is in the registry');
  const halfDir = registry.storeFor(half.id).storeDir;
  assert.equal(JSON.parse(fs.readFileSync(path.join(halfDir, 'profile-import.json'), 'utf8')).phase, 'restoring');
  const pgData = path.join(halfDir, 'local-barkpark', 'runtime', 'pgdata');
  const databaseRuns = () => { try { execFileSync('pg_ctl', ['-D', pgData, 'status'], { stdio: 'ignore' }); return true; } catch { return false; } };
  assert.equal(databaseRuns(), true, 'its private database outlived the host');
  report.checks.push({ name: 'The host is killed after the import restored its database: a profile with a journal at restoring, its private database left running' }); persist();

  await launch(); await runtimeReady();
  const still = page.locator('.bw-preparation-notice', { hasText: 'The export completed' });
  await still.waitFor({ timeout: 30000 }); await still.locator('[data-dismiss]').click();
  assert.deepEqual(await library(), grown, 'the current profile is untouched');
  await openSettings();
  const row = page.locator('#profile-settings .bw-set', { hasText: 'Unfinished import: Writing desk (imported)' });
  await row.waitFor({ timeout: 30000 });
  assert.equal(await page.locator(`#profile-choice option[value="${half.id}"]`).isDisabled(), true, 'it cannot be chosen');
  await assert.rejects(page.evaluate(id => window.barkdown.profiles.select(id), half.id), /did not finish/, 'and cannot be opened');
  await row.scrollIntoViewIfNeeded();
  await shot('03-unfinished-import-listed');
  await row.locator('[data-import-again]').click();
  await page.waitForFunction(() => /^Imported /.test(document.querySelector('#profile-import-status')?.textContent || '') || document.querySelector('.bw-set-note.err')?.textContent, null, { timeout: 300000 });
  const said = await page.locator('#profile-import-status').textContent();
  assert.match(said, /^Imported “Writing desk \(imported\)” with \d+ Papers?\./, said + ' ' + stderr.join('').slice(-800));
  await page.locator('#profile-import-status').scrollIntoViewIfNeeded();
  await shot('04-imported-again');
  assert.equal(databaseRuns(), false, 'the leftover database was stopped');
  assert.equal(fs.existsSync(halfDir), false, 'the half-made profile left the registry folder');
  assert.equal(fs.readdirSync(trash).length, 2, 'and is in the trash');
  const profiles = registry.load().profiles;
  assert.equal(profiles.length, 2); assert.ok(!profiles.some(p => p.id === half.id));
  const imported = profiles.find(p => p.id !== profile.id);
  assert.equal(await page.locator('#profile-settings .bw-set', { hasText: 'Unfinished import' }).count(), 0);
  await page.locator('#profile-choice').selectOption(imported.id);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, imported.id, { timeout: 60000 });
  await runtimeReady();
  assert.deepEqual(await library(), grown, 'the imported profile serves the same library');
  report.checks.push({ name: 'The next launch lists the unfinished import, refuses to open it, and Import again stops its leftover database, moves it to the trash and imports from the same export; the imported profile opens with the same library' }); persist();
  assert.equal(verifyExport(exportDir).files, verified.files, 'the export folder is unchanged');
  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.deepEqual(records(), [], 'a clean quit leaves nothing to reclaim');
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').slice(-3000);
  try { report.notice = await page.locator('.bw-preparation-notice p').textContent({ timeout: 2000 }); } catch {}
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  // Only what this rehearsal launched: recorded process groups and the private databases under its folder.
  for (const r of records()) if (r.pid && alive(r.pid)) { try { process.kill(-r.pid, 'SIGTERM'); } catch {} }
  for (const p of registry.load().profiles) { try { execFileSync('pg_ctl', ['-D', path.join(registry.storeFor(p.id).storeDir, 'local-barkpark', 'runtime', 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {} }
  throw error;
}
