// Native smoke proof for launch refusal, not complete migration preparation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { cleanSource } from './helpers/capture-lifecycle.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileLaunchAdmission } = require('../main/profile-launch-admission');
const source = cleanSource(path.resolve('..'), { allowEvidence: true }).commit;
const out = path.resolve('test-results/profile-launch', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-launch-native-'));
const report = { source, userData, scope: 'Actual Electron composer/refusal/restart with disposable profiles; no provider or complete preparation claim.', checks: [], frames: [], passed: false };
let app, page;
const persist = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
async function boot() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
}
async function shot(name, width = 1400) {
  await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 900), width);
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize()), [width, 900]);
  await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); persist();
}
try {
  await boot();
  await page.evaluate(async () => { await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused', theme: 'dark' }); location.reload(); });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const owner = await page.evaluate(() => { const s = window.__barkdown.state, chat = s.chats[s.current]; return { profileId: s.profileId, chatId: chat.id, count: chat.messages.length }; });
  const registry = createProfileRegistry(path.join(userData, 'profile-data'));
  const record = createProfileLaunchAdmission({ registry }).close(owner.profileId);
  const draft = 'Keep my draft while this profile prepares for migration.';
  await page.locator('#bw-prompt').fill(draft); await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.body.textContent.includes('New agent turns are stopped'));
  assert.equal(await page.locator('#bw-prompt').inputValue(), draft);
  // The composer intentionally keeps a visible failed pair. The authoritative
  // workspace must not reserve a provider turn or persist that optimistic pair.
  const refused = await page.evaluate(id => window.__barkdown.state.chats[id].messages.at(-1), owner.chatId);
  assert.match(refused.error, /New agent turns are stopped/);
  assert.equal(refused.streaming, false);
  report.checks.push('real composer send refuses before transcript reservation and restores the exact unsent draft');
  await shot('01-refused-draft'); await shot('02-narrow-refusal', 820);
  const workspace = path.join(registry.storeFor(owner.profileId).storeDir, 'workspace.json');
  for (let i = 0; i < 100 && JSON.parse(fs.readFileSync(workspace)).chats[owner.chatId].draft !== draft; i++) await new Promise(r => setTimeout(r, 50));
  assert.equal(JSON.parse(fs.readFileSync(workspace)).chats[owner.chatId].draft, draft);
  const persisted = JSON.parse(fs.readFileSync(workspace));
  assert.equal(persisted.chats[owner.chatId].messages.length, owner.count);
  assert.equal(Object.keys(persisted.ownership?.attempts || {}).length, 0);
  await app.close(); app = null; await boot();
  assert.equal(await page.locator('#bw-prompt').inputValue(), draft);
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.body.textContent.includes('New agent turns are stopped'));
  assert.equal(await page.locator('#bw-prompt').inputValue(), draft);
  assert.equal(createProfileLaunchAdmission({ registry }).read(owner.profileId).id, record.id);
  report.checks.push('restart preserves both durable closure and unsent draft; sending still refuses');
  await shot('03-restarted-refusal');
  report.passed = true;
} catch (error) { report.error = error.stack; throw error; }
finally { if (app) await app.close(); persist(); console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks })); }
