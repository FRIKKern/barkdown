// The library switch driven from the app's own Settings screen: real Electron in profiles
// mode, the profile runtime pool starting a managed runtime from a built checkout, the
// preparation bridge, the confirm sheet, the switch, the reload, then rollback; and on a
// second profile an interruption after the journal reaches `replacing`, a clean quit, a
// relaunch with the start-time notice, and Resume from the same button.
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
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-') + '-switch-ui');
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-switch-ui-'));
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One host, one run. The interruption is a simulated crash injected into the main process at the journal rename to `replacing`; the quit and relaunch around it are real. Labels generated, not reviewed.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();

// Two profiles, each with legacy notes, each set to run its own managed runtime from the checkout.
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const seed = (name, notes) => {
  const profile = registry.createProfile({ name }), dir = registry.storeFor(profile.id).storeDir;
  createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
  const documents = createDocuments(createStore(dir, { create: false }));
  const ids = notes(documents);
  fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: [ids[0]], children: { [ids[0]]: ids.slice(1) }, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: ids[ids.length - 1], source: 'local' } }] }));
  return { profile, dir, ids };
};
const a = seed('Writing desk', documents => {
  const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
  const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
  return [orchard.id, soil.id];
});
const b = seed('Other notebook', documents => [documents.create({ title: 'Lone note', markdown: 'A single note that survives an interrupted switch.' }).id]);
registry.selectProfile(a.profile.id);

