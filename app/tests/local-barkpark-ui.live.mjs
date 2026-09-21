import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { execFileSync } = require('child_process');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-local-ui-'));
const dataDir = path.join(userData, 'barkdown'); fs.mkdirSync(dataDir);
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark-editor');
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ barkpark: { enabled: true, writes: true, local: { enabled: true, source, port: 4548, pgPort: 5548 } } }));
console.log('Electron local runtime data:', userData);
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.text().startsWith('LOCAL ')) console.log(message.text()); });
await page.evaluate(() => window.barkdown.barkpark.onLocalStatus(s => console.log('LOCAL ' + JSON.stringify(s))));
const pgData = path.join(dataDir, 'local-barkpark', 'default', 'pgdata');
const pgCtl = path.join(process.env.SCOOP || path.join(process.env.USERPROFILE, 'scoop'), 'apps/postgresql/current/bin/pg_ctl.exe');
async function waitFor(predicate, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await new Promise(r => setTimeout(r, 300)); }
  throw new Error('Timed out waiting for local runtime: ' + JSON.stringify(await page.evaluate(() => window.barkdown.barkpark.localStatus())));
}
try {
  await waitFor(() => page.evaluate(async () => (await window.barkdown.barkpark.localStatus()).phase === 'ready'), 240000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'doc', id: 'welcome', source: 'barkpark', title: 'Welcome' }));
  await page.waitForSelector('bp-paper-canvas .ProseMirror', { timeout: 60000 });
  const before = await page.evaluate(() => window.barkdown.barkpark.get('welcome'));
  execFileSync(pgCtl, ['-D', pgData, '-m', 'immediate', '-w', 'stop'], { windowsHide: true, stdio: 'pipe' });
  await waitFor(() => page.evaluate(async () => (await window.barkdown.barkpark.localStatus()).phase === 'recovering'), 30000);
  const marker = 'Recovered-' + Date.now();
  const paragraph = page.locator('bp-paper-canvas .ProseMirror > p').first();
  await paragraph.click(); await page.keyboard.press('End'); await page.keyboard.type(' ' + marker);
  await waitFor(() => page.evaluate(async () => (await window.barkdown.barkpark.localStatus()).phase === 'ready'));
  // Edits during a known restart wait on readiness; uncertain transport failures retain Retry.
  const retry = page.locator('#conflict [data-act="retry"]');
  if (await retry.count()) await retry.click();
  await waitFor(() => page.evaluate(async marker => { try { return JSON.stringify((await window.barkdown.barkpark.get('welcome')).blocks).includes(marker); } catch { return false; } }, marker), 30000);
  const after = await page.evaluate(() => window.barkdown.barkpark.get('welcome'));
  assert.ok(after.rev > before.rev);
  assert.ok((await paragraph.innerText()).includes(marker));
  await page.keyboard.press('Control+,');
  await page.locator('nav [data-pane="barkpark"]').click();
  await page.waitForFunction(() => document.getElementById('bp-local-status')?.textContent.includes('ready'));
  await page.screenshot({ path: 'test-results/local-barkpark-settings.png' });
  assert.deepEqual(errors, []);
} finally { await app.close(); }
assert.equal(fs.existsSync(path.join(pgData, 'postmaster.pid')), false, 'quit stopped the private database');
assert.equal(fs.existsSync(path.join(dataDir, 'local-barkpark', 'default', 'owner.json')), false, 'quit released ownership');
const reopened = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const secondPage = await reopened.firstWindow();
try {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (await secondPage.evaluate(async () => (await window.barkdown.barkpark.localStatus()).phase === 'ready')) break;
    await new Promise(r => setTimeout(r, 300));
  }
  assert.equal(await secondPage.evaluate(async () => (await window.barkdown.barkpark.localStatus()).phase), 'ready');
  const saved = await secondPage.evaluate(() => window.barkdown.barkpark.get('welcome'));
  assert.ok(JSON.stringify(saved.blocks).includes('Recovered-'));
  const closed = new Promise(resolve => reopened.once('close', resolve));
  await reopened.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Window close did not quit')), 30000); timer.unref(); })]);
} finally { await reopened.close().catch(() => {}); }
assert.equal(fs.existsSync(path.join(pgData, 'postmaster.pid')), false, 'window close stopped the private database');
console.log('PASS Electron auto-start, Paper loading, edit during database recovery, acknowledged save, Settings status, restart persistence, quit and window-close cleanup.');
