// An unreadable import journal is recovery evidence, not an ordinary profile.
// Disposable profiles only: no database restore, provider turn or real library.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = path.dirname(appRoot);
const out = path.join(appRoot, 'test-results/profile-import-journal', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-import-journal-')));
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const home = registry.createProfile({ name: 'Original disposable profile' });
const half = registry.createProfile({ name: 'Unfinished import' });
for (const profile of [home, half]) createStore(registry.storeFor(profile.id).storeDir, { create: false }).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: false, local: { enabled: false } } });
registry.selectProfile(home.id);
const journal = path.join(registry.storeFor(half.id).storeDir, 'profile-import.json');
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), status: 'running', checks: [], screenshots: [],
  limits: ['Synthetic interrupted-import journals, not an actual interrupted database restore', 'Actual Electron IPC selection and process restart; no real library or provider turn', 'The imported positive control is a seeded journal, not proof of a successful data restore'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
let app, page;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1200, height: 800 });
};
const close = async () => {
  if (!app) return;
  let timer;
  try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('App quit exceeded 90 seconds')), 90000); })]); app = null; }
  finally { clearTimeout(timer); }
};
const select = id => page.evaluate(async profileId => {
  try { await window.barkdown.profiles.select(profileId); return { allowed: true }; }
  catch (error) { return { allowed: false, message: error.message }; }
}, id);
const refusal = async bytes => {
  const status = await page.evaluate(() => window.barkdown.profiles.status());
  assert.equal(status.profileId, home.id);
  assert.equal(status.profiles.find(p => p.id === half.id).interruptedImport.phase, 'blocked');
  const refused = await select(half.id);
  assert.equal(refused.allowed, false);
  assert.match(refused.message, /\[portable_incomplete\].*import that did not finish/);
  assert.equal(registry.load().selectedProfileId, home.id);
  assert.equal(fs.readFileSync(journal, 'utf8'), bytes, 'corrupt evidence is preserved');
};
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
persist();
try {
  fs.writeFileSync(journal, '{"version":1,');
  await launch();
  for (const bytes of ['{"version":1,', '', 'null', 'false', '0', '""']) {
    fs.writeFileSync(journal, bytes); await refusal(bytes);
  }
  report.checks.push('Six corrupt/false-valued journals refuse actual IPC selection and preserve the selected profile and journal bytes');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.locator('[data-import-discard]').waitFor();
  await page.locator('[data-import-discard]').evaluate(button => button.closest('.bw-set').scrollIntoView({ block: 'center' }));
  await shot('01-blocked-in-settings');
  await close(); await launch();
  await refusal('""');
  report.checks.push('A fresh process still refuses the corrupt import');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.locator('[data-import-discard]').waitFor();
  await page.locator('[data-import-discard]').evaluate(button => button.closest('.bw-set').scrollIntoView({ block: 'center' }));
  await shot('02-blocked-after-restart');
  // Independent positive control after all refusal assertions; this is not recovery.
  fs.writeFileSync(journal, JSON.stringify({ version: 1, phase: 'imported', profileId: half.id }));
  assert.deepEqual(await select(half.id), { allowed: true });
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, half.id);
  assert.deepEqual(await select(home.id), { allowed: true });
  assert.equal(registry.load().selectedProfileId, home.id);
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  report.checks.push('Valid imported and ordinary missing-journal profiles remain selectable');
  await shot('03-ordinary-profile-restored');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = { message: error.message, stack: error.stack };
  if (page) await shot('failure').catch(() => {});
  throw error;
} finally { try { await close(); } finally { persist(); console.log(JSON.stringify({ out, status: report.status, checks: report.checks })); } }
