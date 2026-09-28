// Real profile-owned runtime and Paper; only write acknowledgement is delayed.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { DOC_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
if (!process.env.BARKDOWN_TEST_BP_SOURCE) throw new Error('Explicit disposable runtime source required');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-paper-'));
const capture = process.env.BARKDOWN_PROFILE_CAPTURE === '1';
const out = path.resolve(capture ? '../docs/visual/profiles/runs/' + new Date().toISOString().replace(/[:.]/g, '-') : 'test-results/profile-paper');
fs.mkdirSync(out, { recursive: true });
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const frames = [], checks = [], page = await app.firstWindow();
page.setDefaultTimeout(180000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shot = async name => { const file = name + '.png'; await page.screenshot({ path: path.join(out, file) }); frames.push(file); };
try {
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1400, height: 900 });
  const initial = await page.evaluate(async source => {
    const api = window.barkdown;
    window.__barkdown.state.settings = await api.settings.set({ barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } });
    return { status: await api.profiles.status(), second: await api.profiles.create('Second library') };
  }, process.env.BARKDOWN_TEST_BP_SOURCE);
  await app.evaluate(async ({ app, safeStorage }) => {
    const r = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js'), store = r('./store'), bp = r('./barkpark');
    const descriptor = store.readJson('runtime.json'), encrypted = store.readJson('local-credentials.json').token;
    const token = encrypted.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(encrypted.slice(4), 'base64')) : Buffer.from(encrypted.slice(6), 'base64').toString();
    const config = { enabled: true, server: `http://127.0.0.1:${descriptor.port}`, token, dataset: 'production', writes: true, viaCli: false };
    const response = await fetch(config.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'profile-fixture', _type: 'tag', title: 'Profile fixture' } }, { publish: { id: 'profile-fixture', type: 'tag' } }] }) });
    if (!response.ok) throw new Error('Fixture tag registration failed');
    await bp.publish(config, { slug: 'owned-paper', title: 'A private paper', description: 'Disposable profile switching proof with a real Paper save and captured delayed acknowledgement.', tags: [{ tag: 'profile-fixture', strength: 90, rationale: 'Disposable profile fixture' }], blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'Original A content.' }] }] });
    const original = bp.applyOps;
    globalThis.profilePaperFixture = { release: null, delay: true, config };
    bp.applyOps = async (...args) => { if (globalThis.profilePaperFixture.delay) await new Promise(resolve => { globalThis.profilePaperFixture.release = resolve; }); return original(...args); };
  });
  await page.evaluate(async () => { await window.__barkdown.refreshLibrary(); window.__barkdown.openTarget({ kind: 'doc', id: 'owned-paper', source: 'barkpark', title: 'A private paper' }); });
  const pm = page.locator('.bw-paper-pane:not([hidden]) .ProseMirror'); await pm.waitFor();
  await shot('01-profile-paper');
  await pm.click(); await page.keyboard.press(DOC_END); await page.keyboard.type(' Human edit retained in A.');
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent === 'Saving…');
  await shot('02-save-pending');
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(initial.second.id); await page.locator('#profile-switch').click();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, initial.status.profileId);
  assert.match(await pm.innerText(), /Human edit retained in A/);
  await shot('03-switch-blocked');
  checks.push('Settings profile switch refuses a real in-flight human Paper save and retains A canvas');
  await page.locator('.bw-settings [data-act="cancel"]').click();
  await app.evaluate(() => { globalThis.profilePaperFixture.delay = false; globalThis.profilePaperFixture.release(); });
  await page.waitForFunction(() => /Saved · rev/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''));
  const actual = await app.evaluate(async ({ app }) => { const bp = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./barkpark'); return (await bp.getPaper(globalThis.profilePaperFixture.config, 'owned-paper')).markdown; });
  assert.match(actual, /Human edit retained in A/); await shot('04-owned-save-acknowledged');
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(initial.second.id); await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, initial.second.id);
  assert.equal((await page.evaluate(() => window.barkdown.docs.list())).length, 0);
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').waitFor(); await shot('05-second-library');
  await page.setViewportSize({ width: 760, height: 900 }); await shot('06-profiles-narrow');
  checks.push('Acknowledged A edit remains on real server; switching to empty B stops foreground A runtime');
  assert.deepEqual(errors, []);
} finally {
  await app.evaluate(() => { if (globalThis.profilePaperFixture) { globalThis.profilePaperFixture.delay = false; globalThis.profilePaperFixture.release?.(); } }).catch(() => {});
  await app.close();
  const { GIFEncoder, quantize, applyPalette } = require('gifenc'), { PNG } = require('pngjs');
  const gif = GIFEncoder();
  for (const file of frames.filter(file => !file.includes('narrow'))) { const png = PNG.sync.read(fs.readFileSync(path.join(out, file))), palette = quantize(png.data, 256); gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: 1100 }); }
  if (frames.length) { gif.finish(); fs.writeFileSync(path.join(out, 'profile-switch.gif'), gif.bytes()); }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'app'], { encoding: 'utf8' }).trim() !== '', userData, frames, checks, stopped: true, motion: 'Real UI checkpoints; explicit delayed acknowledgement around real HTTP applyOps. No model simulation or CLI changes.' }, null, 2));
}
console.log(JSON.stringify({ checks, out, userData }));
