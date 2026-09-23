// One disposable same-machine source -> Electron adoption -> Paper edit -> restart -> rollback journey.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import net from 'node:net'; import crypto from 'node:crypto'; import assert from 'node:assert/strict';
import { tinyPng } from './png.mjs';
const require = createRequire(import.meta.url);
if (!process.env.BARKDOWN_TEST_BP_SOURCE) throw new Error('Explicit disposable runtime source required');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-adoption-runtime-ui-'));
const legacy = path.join(userData, 'barkdown'), dataDir = path.join(legacy, 'local-barkpark/default');
const out = path.resolve(process.env.BARKDOWN_ADOPTION_CAPTURE === '1' ? '../docs/visual/adoption/runs/' + new Date().toISOString().replace(/[:.]/g, '-') : 'test-results/adoption-runtime-ui');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(path.join(legacy, 'attachments'), { recursive: true });
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const config = { source, port: await freePort(), pgPort: await freePort() };
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const encode = text => 'plain:' + Buffer.from(text).toString('base64');
const credentials = JSON.stringify({ password: encode(secrets.password), token: encode(secrets.token) });
fs.writeFileSync(path.join(legacy, 'local-credentials.json'), credentials);
fs.writeFileSync(path.join(legacy, 'settings.json'), JSON.stringify({ provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { ...config, enabled: true } } }));
const attachment = path.join(legacy, 'attachments', 'original.png'); fs.writeFileSync(attachment, tinyPng(32, 32, [40, 140, 80]));
fs.writeFileSync(path.join(legacy, 'workspace.json'), JSON.stringify({ version: 1, current: 'parent', order: ['parent', 'side'], chats: {
  parent: { id: 'parent', title: 'Adopted working notes', folder: null, messages: [], events: [], apiHistory: [], following: true, tabs: [], draft: 'Preserved parent draft', images: [attachment], draftImages: [{ id: 'original', path: attachment, url: 'file:///' + attachment.replaceAll('\\', '/'), name: 'original.png', mime: 'image/png', size: fs.statSync(attachment).size }] },
  side: { id: 'side', title: 'Saved side conversation', side: true, parent: 'parent', messages: [], events: [], apiHistory: [], following: true, tabs: [], draft: 'Preserved side draft' },
} }));
const { LocalBarkpark } = require('../main/local-barkpark'), { SourceDriver } = require('../main/local-barkpark-source');
const { assertCold } = require('../main/profile-runtime-adoption'), bp = require('../main/barkpark');
const driver = new SourceDriver(config, dataDir, secrets), original = new LocalBarkpark(driver, { retries: 0 });
original.on('status', status => console.log('source:', status.phase, status.error || ''));
const connection = { server: `http://127.0.0.1:${config.port}`, token: secrets.token, dataset: 'production', writes: true, viaCli: false };
const git = (args, cwd = path.resolve('..')) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const report = { sourceCommit: git(['rev-parse', 'HEAD']), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', barkparkCommit: git(['rev-parse', 'HEAD'], source), barkparkDirty: git(['status', '--porcelain'], source) !== '', userData, frames: [], checks: [], stopped: false, portability: false };
const record = text => { report.checks.push(text); console.log('PASS ' + text); };
let app, page, profileDir;
const launch = flags => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`, ...flags], timeout: 180000, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const shot = async name => { const file = name + '.png'; await page.setViewportSize({ width: 1400, height: 900 }); await page.screenshot({ path: path.join(out, file) }); report.frames.push(file); };
async function openPaper() {
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'doc', source: 'barkpark', id: 'adopted-paper', title: 'A retained paper' }));
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor({ timeout: 180000 });
}
try {
  console.log('Disposable adoption runtime:', userData);
  await original.start();
  const tag = await fetch(connection.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + secrets.token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'adoption-ui-fixture', _type: 'tag', title: 'Adoption UI fixture' } }, { publish: { id: 'adoption-ui-fixture', type: 'tag' } }] }) });
  assert.equal(tag.status, 200, await tag.text());
  const media = await bp.uploadMedia(connection, { name: 'original.png', mime: 'image/png', filePath: attachment });
  await bp.publish(connection, { slug: 'adopted-paper', title: 'A retained paper', description: 'Disposable full Electron legacy adoption and rollback verification with original media.', tags: [{ tag: 'adoption-ui-fixture', strength: 95, rationale: 'Full startup migration fixture' }], blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'Original note retained through adoption.' }] }, { type: 'image', src: media.src, alt: 'Original media', width: 32, height: 32 }] });
  const before = await bp.getPaper(connection, 'adopted-paper');
  await original.stop(); await assertCold(dataDir);
  record('original real runtime published note/media and stopped cleanly before adoption');
  app = await launch(['--adopt-legacy']); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000);
  await page.getByRole('button', { name: 'Adopt existing library' }).waitFor(); await shot('01-confirm-adoption');
  const nextWindow = app.waitForEvent('window', { timeout: 180000 });
  await page.getByRole('button', { name: 'Adopt existing library' }).click();
  await page.getByRole('heading', { name: 'Preparing your library' }).waitFor(); await shot('02-preparing');
  page = await nextWindow; page.setDefaultTimeout(180000); await openPaper();
  const loaded = await page.evaluate(async () => ({ status: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load(), settings: await window.barkdown.settings.get() }));
  profileDir = loaded.settings.userData;
  assert.equal(loaded.ws.chats.side.parent, 'parent'); assert.equal(loaded.ws.chats.side.draft, 'Preserved side draft');
  assert.equal(loaded.ws.chats.parent.draft, 'Preserved parent draft');
  assert(loaded.ws.chats.parent.images[0].startsWith(profileDir)); assert(fs.existsSync(loaded.ws.chats.parent.images[0]));
  assert(loaded.ws.chats.parent.draftImages[0].path.startsWith(profileDir));
  await page.waitForFunction(() => { const image = document.querySelector('#bw-attachments img'); return image?.complete && image.naturalWidth === 32; });
  assert.equal(fs.readFileSync(path.join(profileDir, 'local-credentials.json'), 'utf8'), credentials);
  assert.deepEqual(Buffer.from(await (await fetch(media.src)).arrayBuffer()), fs.readFileSync(attachment));
  await shot('03-adopted-paper');
  record('actual startup activated UUID profile with original credentials/media origin, draft/side-parent and remapped attachment');
  const editor = page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
  await editor.locator('p').first().click(); await page.keyboard.press('End'); await page.keyboard.type(' Adopted human edit.');
  await page.waitForFunction(() => /Saved · rev/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''));
  assert.match((await bp.getPaper(connection, 'adopted-paper')).markdown, /Adopted human edit/); await shot('04-adopted-save');
  await app.close(); app = null; await assertCold(path.join(profileDir, 'local-barkpark/runtime'));
  app = await launch([]); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000); await openPaper();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, loaded.status.profileId);
  assert.match(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText(), /Adopted human edit/); await shot('05-restarted-profile');
  await app.close(); app = null; await assertCold(path.join(profileDir, 'local-barkpark/runtime'));
  record('human Paper edit acknowledged and actual process restart without flags restored adopted authority and edit');
  app = await launch(['--rollback-adoption']); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000);
  await page.getByRole('button', { name: 'Restore legacy authority' }).waitFor(); await shot('06-confirm-rollback');
  const legacyWindow = app.waitForEvent('window', { timeout: 180000 }); await page.getByRole('button', { name: 'Restore legacy authority' }).click();
  page = await legacyWindow; page.setDefaultTimeout(180000); await openPaper();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).enabled, false);
  const restored = await bp.getPaper(connection, 'adopted-paper'); assert.equal(restored.rev, before.rev); assert.equal(restored.markdown, before.markdown);
  assert.deepEqual(Buffer.from(await (await fetch(media.src)).arrayBuffer()), fs.readFileSync(attachment)); await shot('07-restored-original');
  record('explicit offline rollback restarted original unchanged revision/content/media while retaining edited profile');
} catch (error) { report.error = error.message; throw error; }
finally {
  const cleanupErrors = [];
  if (app) await app.close().catch(error => cleanupErrors.push(error.message));
  await original.stop().catch(error => cleanupErrors.push(error.message));
  const pids = [];
  function scan(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) scan(file); else if (entry.name === 'postmaster.pid') pids.push(file); } }
  scan(userData); report.stopped = !pids.length && !cleanupErrors.length; report.cleanupErrors = cleanupErrors; report.finishedAt = new Date().toISOString();
  const { GIFEncoder, quantize, applyPalette } = require('gifenc'), { PNG } = require('pngjs'); const gif = GIFEncoder();
  for (const file of report.frames) { const png = PNG.sync.read(fs.readFileSync(path.join(out, file))), palette = quantize(png.data, 256); gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: 1200 }); }
  if (report.frames.length) { gif.finish(); fs.writeFileSync(path.join(out, 'adoption.gif'), gif.bytes()); }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2));
  console.log('Evidence:', out, 'stopped:', report.stopped);
  if (!report.stopped) throw new Error('Owned adoption fixture cleanup incomplete');
}
