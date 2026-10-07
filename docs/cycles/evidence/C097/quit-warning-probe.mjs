// An export carried from one Barkdown installation to another (C085). Two installations on one
// machine: separate user data, separate profile registries, separate credentials, never running
// at the same time. The first writes a library, switches it to Paper and exports it to a folder
// outside both; the second imports that folder from Settings and opens the profile.
// It stands in for a second machine; it is not one: same OS, same tools, same Barkpark checkout.
// Needs a built Barkpark checkout at BARKDOWN_TEST_BP_SOURCE (default ../../barkpark-editor).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const appRoot = path.resolve(fileURLToPath(new URL('../../../../app/', import.meta.url)));
const require = createRequire(path.join(appRoot, 'package.json'));
const { _electron: electron } = require('playwright');
const { LINE_END } = await import(new URL('../../../../app/tests/helpers/keys.mjs', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('./main/profile-registry');
const { createStore } = require('./main/store');
const { createDocuments } = require('./main/documents');
const { verifyExport } = require('./main/profile-export');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
// Optional: the second installation runs a later Barkpark that descends from the first one's.
const newer = process.env.BARKDOWN_TEST_BP_SOURCE_NEWER ? path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE_NEWER) : null;
if (newer && !fs.existsSync(path.join(newer, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE_NEWER must point at a built Barkpark checkout');
const upstreamNewer = newer ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: newer, encoding: 'utf8' }).trim() : null;
if (newer) execFileSync('git', ['merge-base', '--is-ancestor', upstream, upstreamNewer], { cwd: newer });
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(process.argv[2] || '../docs/cycles/evidence/C097/quit-warning-01');
if (fs.existsSync(out)) throw new Error('Keep prior evidence; choose a new output');
fs.mkdirSync(out, { recursive: true });
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-two-installs-')));
const first = path.join(root, 'installation-one'), second = path.join(root, 'installation-two'), carry = path.join(root, 'carried-between');
for (const dir of [first, second, carry]) fs.mkdirSync(dir);
const report = { source: host, upstream, ...(newer ? { upstreamOfSecondInstallation: upstreamNewer } : {}), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['Only the first installation of the two-installation fixture runs: switch, restart, create/write, export, quit. Real disposable runtime; picker stubbed. Controller wrappers observe original settle results without changing them. No Mac transfer or second-installation proof.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const settings = { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } };
// Installation one: a library with legacy notes and a conversation.
const one = createProfileRegistry(path.join(first, 'profile-data'));
const desk = one.createProfile({ name: 'Writing desk' }), deskDir = one.storeFor(desk.id).storeDir;
const literalIdentity = `Literal source profile ${desk.id} remains human text.`;
createStore(deskDir).writeJson('settings.json', settings);
const documents = createDocuments(createStore(deskDir, { create: false }));
const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
fs.writeFileSync(path.join(deskDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: desk.id,
  chats: { main: { id: 'main', title: 'Writing room', messages: [{ id: 'm1', role: 'user', text: 'Does this arrive on the other computer?', at: '2026-09-29T12:00:00Z' }, { id: 'm2', role: 'assistant', text: 'It does, with every note and this conversation. ' + literalIdentity, at: '2026-09-29T12:00:05Z' }], events: [], apiHistory: [], tabs: [], draft: literalIdentity } },
  order: ['main'], current: 'main', pages: { layoutVersion: 2, seeded: true, roots: [orchard.id], children: { [orchard.id]: [soil.id] }, expanded: {} }, favorites: [] }));
one.selectProfile(desk.id);
// Installation two: somebody else's Barkdown, with its own empty profile.
const two = createProfileRegistry(path.join(second, 'profile-data'));
const home = two.createProfile({ name: 'Home desk' });
createStore(two.storeFor(home.id).storeDir).writeJson('settings.json', newer ? { ...settings, barkpark: { ...settings.barkpark, local: { enabled: true, source: newer } } } : settings);
two.selectProfile(home.id);
// Appearance belongs to an installation, not to a profile: the second installation has chosen dark for itself.
createStore(path.join(second, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });

let app, page; let quitNumber = 0;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async userData => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => (report.mainStderr ||= []).push(String(chunk).slice(0, 300)));
  // The window opens after the profile's runtime has started; the first boot of a new library takes about 30 seconds.
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
const pick = folder => app.evaluate(({ dialog }, chosenFolder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenFolder] }); }, folder);
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const dismiss = async text => { const notice = page.locator('.bw-preparation-notice', { hasText: text }); await notice.waitFor({ timeout: 30000 }); await notice.locator('[data-dismiss]').click(); await page.waitForFunction(() => !document.querySelector('.bw-preparation-notice')); };
const quit = async () => {
  const number = ++quitNumber;
  const before = await page.evaluate(() => [...window.__barkdown.controllers.values()].filter(c => c.settle).map(c => ({ tab: c.tab, dirty: c.isDirty?.(), type: c.type, inert: c.el?.inert, canvasPending: c.el?.querySelector('bp-paper-canvas')?.hasPendingChanges?.(), saveState: c.el?.querySelector('#save-state')?.textContent })));
  report.quitDiagnostics ||= []; const record = { number, phase: number === 1 ? 'after-library-switch' : 'after-export', before, results: [] }; report.quitDiagnostics.push(record); persist();
  page.on('console', msg => { if (msg.text().startsWith('QUIT_DIAGNOSTIC ')) { record.results.push(JSON.parse(msg.text().slice(16))); persist(); } });
  await page.evaluate(() => { for (const c of window.__barkdown.controllers.values()) { if (!c.settle) continue; const original = c.settle; c.settle = async (...args) => { const result = await original.apply(c,args); console.log('QUIT_DIAGNOSTIC ' + JSON.stringify({ tab: c.tab, result, dirty: c.isDirty?.() })); return result; }; } });
  let timer;
  try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000); })]); }
  finally { clearTimeout(timer); }
  persist();
};
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const library = async () => (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => ({ id: p.id, title: p.title })).sort((x, y) => x.id.localeCompare(y.id));
try {
  // Installation one.
  await launch(first); await runtimeReady();
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('.bw-settings-nav [data-pane="barkpark"]').click();
  await page.locator('[data-act="switch-paper"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#bp-switch-status')?.textContent === 'Legacy notes, not switched');
  await page.locator('[data-act="switch-paper"]').click();
  await page.locator('.bw-ask [data-ok]').click();
  await page.waitForFunction(() => window.__barkdown?.state.loaded && window.__barkdown.state.authority === 'paper', null, { timeout: 150000 });
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 30000 });
  await quit(); await launch(first); await runtimeReady();
  await dismiss('The library switch completed');
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Harbour ledger'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Cobalt lanterns mark the quay where the words must arrive.'); await paperSaved();
  const pictured = await page.evaluate(async dataUrl => {
    const note = await window.barkdown.barkpark.createNote(crypto.randomUUID());
    const media = await window.barkdown.barkpark.uploadMedia({ binding: note.binding, name: 'lantern.png', mime: 'image/png', dataUrl });
    const paper = await window.barkdown.barkpark.get(note.id, undefined, note.paperOwner);
    await window.barkdown.barkpark.applyOps(note.id, [{ op: 'append-block', block: { id: 'lantern', type: 'image', src: media.src, alt: 'A cobalt lantern' } }], paper.rev, note.binding);
    return { id: note.id, src: media.src };
  }, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  const carried = await library();
  const ownerOne = await page.evaluate(() => window.__barkdown.state.barkparkDocs[0].paperOwner);
  const tokenOne = await app.evaluate(() => process.env.BARKDOWN_BP_TOKEN);
  await pick(carry); await openSettings();
  await page.locator('#profile-export').click();
  await page.locator('.bw-preparation-notice', { hasText: 'The export completed' }).waitFor({ timeout: 180000 });
  await quit();
  report.status = 'characterized'; persist();
  assert.equal(report.quitDiagnostics.length, 2);
  assert.equal(report.quitDiagnostics[1].before.length, 1);
  assert.equal(report.quitDiagnostics[1].results.length, 1, 'the actual quit must produce its controller result');
  assert.ok(report.quitDiagnostics.every(q => q.results.every(r => r.result.saved || r.result.kept)), 'Every settled note must be saved or retained');
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = (report.mainStderr || []).slice(-30);
  try { report.importStatus = await page.evaluate(() => document.querySelector('#profile-import-status')?.textContent); } catch {}
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { if (app && page && !page.isClosed()) await app.close(); } catch {}
  throw error;
}
