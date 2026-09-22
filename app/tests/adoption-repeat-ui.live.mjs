// C022: actual cold adoption, acknowledged edit, repeated adoption, restart and rollback.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import net from 'node:net'; import crypto from 'node:crypto'; import assert from 'node:assert/strict';
import { tinyPng } from './png.mjs';
const require = createRequire(import.meta.url);
if (!process.env.BARKDOWN_TEST_BP_SOURCE) throw new Error('Explicit disposable runtime source required');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-repeat-adoption-'));
const legacy = path.join(userData, 'barkdown'), dataDir = path.join(legacy, 'local-barkpark/default');
const out = path.resolve('../docs/visual/adoption-repeat/runs/' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(path.join(legacy, 'attachments'), { recursive: true });
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const config = { source, port: await freePort(), pgPort: await freePort() };
while (config.pgPort === config.port) config.pgPort = await freePort();
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
const { assertCold, runtimeInventory } = require('../main/profile-runtime-adoption'), bp = require('../main/barkpark');
const driver = new SourceDriver(config, dataDir, secrets), original = new LocalBarkpark(driver, { retries: 0 });
original.on('status', status => console.log('source:', status.phase, status.error || ''));
const connection = { server: `http://127.0.0.1:${config.port}`, token: secrets.token, dataset: 'production', writes: true, viaCli: false, enabled: true };
const git = (args, cwd = path.resolve('..')) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const report = { sourceCommit: git(['rev-parse', 'HEAD']), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', barkparkCommit: git(['rev-parse', 'HEAD'], source), barkparkDirty: git(['status', '--porcelain'], source) !== '', userData, frames: [], checks: [], stopped: false, portability: false };
const record = text => { report.checks.push(text); console.log('PASS ' + text); };
let app, page, profileDir;
const launch = flags => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`, ...flags], timeout: 180000, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const shot = async name => { const file = name + '.png'; await page.screenshot({ path: path.join(out, file) }); report.frames.push(file); };
function hashTree(root, exclude = []) {
  if (!fs.existsSync(root)) return {};
  const result = {};
  function walk(dir, prefix = '') {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!prefix && exclude.includes(item.name)) continue;
      const rel = prefix + item.name, file = path.join(dir, item.name);
      assert(!item.isSymbolicLink(), 'fixture inventories reject linked entries');
      if (item.isDirectory()) walk(file, rel + '/');
      else result[rel] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  walk(root); return result;
}
const inventoryDigest = value => ({ entries: value.files?.length ?? Object.keys(value).length, sha256: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') });
function workspaceInventory(root) {
  const ws = JSON.parse(fs.readFileSync(path.join(root, 'workspace.json')));
  return { current: ws.current, order: ws.order, pages: ws.pages, favorites: ws.favorites,
    chats: Object.fromEntries(Object.entries(ws.chats).map(([id, c]) => [id, { id: c.id, parent: c.parent, side: c.side, folder: c.folder, draft: c.draft, draftImages: c.draftImages, messages: c.messages, active: c.active, tabs: c.tabs }])) };
}
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
  const read = await bp.getPaper(connection, 'adopted-paper');
  const ownedStore = require('../main/store').createStore(legacy);
  const localDoc = require('../main/documents').createDocuments(ownedStore).create({ title: 'Original local note', markdown: 'Keep this legacy note through repeated adoption.' });
  const sourceWorkspace = ownedStore.readJson('workspace.json');
  sourceWorkspace.pages = { layoutVersion: 2, roots: [localDoc.id], children: { [localDoc.id]: ['bp:adopted-paper'] }, expanded: { [localDoc.id]: true }, seeded: true, archiveOpen: false, cloudArchiveOpen: false };
  sourceWorkspace.favorites = [{ id: 'original-favorite', label: 'Original Paper favorite', target: { kind: 'doc', id: 'adopted-paper', source: 'barkpark', title: 'A retained paper' }, chatId: 'parent', chatTitle: 'Adopted working notes', folder: null }];
  sourceWorkspace.chats.parent.tabs = [{ id: 'original-paper-tab', type: 'doc', source: 'barkpark', path: ['adopted-paper'], title: 'A retained paper', scroll: 0 }];
  sourceWorkspace.chats.parent.active = 'original-paper-tab';
  sourceWorkspace.chats.parent.messages = [{ id: 'original-user', role: 'user', text: 'Keep this original conversation.' }];
  ownedStore.writeJson('workspace.json', sourceWorkspace);
  const edits = require('../main/agent-edits').createAgentEdits({ store: ownedStore, documents: {} });
  const sourceReceipt = await edits.apply({ id: 'bp:adopted-paper', baseRev: read.rev, mode: 'append', markdown: 'Original agent receipt content.', summary: 'Before adoption' }, connection);
  const before = await bp.getPaper(connection, 'adopted-paper'); assert.equal(before.rev, sourceReceipt.afterRev);
  await original.stop(); await assertCold(dataDir);
  const originalShell = hashTree(legacy, ['local-barkpark']), originalRuntime = await runtimeInventory(dataDir);
  report.originalInventory = { shell: inventoryDigest(originalShell), runtime: inventoryDigest(originalRuntime) };
  record('original real runtime published note/media and revision-checked receipt, then stopped cleanly');
  app = await launch(['--adopt-legacy']); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000);
  await page.getByRole('button', { name: 'Adopt existing library' }).waitFor(); await shot('01-confirm-adoption');
  const nextWindow = app.waitForEvent('window', { timeout: 180000 });
  await page.getByRole('button', { name: 'Adopt existing library' }).click();
  await page.getByRole('heading', { name: 'Preparing your library' }).waitFor(); await shot('02-preparing');
  page = await nextWindow; page.setDefaultTimeout(180000); await openPaper();
  const loaded = await page.evaluate(async () => ({ status: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load(), settings: await window.barkdown.settings.get() }));
  profileDir = loaded.settings.userData;
  assert.equal(loaded.status.profiles.length, 1);
  const journal = JSON.parse(fs.readFileSync(path.join(userData, 'legacy-adoption.json')));
  const work = path.join(userData, 'legacy-adoption-work', journal.operationId);
  const shellBackupDir = path.join(work, 'shell-original'), runtimeBackupDir = path.join(profileDir, 'runtime-adoption-backup');
  const shellBackup = hashTree(shellBackupDir), runtimeBackup = hashTree(runtimeBackupDir);
  assert.deepEqual(shellBackup, originalShell, 'shell backup is byte-identical to cold original');
  assert.deepEqual(await runtimeInventory(dataDir), originalRuntime);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profileDir, 'agent-edits', fs.readdirSync(path.join(profileDir, 'agent-edits'))[0]))).id, sourceReceipt.id);
  assert.equal(loaded.ws.chats.side.parent, 'parent'); assert.equal(loaded.ws.chats.side.draft, 'Preserved side draft');
  assert.equal(loaded.ws.chats.parent.draft, 'Preserved parent draft');
  assert.deepEqual(loaded.ws.pages, sourceWorkspace.pages); assert.deepEqual(loaded.ws.favorites, sourceWorkspace.favorites);
  assert.equal(loaded.ws.chats.parent.tabs.length, 1); assert.equal(loaded.ws.chats.parent.tabs[0].id, 'original-paper-tab');
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
  const acknowledged = await bp.getPaper(connection, 'adopted-paper'); assert.match(acknowledged.markdown, /Adopted human edit/); await shot('04-adopted-save');
  const paperIds = (await bp.listPapers(connection)).map(p => p.id).sort();
  await app.close(); app = null; await assertCold(path.join(profileDir, 'local-barkpark/runtime'));
  const beforeRepeat = workspaceInventory(profileDir), receiptsBefore = hashTree(path.join(profileDir, 'agent-edits'));
  const localDocumentsBefore = hashTree(path.join(profileDir, 'documents'));
  app = await launch(['--adopt-legacy']); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000); await openPaper();
  const repeated = await page.evaluate(() => window.barkdown.profiles.status());
  assert.equal(repeated.profileId, loaded.status.profileId); assert.equal(repeated.profiles.length, 1);
  assert.deepEqual(workspaceInventory(profileDir), beforeRepeat, 'repeat must not duplicate or rewrite navigation/chats');
  assert.deepEqual(hashTree(path.join(profileDir, 'agent-edits')), receiptsBefore);
  assert.deepEqual(hashTree(path.join(profileDir, 'documents')), localDocumentsBefore);
  assert.deepEqual(hashTree(legacy, ['local-barkpark']), originalShell);
  assert.deepEqual(await runtimeInventory(dataDir), originalRuntime);
  assert.deepEqual(hashTree(shellBackupDir), shellBackup); assert.deepEqual(hashTree(runtimeBackupDir), runtimeBackup);
  const repeatedPaper = await bp.getPaper(connection, 'adopted-paper'); assert.equal(repeatedPaper.rev, acknowledged.rev); assert.equal(repeatedPaper.markdown, acknowledged.markdown);
  assert.deepEqual((await bp.listPapers(connection)).map(p => p.id).sort(), paperIds, 'actual Paper inventory cannot duplicate');
  assert.deepEqual(Buffer.from(await (await fetch(media.src)).arrayBuffer()), fs.readFileSync(attachment));
  report.repetition = { profileId: repeated.profileId, profileCount: repeated.profiles.length, paperIds, chatCount: Object.keys(beforeRepeat.chats).length, workspace: inventoryDigest(beforeRepeat), receipts: inventoryDigest(receiptsBefore), localDocuments: inventoryDigest(localDocumentsBefore), shellBackup: inventoryDigest(shellBackup), runtimeBackup: inventoryDigest(runtimeBackup), originalRev: before.rev, savedRev: acknowledged.rev };
  await shot('05-repeated-adoption'); record('second explicit adoption retains one UUID, exact inventories/source/backup hashes and acknowledged Paper revision/media');
  await app.close(); app = null; await assertCold(path.join(profileDir, 'local-barkpark/runtime'));
  app = await launch([]); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000); await openPaper();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, loaded.status.profileId);
  assert.match(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText(), /Adopted human edit/); await shot('06-restarted-profile');
  await app.close(); app = null; await assertCold(path.join(profileDir, 'local-barkpark/runtime'));
  record('human Paper edit acknowledged and actual process restart without flags restored adopted authority and edit');
  const retainedRuntime = await runtimeInventory(path.join(profileDir, 'local-barkpark/runtime'));
  app = await launch(['--rollback-adoption']); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000);
  await page.getByRole('button', { name: 'Restore legacy authority' }).waitFor(); await shot('07-confirm-rollback');
  const legacyWindow = app.waitForEvent('window', { timeout: 180000 }); await page.getByRole('button', { name: 'Restore legacy authority' }).click();
  page = await legacyWindow; page.setDefaultTimeout(180000); await openPaper();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).enabled, false);
  const restored = await bp.getPaper(connection, 'adopted-paper'); assert.equal(restored.rev, before.rev); assert.equal(restored.markdown, before.markdown);
  assert.deepEqual(Buffer.from(await (await fetch(media.src)).arrayBuffer()), fs.readFileSync(attachment)); await shot('08-restored-original');
  const retired = path.join(work, 'retired-registry', 'profiles', loaded.status.profileId);
  assert(fs.existsSync(retired)); assert.deepEqual(hashTree(path.join(retired, 'runtime-adoption-backup')), runtimeBackup);
  assert.deepEqual(await runtimeInventory(path.join(retired, 'local-barkpark/runtime')), retainedRuntime, 'rollback retains the edited cold database byte-for-byte');
  assert.deepEqual(hashTree(shellBackupDir), shellBackup); assert.deepEqual(hashTree(path.join(retired, 'agent-edits')), receiptsBefore);
  record('rollback restarted original unchanged revision/content/media, preserved backups and retained edited profile');
} catch (error) { report.error = error.stack; console.error(error.stack); if (page && !page.isClosed()) await shot('failure-state').catch(() => {}); fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2)); throw error; }
finally {
  const cleanupErrors = [];
  if (app) await app.close().catch(error => cleanupErrors.push(error.message));
  await original.stop().catch(error => cleanupErrors.push(error.message));
  const pids = [];
  function scan(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) scan(file); else if (entry.name === 'postmaster.pid') pids.push(file); } }
  scan(userData); report.stopped = !pids.length && !cleanupErrors.length; report.cleanupErrors = cleanupErrors; report.finishedAt = new Date().toISOString();
  const { GIFEncoder, quantize, applyPalette } = require('gifenc'), { PNG } = require('pngjs'); const gif = GIFEncoder();
  const frames = report.frames.map(file => PNG.sync.read(fs.readFileSync(path.join(out, file))));
  const width = Math.max(0, ...frames.map(frame => frame.width)), height = Math.max(0, ...frames.map(frame => frame.height));
  for (const frame of frames) {
    // Recovery and main windows have different native bounds. Letterbox without
    // rescaling; the original stills retain exact layout and the GIF never clips.
    const png = new PNG({ width, height }); png.data.fill(255);
    PNG.bitblt(frame, png, 0, 0, frame.width, frame.height, 0, 0);
    const palette = quantize(png.data, 256); gif.writeFrame(applyPalette(png.data, palette), width, height, { palette, delay: 1200 });
  }
  if (report.frames.length) { gif.finish(); fs.writeFileSync(path.join(out, 'adoption.gif'), gif.bytes()); }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2));
  console.log('Evidence:', out, 'stopped:', report.stopped);
  if (!report.stopped) throw new Error('Owned adoption fixture cleanup incomplete');
}
