import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
// Credentials at rest: safeStorage wraps them with the OS store (DPAPI on Windows, the Keychain on
// macOS, the secret service on Linux). The Local State key file and its refusal path are Windows-only
// by design (main/credential-durability.js); everything else here runs on every host.
const require = createRequire(import.meta.url);
const roots = [], errors = [], frames = [], shots = path.resolve('test-results/credential-durability');
fs.mkdirSync(shots, { recursive: true });
const makeRoot = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-credential-live-')); roots.push(root); return root; };
let app, page;
async function boot(root) {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${root}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
}
async function killMain(root) {
  const identity = await app.evaluate(({ app }) => ({ pid: process.pid, root: app.getPath('userData') }));
  assert.equal(path.resolve(identity.root), path.resolve(root));
  const exit = new Promise(resolve => app.process().once('exit', resolve));
  process.kill(identity.pid, 'SIGKILL'); await exit; app = null;
}
function settings(root, id) {
  const file = path.join(root, 'profile-data', 'profiles', id, 'settings.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
}
try {
  const first = makeRoot(); await boot(first);
  const owner = await page.evaluate(() => window.__barkdown.state.profileId);
  await page.keyboard.press('Control+,');
  await page.locator('button[data-pane="assistant"]').click();
  await page.locator('#api-key').fill('synthetic-api-durability');
  await page.locator('button[data-pane="barkpark"]').click();
  await page.locator('#bp-token').fill('synthetic-server-durability');
  await page.locator('[data-act="save"]').click();
  const saving = page.locator('.bw-settings[aria-busy="true"]');
  if (await saving.count()) {
    assert.equal(await page.locator('[data-act="save"]').isDisabled(), true);
    await page.screenshot({ path: path.join(shots, 'saving-awaits-key.png') });
    frames.push('saving-awaits-key.png');
  }
  await page.locator('.bw-settings').waitFor({ state: 'detached' });
  if (process.platform === 'win32') {
    const localState = JSON.parse(fs.readFileSync(path.join(first, 'Local State')));
    assert.ok(localState.os_crypt.encrypted_key);
  }
  assert.equal(await app.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable()), true, 'the OS credential store is available to this host');
  const saved = settings(first, owner);
  assert.match(saved.apiKeyEncrypted, /^enc:/); assert.match(saved.barkpark.tokenEncrypted, /^enc:/);
  await killMain(first); await boot(first);
  const readable = await app.evaluate(({ safeStorage }, values) => values.map(value => {
    try { return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64')); } catch { return ''; }
  }), [saved.apiKeyEncrypted, saved.barkpark.tokenEncrypted]);
  assert.deepEqual(readable, ['synthetic-api-durability', 'synthetic-server-durability']);
  await page.keyboard.press('Control+,'); await page.locator('button[data-pane="assistant"]').click();
  await page.screenshot({ path: path.join(shots, 'configured-after-crash.png') });
  frames.push('configured-after-crash.png');
  if (process.platform === 'win32') {
    const keyFile = path.join(first, 'Local State'), originalKeyFile = fs.readFileSync(keyFile);
    fs.writeFileSync(keyFile + '.fixture-before-refusal', originalKeyFile);
    try {
      // Only this disposable synthetic app's key file is changed. A refusal must
      // leave previously acknowledged credential ciphertext byte-for-byte intact.
      fs.writeFileSync(keyFile, '{}');
      await assert.rejects(page.evaluate(() => window.barkdown.settings.set({ apiKey: 'must-not-replace-old-key' })), /protected key/);
      assert.equal(settings(first, owner).apiKeyEncrypted, saved.apiKeyEncrypted);
      assert.equal(settings(first, owner).barkpark.tokenEncrypted, saved.barkpark.tokenEncrypted);
    } finally { fs.writeFileSync(keyFile, originalKeyFile); }
  } else console.log('credential-durability.live.mjs: the Local State refusal half is Windows-only by design (no key file to corrupt with the Keychain); the rest ran on ' + process.platform);
  await app.close(); app = null;

  const second = makeRoot(); await boot(second);
  const a = await page.evaluate(() => window.__barkdown.state.profileId);
  const b = await page.evaluate(() => window.barkdown.profiles.create('Other credential owner'));
  await page.evaluate(async id => {
    const save = window.barkdown.settings.set({ provider: 'api', apiKey: 'synthetic-owned-key' });
    const select = window.barkdown.profiles.select(id);
    await Promise.all([save, select]); location.reload();
  }, b.id);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.id);
  assert.match(settings(second, a).apiKeyEncrypted, /^enc:/);
  assert.equal(settings(second, b.id).apiKeyEncrypted, undefined);
  await killMain(second); await boot(second);
  assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), b.id);
  const keySurvives = await app.evaluate(({ safeStorage }, value) => safeStorage.decryptString(Buffer.from(value.slice(4), 'base64')) === 'synthetic-owned-key', settings(second, a).apiKeyEncrypted);
  assert.equal(keySurvives, true);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(shots, 'manifest.json'), JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()), capturedAt: new Date().toISOString(), frames, credentials: 'Synthetic disposable API key and server token; actual Electron safeStorage, no environment key' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: ['real first-run API and server-token save', 'protected key exists before acknowledgement', 'immediate actual main kill retains decryptable ciphertext', 'invalid key storage refuses replacement and preserves old ciphertext', 'pending save stays in profile A while switching to B', 'selected B restart and retained A credentials'], roots }));
} finally { if (app) await app.close(); }
