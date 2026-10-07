// Real Electron and a disposable profile store; no provider or local server.
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
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-workspace-quit-'));
const out = path.resolve(process.argv[2] || path.join(appRoot, 'test-results/workspace-quit'), new Date().toISOString().replace(/[:.]/g, '-') + '-workspace-quit');
fs.mkdirSync(out, { recursive: true });
const registry = createProfileRegistry(path.join(root, 'profile-data'));
const profile = registry.createProfile({ name: 'Disposable draft' }); registry.selectProfile(profile.id);
const store = registry.storeFor(profile.id), file = path.resolve(store.storeDir, 'workspace.json');
assert(file.startsWith(path.resolve(root) + path.sep));
store.writeJson('workspace.json', { version: 1, chats: { main: { id: 'main', title: 'Quit draft', messages: [], tabs: [], events: [], draft: '', closedTargets: [] } }, order: ['main'], current: 'main', favorites: [], pages: null });
store.writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { decided: true, enabled: false, local: { enabled: false } } });
createStore(path.join(root, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
const report = { status: 'running', platform: process.platform, root, out, profileId: profile.id, assertions: [], images: [], scope: 'Real Electron, disposable disk store, no provider/runtime; native error dialog intercepted, not visually rendered. Windows/Linux exercise window close; macOS exercises quit, preserving its separate close-window behavior.' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
let app, page, obstructed = false;
const backup = file + '.retained', obstruction = file + '.obstruction';
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
  await launch(); await page.locator('textarea').first().fill('Immediate chat draft survives quit');
  await quit(); assert.equal(store.readJson('workspace.json').chats.main.draft, 'Immediate chat draft survives quit');
  await launch(); assert.equal(await page.locator('textarea').first().inputValue(), 'Immediate chat draft survives quit');
  report.assertions.push('Immediate draft acknowledged and restored after real quit/restart');
  const goals = () => page.evaluate(() => {
    const { profileId, generation } = window.__barkdown.state;
    return window.barkdown.goals.list({ profileId, generation, chatId: 'main' });
  });
  assert.deepEqual(await goals(), []);
  const shell = await page.evaluate(root => window.barkdown.term.start('quit-control', root, 'main'), root);
  // First establish a saved baseline before obstructing the actual owned path.
  await page.evaluate(async () => { const value = await window.barkdown.state.load(); await window.barkdown.state.save(value); });
  fs.renameSync(file, backup); fs.mkdirSync(file); obstructed = true;
  await page.locator('textarea').first().fill('Refused workspace keeps these newer words');
  await page.getByText(/Changes are not saved/).waitFor();
  await app.evaluate(({ dialog }) => { globalThis.__workspaceQuitDialogs = []; dialog.showMessageBox = async (_window, options) => { globalThis.__workspaceQuitDialogs.push(options); return { response: 0 }; }; });
  await app.evaluate(({ app, BrowserWindow }) => { setTimeout(() => process.platform === 'darwin' ? app.quit() : BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('index.html')).close(), 0); });
  await page.waitForFunction(() => !document.body.inert, null, { timeout: 20000 });
  // Main exposes the intercepted refusal; an already-open view is not proof.
  const deadline = Date.now() + 20000;
  while (true) {
    const dialogs = await app.evaluate(() => globalThis.__workspaceQuitDialogs);
    if (dialogs.length) { report.dialogs = dialogs; break; }
    assert(Date.now() < deadline, 'Expected an actual shutdown refusal');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await page.locator('textarea').first().inputValue(), 'Refused workspace keeps these newer words');
  assert.equal(page.isClosed(), false); assert.equal(await page.evaluate(() => document.body.inert), false);
  await page.screenshot({ path: path.join(out, 'refused-wide.png') }); report.images.push('refused-wide.png');
  await page.setViewportSize({ width: 720, height: 760 });
  await page.screenshot({ path: path.join(out, 'refused-narrow.png') }); report.images.push('refused-narrow.png');
  await page.waitForFunction(() => !document.querySelector('.bw-toast'));
  await page.screenshot({ path: path.join(out, 'refused-narrow-cleared.png') }); report.images.push('refused-narrow-cleared.png');
  report.assertions.push('Close/quit refuses actual missing/obstructed store; window and current draft remain, freeze releases');
  fs.renameSync(file, obstruction); fs.renameSync(backup, file); obstructed = false;
  assert.deepEqual(await goals(), [], 'Refused renderer quit must leave Goals usable');
  const shellStatus = await page.evaluate(shell => window.barkdown.term.status(shell.id, shell.chatId), shell);
  assert.equal(shellStatus.state, 'running');
  assert.equal(shellStatus.session.sessionId, shell.sessionId);
  await page.evaluate(async shell => {
    // Existing ownership remains usable, and explicit stop permits a new shell.
    await window.barkdown.term.write(shell, '');
    await window.barkdown.term.stop(shell);
  }, shell);
  const fresh = await page.evaluate(root => window.barkdown.term.start('quit-after-refusal', root, 'main'), root);
  await page.evaluate(shell => window.barkdown.term.stop(shell), fresh);
  report.assertions.push('Refused renderer quit preserves Goals, an existing terminal and fresh shell admission');
  await quit(); await launch();
  assert.equal(await page.locator('textarea').first().inputValue(), 'Refused workspace keeps these newer words');
  assert.equal(store.readJson('workspace.json').chats.main.draft, 'Refused workspace keeps these newer words');
  await page.screenshot({ path: path.join(out, 'restored.png') }); report.images.push('restored.png');
  report.assertions.push('Restored store accepts retry; latest refused draft survives real restart');
  await quit(); report.status = 'passed'; persist(); console.log(JSON.stringify(report));
} catch (error) { report.status = 'failed'; report.error = error.stack; persist(); throw error; }
finally {
  if (obstructed) { fs.renameSync(file, obstruction); fs.renameSync(backup, file); }
  if (app) await app.close().catch(() => app.process().kill());
}
