// Real Electron quit with actual registry receipts; controlled cleanup failure, no provider/child/runtime.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-backend-quit-'));
const out = path.resolve(process.argv[2] || path.join(appRoot, 'test-results/backend-quit'), new Date().toISOString().replace(/[:.]/g, '-') + '-backend-quit');
fs.mkdirSync(out, { recursive: true });
const registry = createProfileRegistry(path.join(root, 'profile-data'));
const profile = registry.createProfile({ name: 'Disposable draft' }); registry.selectProfile(profile.id);
const store = registry.storeFor(profile.id), file = path.resolve(store.storeDir, 'workspace.json');
assert(file.startsWith(path.resolve(root) + path.sep));
store.writeJson('workspace.json', { version: 1, chats: { main: { id: 'main', title: 'Quit draft', messages: [], tabs: [], events: [], draft: '', closedTargets: [] } }, order: ['main'], current: 'main', favorites: [], pages: null });
store.writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { decided: true, enabled: false, local: { enabled: false } } });
createStore(path.join(root, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
const report = { status: 'running', platform: process.platform, root, out, profileId: profile.id, assertions: [], images: [], scope: 'Actual Electron quit and run registry; controlled cleanup-failed receipt, disposable disk. No real provider/child/runtime. Native dialogs intercepted, not rendered. Explicit test-only host exit after two refusals; no recovery or descendant-death claim.' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
let app, page;
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${root}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
}
async function quit() {
  let timer; const closed = new Promise((resolve, reject) => { app.once('close', resolve); timer = setTimeout(() => reject(new Error('Quit did not complete')), 20000); });
  try { await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); }); await closed; app = null; }
  finally { clearTimeout(timer); }
}
try {
  await launch(); await page.locator('textarea').first().fill('Human draft survives backend cleanup refusal');
  const runId = await app.evaluate(({ app, dialog }, { profileId, storeDir }) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js');
    const runs = require('./providers/runs');
    globalThis.__backendQuitDialogs = [];
    dialog.showMessageBox = async (_window, options) => { globalThis.__backendQuitDialogs.push(options); return { response: 0 }; };
    const run = runs.createRun({ chatId: 'main', profileId, storeDir, context: { chatId: 'main', folder: null }, provider: 'api', send() {}, onFinish: async () => { throw new Error('Controlled native cleanup refusal'); } });
    run.onCancel = () => { runs.finish(run); };
    return run.id;
  }, { profileId: profile.id, storeDir: store.storeDir });
  for (const attempt of [1, 2]) {
    await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); });
    const deadline = Date.now() + 20000;
    while (true) {
      const dialogs = await app.evaluate(() => globalThis.__backendQuitDialogs);
      if (dialogs.length === attempt) { report.dialogs = dialogs; break; }
      assert(Date.now() < deadline, 'Expected a native shutdown refusal for this attempt');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.match(report.dialogs.at(-1).detail, /Run cleanup is unconfirmed/);
    assert.match(report.dialogs.at(-1).detail, /Quit will remain blocked in this session/);
    assert.equal(page.isClosed(), false);
    await page.waitForFunction(() => !document.body.inert);
    assert.equal(await page.locator('textarea').first().inputValue(), 'Human draft survives backend cleanup refusal');
    assert.equal(store.readJson('workspace.json').chats.main.draft, 'Human draft survives backend cleanup refusal');
    const receipt = await app.evaluate(({ app }, id) => {
      const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js'), runs = require('./providers/runs');
      return runs.waitForRunFinish(id).then(result => ({ result, live: runs.runs.has(id) }));
    }, runId);
    assert.equal(receipt.live, false); assert.equal(receipt.result.cleanupFailed, true);
    report.receipt = receipt;
    if (attempt === 2) await page.setViewportSize({ width: 720, height: 760 });
    const image = `refused-${attempt}.png`; await page.screenshot({ path: path.join(out, image) }); report.images.push(image);
    report.assertions.push(`Actual Electron quit attempt ${attempt} refused the retained failed receipt; window and disk draft preserved`);
  }
  // No real child or local runtime was launched. This test owns the host; an
  // explicit test-only exit ends the intentionally unrecoverable fake driver.
  const exited = new Promise(resolve => app.once('close', resolve));
  await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 0); }); await exited; app = null;
  await launch(); assert.equal(await page.locator('textarea').first().inputValue(), 'Human draft survives backend cleanup refusal');
  await page.screenshot({ path: path.join(out, 'reopened.png') }); report.images.push('reopened.png');
  await quit(); report.assertions.push('After explicit test-only host exit, a fresh host restores the saved draft and quits normally');
  report.status = 'passed'; persist(); console.log(JSON.stringify(report));
} catch (error) { report.status = 'failed'; report.error = error.stack; persist(); throw error; }
finally {
  if (app) { const exited = new Promise(resolve => app.once('close', resolve)); await app.evaluate(({ app }) => { setTimeout(() => app.exit(1), 0); }).catch(() => app.process().kill()); await exited; }
}