let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  // Toasts carry the switch's failure reason once the sheet is gone with the frozen foreground.
  await app.context().addInitScript(() => { window.__toasts = []; new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches?.('.bw-toast, .bw-toast *')) window.__toasts.push(n.textContent); }).observe(document.documentElement, { childList: true, subtree: true }); });
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => (report.pageErrors ||= []).push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) (report.console ||= []).push(message.text().slice(0, 300)); });
  app.process().stderr?.on('data', chunk => (report.mainStderr ||= []).push(String(chunk).slice(0, 400)));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => {
  const started = Date.now();
  for (;;) {
    // A profile switch or reload in progress answers with an error; keep polling.
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(error => ({ phase: 'pending', error: error.message }));
    if (status.phase === 'ready') return status;
    if (status.phase === 'failed') throw new Error('Profile runtime failed: ' + status.error);
    if (Date.now() - started > 300000) throw new Error('Profile runtime not ready after 5 minutes: ' + JSON.stringify(status));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const openLibrarySwitch = async () => {
  // The settings button sits under the traffic-light inset on macOS; dispatch the click in page.
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('.bw-settings-nav [data-pane="barkpark"]').click();
  await page.locator('#bp-switch-status').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const t = document.querySelector('#bp-switch-status')?.textContent || ''; return t && !t.startsWith('Needs'); });
  return page.locator('#bp-switch-status').textContent();
};
const confirmSheet = async () => { await page.locator('.bw-ask [data-ok]').click(); };
const waitReload = async authority => { await page.waitForFunction(auth => window.__barkdown?.state.loaded && window.__barkdown.state.authority === auth, authority, { timeout: 150000 }); };
// After the restart the aborted preparation is informational: the notice names the outcome and can be dismissed.
const dismissCompleted = async text => {
  const notice = page.locator('.bw-preparation-notice', { hasText: text });
  await notice.waitFor({ timeout: 30000 });
  assert.equal(await notice.locator('[data-restart]').isHidden(), true, 'no restart demanded on a fresh host');
  await notice.locator('[data-dismiss]').click();
  await page.waitForFunction(() => !document.querySelector('.bw-preparation-notice'));
};
const quit = async () => {
  const closing = app.close();
  await Promise.race([closing, new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds; owned runtimes may be orphaned')), 90000))]);
};
try {
  await launch();
  await runtimeReady();
  const before = await openLibrarySwitch();
  assert.equal(before, 'Legacy notes, not switched');
  await shot('01-library-switch-ready');
  await page.locator('[data-act="switch-paper"]').click();
  await page.locator('.bw-ask').waitFor();
  await shot('02-confirm-switch');
  await confirmSheet();
  // Preparation freezes the foreground (the sheet goes with it); the switch runs in main
  // and the window reloads once Paper is the authority.
  await page.locator('.bw-preparation-notice').waitFor();
  await shot('03-preparing-under-the-switch');
  await waitReload('paper');
  // The process that aborted the preparation restarts by design; the notice names the outcome.
  const done = page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' });
  await done.waitFor({ timeout: 30000 });
  assert.equal(await done.locator('[data-restart]').isVisible(), true, 'Restart Barkdown is offered');
  await shot('03b-switched-restart-offered');
  await quit(); await launch(); await runtimeReady();
  await dismissCompleted('The library switch completed');
  const status = await page.evaluate(() => window.barkdown.migration.status());
  assert.equal(status.selection.status, 'selected'); assert.equal(status.selection.authority, 'paper'); assert.ok(status.selection.seal);
  const papers = await page.evaluate(() => window.barkdown.barkpark.list());
  for (const title of ['Soil moisture protocol', 'Orchard fieldbook']) assert.ok(papers.some(p => p.title === title), `Paper "${title}" is listed on the runtime`);
  const retained = await page.evaluate(id => window.barkdown.docs.get(id), a.ids[1]);
  assert.equal(retained.retained, true);
  await page.evaluate(id => window.__barkdown.openTarget({ kind: 'doc', id, source: 'local' }), a.ids[1]);
  await page.locator('.bw-doc-pane:not([hidden]) .bw-doc-meta', { hasText: 'Retained original' }).waitFor({ timeout: 8000 }).catch(() => {});
  await shot('04-after-reload-paper-authority');
  report.checks.push({ name: 'Settings › Barkpark › Library switch: confirm sheet, switch under the hold, the completed notice with Restart, a fresh host on Paper authority; both Papers on the runtime, legacy note retained read-only', seal: status.selection.seal, retainedBadges: await page.locator('.bw-retained').count() }); persist();

  // A Paper edit after the switch: the rollback must keep it on Paper and name it as a divergence.
  const orchardId = papers.find(p => p.title === 'Orchard fieldbook').id;
  await page.evaluate(async id => { const paper = await window.barkdown.barkpark.get(id); await window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { id: 'later-human', type: 'paragraph', content: [{ type: 'text', value: 'A later human sentence on Paper.' }] } }], paper.rev, paper.binding); }, orchardId);
  await openLibrarySwitch();
  assert.equal(await page.locator('[data-act="switch-paper"]').isHidden(), true, 'switch button hidden once selected');
  await page.locator('[data-act="switch-rollback"]').click();
  await page.locator('.bw-ask').waitFor(); await confirmSheet();
  await waitReload('legacy');
  await page.locator('.bw-preparation-notice', { hasText: 'The rollback completed' }).waitFor({ timeout: 30000 });
  await shot('05-rolled-back-restart-offered');
  await quit(); await launch(); await runtimeReady();
  await dismissCompleted('The rollback completed');
  const rolled = await page.evaluate(() => window.barkdown.migration.status());
  assert.equal(rolled.selection.status, 'rolled-back'); assert.equal(rolled.selection.reconciliationRequired, true, 'the later Paper edit is a recorded divergence');
  assert.ok(rolled.selection.divergence?.details?.some(d => d.id === orchardId && d.what === 'content'), 'the divergence names the edited Paper');
  // The window saved its own navigation while on Paper (a tab was opened); that copy is retained, the legacy one restored.
  assert.ok(rolled.selection.retainedPaperWorkspace, 'the Paper-era workspace is retained');
  assert.ok(fs.existsSync(path.join(a.dir, 'selection', 'workspace-paper.json')));
  assert.equal(rolled.retainedDir, path.join(a.dir, 'selection'));
  // Settings names the retained navigation and offers the retained files.
  const afterRollback = await openLibrarySwitch();
  assert.match(afterRollback, /Switched back to legacy notes.*1 Paper changed after the switch \(Orchard fieldbook\).*retained, not restored/);
  assert.equal(await page.locator('[data-act="switch-retained"]').isVisible(), true, 'Open retained files is offered');
  await shot('05b-rolled-back-settings');
  // Side by side: the staged text on the left, the later sentence only on the right.
  await page.locator(`#bp-switch-changed [data-compare="${orchardId}"]`).click();
  await page.locator('#bp-switch-compare [data-side="after"]', { hasText: 'A later human sentence on Paper.' }).waitFor({ timeout: 60000 });
  assert.doesNotMatch(await page.locator('#bp-switch-compare [data-side="before"]').textContent(), /later human sentence/, 'the staged text has no later sentence');
  assert.match(await page.locator('#bp-switch-compare [data-side="before"]').textContent(), /\[\[Soil moisture protocol\]\]/, 'the staged text is the migrated note with its link rewritten to the Paper');
  await shot('05d-compare-changed-paper');
  await page.locator('#bp-switch-compare [data-close]').click();
  // The changed Paper opens from the reconciliation line.
  await page.locator(`#bp-switch-changed [data-changed="${orchardId}"]`).click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'A later human sentence on Paper.' }).waitFor({ timeout: 60000 });
  await shot('05c-changed-paper-opened');
  const created = await page.evaluate(() => window.barkdown.docs.create({ title: 'After rollback', markdown: 'Legacy writes return after the rollback.' }));
  assert.ok(created.id);
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.list())).some(p => p.title === 'Orchard fieldbook'), 'Papers stay on the runtime after rollback');
  report.checks.push({ name: 'Rollback from the same screen: the completed notice, a fresh host on legacy authority, legacy writes return, Papers stay', passed: true }); persist();

  // Second profile: the crash lands in the main process at the journal rename to `replacing`.
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('#profile-choice').selectOption(b.profile.id);
  await page.locator('#profile-switch').click();
  // The select reloads the window; the renderer state names the profile only after that reload.
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.profile.id, { timeout: 60000 });
  await runtimeReady();
  await app.evaluate(() => {
    const fs = process.getBuiltinModule('fs'), original = fs.renameSync; global.__switchCrashArmed = true;
    fs.renameSync = (from, to) => {
      const result = original(from, to);
      if (global.__switchCrashArmed && String(to).endsWith('selection.json') && fs.readFileSync(to, 'utf8').includes('"replacing"')) { global.__switchCrashArmed = false; fs.renameSync = original; throw Object.assign(new Error('simulated crash after the journal reached replacing'), { code: 'crash' }); }
      return result;
    };
  });
  const beforeB = await openLibrarySwitch();
  assert.equal(beforeB, 'Legacy notes, not switched');
  await page.locator('[data-act="switch-paper"]').click(); await page.locator('.bw-ask').waitFor(); await confirmSheet();
  await page.waitForFunction(async () => (await window.barkdown.migration.status())?.selection?.status === 'replacing', null, { timeout: 240000 });
  await page.locator('.bw-toast, [role="alert"]', { hasText: 'simulated crash' }).first().waitFor({ timeout: 15000 }).catch(() => {});
  const interrupted = await page.evaluate(() => window.barkdown.migration.status());
  assert.equal(interrupted.selection.status, 'replacing');
  await shot('06-interrupted-replacing');
  report.checks.push({ name: 'A crash after the journal reached replacing leaves the profile prepared with the journal at replacing; the failure is said on screen', operationId: interrupted.selection.operationId }); persist();
  await quit();
  await launch();
  const notice = page.locator('.bw-switch-notice');
  await notice.waitFor({ timeout: 30000 });
  assert.match(await notice.textContent(), /interrupted while the notes were being replaced/);
  await page.locator('.bw-pages-label').waitFor({ timeout: 20000 }).catch(() => {});
  await shot('07-relaunch-notice');
  await runtimeReady();
  await notice.locator('[data-resume]').click();
  await waitReload('paper');
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 30000 });
  await shot('08-resumed-restart-offered');
  await quit(); await launch(); await runtimeReady();
  await dismissCompleted('The library switch completed');
  await page.locator('.bw-pages-label').waitFor({ timeout: 20000 }).catch(() => {});
  await shot('09-fresh-host-on-paper');
  const resumed = await page.evaluate(() => window.barkdown.migration.status());
  assert.equal(resumed.selection.status, 'selected'); assert.equal(resumed.selection.operationId, interrupted.selection.operationId);
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.list())).some(p => p.title === 'Lone note'));
  report.checks.push({ name: 'Clean quit, relaunch with the start-time switch notice, Resume from it completes the same operation; a fresh host reads Paper', passed: true }); persist();
  await quit();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error);
  try { report.toasts = await page.evaluate(() => window.__toasts); } catch {}
  try { report.failedAt = { preparation: await page.evaluate(() => window.barkdown.preparation.status()), migration: await page.evaluate(() => window.barkdown.migration.status()) }; } catch (e) { report.failedAt = String(e); }
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch (quitError) { report.quitError = quitError.message; persist(); try { app?.process().kill('SIGKILL'); } catch {} }
  throw error;
}
