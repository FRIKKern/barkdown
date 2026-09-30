// Barkdown on a packaged Barkpark release (P5 groundwork): no checkout, no Elixir, no mix.
// Real Electron started with a PATH that holds only the system folders. The profile's runtime
// is the release built by scripts/build-runtime-release.mjs. Shown: first boot, a note written
// and found again after a restart, an export and its import as a new profile, and a killed app
// whose runtime is reclaimed. The runtime folder may carry its own Postgres.
// Needs BARKDOWN_TEST_BP_RELEASE (default ../runtime/barkpark-<pin>-<platform>-<arch>).
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
const { releaseOf, toolchain } = require('../main/local-barkpark-source');
const { verifyExport } = require('../main/profile-export');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
const packaged = releaseOf(release);
if (!packaged?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-runtime-release');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-release-'))), carry = path.join(userData, 'carried'); fs.mkdirSync(carry);
const systemPath = '/usr/bin:/bin:/usr/sbin:/sbin';
const report = { source: host, upstream: packaged.upstream, release: path.basename(release), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One Mac, one run, a small library. The release and its Postgres were built on this machine, for this macOS version and this processor; a Mac without developer tools has not run it. The app itself runs from source under Electron, not as an installed application. The native folder picker is stubbed. No Windows: the upstream release is assembled for unix hosts only.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), record = createRuntimeRecord({ dataDir, log: () => {} });
const pgCtl = path.join(toolchain({ source: release, port: 1, pgPort: 2 }).pgBin, 'pg_ctl');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
let app, page, stderr = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  stderr = [];
  // The app's own environment has no Elixir, Erlang or mix to find.
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: systemPath, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => { const started = Date.now(); for (;;) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') return Date.now() - started; if (s.phase === 'failed') throw new Error('Profile runtime failed: ' + s.error); if (Date.now() - started > 300000) throw new Error('Profile runtime not ready'); await new Promise(resolve => setTimeout(resolve, 500)); } };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
const pick = folder => app.evaluate(({ dialog }, chosen) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] }); }, folder);
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const library = async () => (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => ({ id: p.id, title: p.title })).sort((a, b) => a.id.localeCompare(b.id));
try {
  const bootStarted = Date.now();
  await launch(); await runtimeReady();
  const firstBootMs = Date.now() - bootStarted;
  const environment = await app.evaluate(() => { const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'); const found = name => process.env.PATH.split(':').some(dir => fs.existsSync(path.join(dir, name))); return { path: process.env.PATH, mix: found('mix'), elixir: found('elixir'), erl: found('erl') }; });
  assert.deepEqual([environment.mix, environment.elixir, environment.erl], [false, false, false], 'no Elixir or Erlang on the app\'s PATH');
  const running = record.read();
  const command = execFileSync('ps', ['-o', 'command=', '-p', String(running.pid)], { encoding: 'utf8' });
  assert.ok(command.includes(release), 'the runtime process is the packaged release: ' + command.slice(0, 160));
  // When the runtime folder carries its own Postgres, the database server is that one, not the machine's.
  const carried = fs.existsSync(path.join(release, 'postgres', 'bin', 'pg_ctl'));
  const postmaster = Number(fs.readFileSync(path.join(dataDir, 'pgdata', 'postmaster.pid'), 'utf8').split('\n')[0]);
  const database = execFileSync('ps', ['-o', 'command=', '-p', String(postmaster)], { encoding: 'utf8' }).trim();
  if (carried) assert.ok(database.startsWith(path.join(release, 'postgres', 'bin') + path.sep), 'the database server is the carried one: ' + database.slice(0, 160));
  report.postgres = carried ? 'carried in the runtime folder' : 'the machine\'s own';
  const note = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: note.id, paperOwner: note.paperOwner });
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Packaged runtime'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Quince marmalade notes written with no checkout on the machine.'); await paperSaved();
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.search('Quince'))).some(d => d.id === note.id), 'found by its body');
  await shot('01-note-on-the-packaged-runtime');
  report.checks.push({ name: 'First boot from the packaged release with only system folders on the PATH: database created, brought forward and seeded; a note is written, saved and found by its body', firstBootMs, path: environment.path }); persist();

  await quit();
  assert.equal(record.read(), null, 'a clean quit leaves nothing running');
  const restartStarted = Date.now();
  await launch(); await runtimeReady();
  const secondBootMs = Date.now() - restartStarted;
  const read = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: note.id, paperOwner: note.paperOwner });
  assert.equal(read.title, 'Packaged runtime'); assert.match(read.markdown, /Quince marmalade notes/);
  report.checks.push({ name: 'After a restart the note reads the same', secondBootMs }); persist();

  // The portable profile on the packaged runtime: export under the hold, import as a new profile.
  const before = await library();
  await pick(carry); await openSettings();
  await page.locator('#profile-export').click();
  await page.locator('.bw-preparation-notice', { hasText: 'The export completed' }).waitFor({ timeout: 180000 });
  await quit(); await launch(); await runtimeReady();
  const done = page.locator('.bw-preparation-notice', { hasText: 'The export completed' }); await done.waitFor({ timeout: 30000 }); await done.locator('[data-dismiss]').click();
  const exportDir = path.join(carry, fs.readdirSync(carry)[0]);
  const verified = verifyExport(exportDir);
  assert.equal(verified.manifest.upstream, packaged.upstream, 'the export names the commit the release holds');
  await pick(exportDir); await openSettings();
  await page.locator('#profile-import').click();
  await page.waitForFunction(() => /^Imported /.test(document.querySelector('#profile-import-status')?.textContent || '') || document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 300000 });
  const said = await page.locator('#profile-import-status').textContent();
  assert.match(said, /^Imported “Writing desk \(imported\)”/, said);
  const imported = registry.load().profiles.find(p => p.id !== profile.id);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, imported.id, { timeout: 60000 });
  await runtimeReady();
  assert.deepEqual(await library(), before, 'the imported profile serves the same library');
  assert.equal(JSON.parse(fs.readFileSync(path.join(registry.storeFor(imported.id).storeDir, 'runtime.json'), 'utf8')).source, release);
  report.checks.push({ name: 'Export under the hold and import as a new profile, both on the packaged runtime; the imported profile serves the same library', papers: before.length }); persist();

  // A killed app: the packaged runtime is reclaimed like the checkout one.
  const left = createRuntimeRecord({ dataDir: path.join(registry.storeFor(imported.id).storeDir, 'local-barkpark', 'runtime'), log: () => {} }).read();
  const pid = app.process().pid; process.kill(pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 4000));
  assert.equal(alive(left.pid), true, 'the runtime outlived its host');
  await launch(); await runtimeReady();
  assert.equal(alive(left.pid), false, 'the leftover runtime was stopped');
  assert.ok(stderr.join('').includes(`[runtime] reclaimed after host ${pid} ended`), stderr.join('').slice(-400));
  assert.deepEqual(await library(), before);
  report.checks.push({ name: 'The app is killed: the next launch reclaims the packaged runtime and its database and serves the same library' }); persist();
  await quit();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').split('\n').filter(l => !/IMK/.test(l)).slice(-20);
  try { report.localStatus = await page.evaluate(() => window.barkdown.barkpark.localStatus()); } catch {}
  try { report.serverLog = fs.readFileSync(path.join(dataDir, 'server.log'), 'utf8').slice(-1500); } catch {}
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  for (const p of registry.load().profiles) { const d = path.join(registry.storeFor(p.id).storeDir, 'local-barkpark', 'runtime'); let r = null; try { r = createRuntimeRecord({ dataDir: d, log: () => {} }).read(); } catch {} if (r?.pid && alive(r.pid)) { try { process.kill(-r.pid, 'SIGTERM'); } catch {} } try { execFileSync(pgCtl, ['-D', path.join(d, 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {} }
  throw error;
}
