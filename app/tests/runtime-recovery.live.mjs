// A library that refuses changes after a host was killed while its runtime was held (carried
// from C083). Real Electron, managed runtime, real kills of the main process.
// 1) A hold that no journal owns (it stands in for an operation that finished its journal and
//    died before it reopened the runtime): the next launch reopens the library by itself.
// 2) The library switch killed under the hold after its journal reached `replacing`: the next
//    launch leaves the runtime to the switch, and Resume recovers it and completes.
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
const { createDocuments } = require('../main/documents');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const { createUpstreamAdmission } = require('../main/upstream-admission');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-runtime-recovery');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-recovery-'))), marker = path.join(userData, 'stalled');
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One machine, one run. The host is ended with SIGKILL; the switch is stalled at one point, after its journal reached replacing. The unowned hold is taken by the rehearsal over HTTP with the runtime token, as a stand-in for an operation that died after its journal completed. A writer that raises inside the runtime during a drain is not produced: a cut connection does not kill an admitted writer (see the dying-writer rehearsal). POSIX only.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
const documents = createDocuments(createStore(dir, { create: false }));
const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: [orchard.id], children: { [orchard.id]: [soil.id] }, expanded: {} }, favorites: [] }));
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), record = createRuntimeRecord({ dataDir, log: () => {} });
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
const admission = createUpstreamAdmission();
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
const target = async () => ({ server: `http://127.0.0.1:${JSON.parse(fs.readFileSync(path.join(dir, 'runtime.json'), 'utf8')).port}`, token: await app.evaluate(() => process.env.BARKDOWN_BP_TOKEN), dataset: 'production' });
const kill = async () => { const pid = app.process().pid; process.kill(pid, 'SIGKILL'); await new Promise(resolve => setTimeout(resolve, 4000)); assert.equal(alive(pid), false, 'the host is gone'); };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
const logged = text => stderr.join('').includes(text);
// The launch check runs right after the runtime reports ready; its line may follow by a moment.
const waitLogged = async text => { const started = Date.now(); while (!logged(text)) { if (Date.now() - started > 20000) return false; await new Promise(resolve => setTimeout(resolve, 200)); } return true; };
try {
  // 1) A hold nobody owns.
  await launch(); await runtimeReady();
  const connection = await target();
  const begun = await admission.hold(connection, 'died-after-its-journal');
  const held = begun.phase === 'held' ? begun : await admission.awaitHeld(connection, begun.capability);
  assert.equal(held.phase, 'held');
  await assert.rejects(page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID())), 'a held library refuses a new note');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'writer-state.json'), 'utf8')).pending, [], 'a write the runtime refused is settled, not left uncertain');
  await kill();
  await launch(); await runtimeReady();
  assert.ok(logged('[runtime] reclaimed after host'), 'the leftover runtime was reclaimed');
  assert.ok(await waitLogged('[recovery] runtime reopened at launch, no operation in flight'), stderr.join('').slice(-800));
  assert.equal((await admission.instance(await target())).phase, 'open');
  const note = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  assert.ok(note.id);
  report.checks.push({ name: 'A note refused by the held library leaves no uncertain write. Killed while held with no operation in flight: the next launch reclaims the runtime, finds it in recovery, reopens it and a new note is written', log: stderr.join('').split('\n').filter(l => l.startsWith('[recovery]') || l.startsWith('[runtime]')) }); persist();

  // 2) The switch, killed under the hold.
  await app.evaluate((_electron, file) => {
    const fs = process.getBuiltinModule('fs'), original = fs.renameSync;
    fs.renameSync = (from, to) => { const result = original(from, to); if (String(to).endsWith('selection.json') && fs.readFileSync(to, 'utf8').includes('"replacing"')) { fs.writeFileSync(file, String(to)); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600000); } return result; };
  }, marker);
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('.bw-settings-nav [data-pane="barkpark"]').click();
  await page.locator('[data-act="switch-paper"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#bp-switch-status')?.textContent === 'Legacy notes, not switched');
  await page.locator('[data-act="switch-paper"]').click();
  page.locator('.bw-ask [data-ok]').click().catch(() => {});
  const started = Date.now();
  while (!fs.existsSync(marker)) { if (Date.now() - started > 240000) throw new Error('The switch never reached replacing'); await new Promise(resolve => setTimeout(resolve, 200)); }
  const duringSwitch = await admission.instance(await (async () => ({ ...connection }))());
  assert.equal(duringSwitch.phase, 'held', 'the switch holds the runtime at that point');
  await kill(); fs.rmSync(marker);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'selection.json'), 'utf8')).phase, 'replacing');
  await launch(); await runtimeReady();
  assert.ok(await waitLogged('[recovery] runtime in recovery is left to the interrupted library switch'), stderr.join('').slice(-800));
  assert.equal((await admission.instance(await target())).phase, 'recovery_required');
  const notice = page.locator('.bw-switch-notice');
  await notice.waitFor({ timeout: 30000 });
  await shot('01-switch-interrupted-by-a-kill');
  await notice.locator('[data-resume]').click();
  await page.waitForFunction(() => window.__barkdown?.state.loaded && window.__barkdown.state.authority === 'paper', null, { timeout: 240000 });
  assert.ok(logged('[recovery] runtime recovered before select-'), stderr.join('').slice(-800));
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 30000 });
  await quit(); await launch(); await runtimeReady();
  const done = page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' });
  await done.waitFor({ timeout: 30000 }); await done.locator('[data-dismiss]').click();
  const status = await page.evaluate(() => window.barkdown.migration.status());
  assert.equal(status.selection.status, 'selected'); assert.equal(status.selection.authority, 'paper');
  assert.equal((await admission.instance(await target())).phase, 'open');
  const papers = await page.evaluate(() => window.barkdown.barkpark.list());
  for (const title of ['Soil moisture protocol', 'Orchard fieldbook']) assert.equal(papers.filter(p => p.title === title).length, 1, `"${title}" is on Paper exactly once`);
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()))).id, 'writing works');
  await shot('02-switch-completed-after-resume');
  report.checks.push({ name: 'The switch killed under the hold at replacing: the next launch leaves the runtime to the switch, Resume recovers it, completes the same operation, and the library is on Paper and writable, each note once' }); persist();
  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(record.read(), null, 'a clean quit leaves nothing to reclaim');
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').slice(-3000);
  try { report.notices = await page.locator('.bw-preparation-notice p').allTextContents(); } catch {}
  try { report.toasts = await page.evaluate(() => window.__toasts); report.switchStatus = await page.evaluate(() => window.barkdown.migration.status()); } catch (e) { report.toasts = String(e); }
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  let left = null; try { left = record.read(); } catch {}
  if (left?.pid && alive(left.pid)) { try { process.kill(-left.pid, 'SIGTERM'); } catch {} }
  try { execFileSync('pg_ctl', ['-D', path.join(dataDir, 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {}
  throw error;
}
