// An export carried from one Barkdown installation to another (C085). Two installations on one
// machine: separate user data, separate profile registries, separate credentials, never running
// at the same time. The first writes a library, switches it to Paper and exports it to a folder
// outside both; the second imports that folder from Settings and opens the profile.
// It stands in for a second machine; it is not one: same OS, same tools, same Barkpark checkout.
// Needs a built Barkpark checkout at BARKDOWN_TEST_BP_SOURCE (default ../../barkpark-editor).
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { LINE_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
const { verifyExport } = require('../main/profile-export');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
// Optional: the second installation runs a later Barkpark that descends from the first one's.
const newer = process.env.BARKDOWN_TEST_BP_SOURCE_NEWER ? path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE_NEWER) : null;
if (newer && !fs.existsSync(path.join(newer, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE_NEWER must point at a built Barkpark checkout');
const upstreamNewer = newer ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: newer, encoding: 'utf8' }).trim() : null;
if (newer) execFileSync('git', ['merge-base', '--is-ancestor', upstream, upstreamNewer], { cwd: newer });
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + (newer ? '-two-installs-newer' : '-two-installs'));
fs.mkdirSync(out, { recursive: true });
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-two-installs-')));
const first = path.join(root, 'installation-one'), second = path.join(root, 'installation-two'), carry = path.join(root, 'carried-between');
for (const dir of [first, second, carry]) fs.mkdirSync(dir);
const report = { source: host, upstream, ...(newer ? { upstreamOfSecondInstallation: upstreamNewer } : {}), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['Two installations on one machine, one after the other: separate user data, registries and credentials, but the same operating system, tools, Postgres and Barkpark checkout. A second machine, another OS and another Postgres major version are not exercised. The native folder picker is stubbed in the main process.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const settings = { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } };
// Installation one: a library with legacy notes and a conversation.
const one = createProfileRegistry(path.join(first, 'profile-data'));
const desk = one.createProfile({ name: 'Writing desk' }), deskDir = one.storeFor(desk.id).storeDir;
const literalIdentity = `Literal source profile ${desk.id} remains human text.`;
createStore(deskDir).writeJson('settings.json', settings);
const documents = createDocuments(createStore(deskDir, { create: false }));
const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
fs.writeFileSync(path.join(deskDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: desk.id,
  chats: { main: { id: 'main', title: 'Writing room', messages: [{ id: 'm1', role: 'user', text: 'Does this arrive on the other computer?', at: '2026-09-29T12:00:00Z' }, { id: 'm2', role: 'assistant', text: 'It does, with every note and this conversation. ' + literalIdentity, at: '2026-09-29T12:00:05Z' }], events: [], apiHistory: [], tabs: [], draft: literalIdentity } },
  order: ['main'], current: 'main', pages: { layoutVersion: 2, seeded: true, roots: [orchard.id], children: { [orchard.id]: [soil.id] }, expanded: {} }, favorites: [] }));
one.selectProfile(desk.id);
// Installation two: somebody else's Barkdown, with its own empty profile.
const two = createProfileRegistry(path.join(second, 'profile-data'));
const home = two.createProfile({ name: 'Home desk' });
createStore(two.storeFor(home.id).storeDir).writeJson('settings.json', newer ? { ...settings, barkpark: { ...settings.barkpark, local: { enabled: true, source: newer } } } : settings);
two.selectProfile(home.id);
// Appearance belongs to an installation, not to a profile: the second installation has chosen dark for itself.
createStore(path.join(second, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });

let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async userData => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => (report.mainStderr ||= []).push(String(chunk).slice(0, 300)));
  // The window opens after the profile's runtime has started; the first boot of a new library takes about 30 seconds.
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => {
  const started = Date.now();
  for (;;) {
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(error => ({ phase: 'pending', error: error.message }));
    if (status.phase === 'ready') return;
    if (status.phase === 'failed') throw new Error('Profile runtime failed: ' + status.error);
    if (Date.now() - started > 300000) throw new Error('Profile runtime not ready after 5 minutes');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const pick = folder => app.evaluate(({ dialog }, chosenFolder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenFolder] }); }, folder);
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const dismiss = async text => { const notice = page.locator('.bw-preparation-notice', { hasText: text }); await notice.waitFor({ timeout: 30000 }); await notice.locator('[data-dismiss]').click(); await page.waitForFunction(() => !document.querySelector('.bw-preparation-notice')); };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const library = async () => (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => ({ id: p.id, title: p.title })).sort((x, y) => x.id.localeCompare(y.id));
try {
  // Installation one.
  await launch(first); await runtimeReady();
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('.bw-settings-nav [data-pane="barkpark"]').click();
  await page.locator('[data-act="switch-paper"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#bp-switch-status')?.textContent === 'Legacy notes, not switched');
  await page.locator('[data-act="switch-paper"]').click();
  await page.locator('.bw-ask [data-ok]').click();
  await page.waitForFunction(() => window.__barkdown?.state.loaded && window.__barkdown.state.authority === 'paper', null, { timeout: 150000 });
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 30000 });
  await quit(); await launch(first); await runtimeReady();
  await dismiss('The library switch completed');
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Harbour ledger'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Cobalt lanterns mark the quay where the words must arrive.'); await paperSaved();
  const pictured = await page.evaluate(async dataUrl => {
    const note = await window.barkdown.barkpark.createNote(crypto.randomUUID());
    const media = await window.barkdown.barkpark.uploadMedia({ binding: note.binding, name: 'lantern.png', mime: 'image/png', dataUrl });
    const paper = await window.barkdown.barkpark.get(note.id, undefined, note.paperOwner);
    await window.barkdown.barkpark.applyOps(note.id, [{ op: 'append-block', block: { id: 'lantern', type: 'image', src: media.src, alt: 'A cobalt lantern' } }], paper.rev, note.binding);
    return { id: note.id, src: media.src };
  }, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  const carried = await library();
  const ownerOne = await page.evaluate(() => window.__barkdown.state.barkparkDocs[0].paperOwner);
  const tokenOne = await app.evaluate(() => process.env.BARKDOWN_BP_TOKEN);
  await pick(carry); await openSettings();
  await page.locator('#profile-export').click();
  await page.locator('.bw-preparation-notice', { hasText: 'The export completed' }).waitFor({ timeout: 180000 });
  await quit();
  if (newer) {
    // The other direction: an export that claims the later version is refused by this earlier installation.
    await launch(first); await runtimeReady();
    const done = page.locator('.bw-preparation-notice', { hasText: 'The export completed' }); await done.waitFor({ timeout: 30000 }); await done.locator('[data-dismiss]').click();
    const ahead = path.join(root, 'from-a-later-version'); fs.cpSync(path.join(carry, fs.readdirSync(carry)[0]), ahead, { recursive: true });
    const file = path.join(ahead, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8')); manifest.upstream = upstreamNewer; fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    await pick(ahead); await openSettings();
    await page.locator('#profile-import').click();
    await page.waitForFunction(() => document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 120000 });
    const refusedText = await page.locator('#profile-import-status').textContent();
    assert.match(refusedText, new RegExp(`^This export was taken at Barkpark ${upstreamNewer.slice(0, 9)}; this Barkdown runs ${upstream.slice(0, 9)}\\. Import needs the same version or an earlier one`), refusedText);
    assert.equal(one.load().profiles.length, 1);
    report.checks.push({ name: 'An export of a later version is refused by the earlier installation, with the reason, and creates nothing', said: refusedText }); persist();
    await quit();
  }
  const exportDir = path.join(carry, fs.readdirSync(carry)[0]);
  const verified = verifyExport(exportDir);
  const credentialsOne = fs.readFileSync(path.join(deskDir, 'local-credentials.json'), 'utf8');
  for (const file of fs.readdirSync(exportDir, { recursive: true })) { const full = path.join(exportDir, String(file)); if (fs.statSync(full).isFile() && fs.statSync(full).size < 5e6) assert.ok(!fs.readFileSync(full).includes(Buffer.from(tokenOne)), 'the runtime token is in no exported file: ' + file); }
  report.checks.push({ name: 'Installation one: a library switched to Paper with a note, a picture and a conversation is exported to a folder outside the installation; the runtime token is in no exported file', papers: carried.length, files: verified.files }); persist();

  // Installation two.
  await launch(second); await runtimeReady();
  const homeBefore = await library();
  await pick(exportDir); await openSettings();
  await page.locator('#profile-import').click();
  await page.waitForFunction(() => /^Imported /.test(document.querySelector('#profile-import-status')?.textContent || '') || document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 300000 });
  const said = await page.locator('#profile-import-status').textContent();
  assert.match(said, new RegExp(`^Imported “Writing desk \\(imported\\)” with ${carried.length} Papers\\.`), said);
  await page.locator('#profile-import-status').scrollIntoViewIfNeeded();
  await shot('01-imported-on-the-other-installation');
  const profiles = two.load().profiles;
  assert.deepEqual(profiles.map(p => p.name).sort(), ['Home desk', 'Writing desk (imported)']);
  const imported = profiles.find(p => p.id !== home.id), importedDir = two.storeFor(imported.id).storeDir;
  assert.notEqual(imported.id, desk.id, 'the profile has an identity of its own here');
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, imported.id, { timeout: 60000 });
  await runtimeReady();
  await page.waitForFunction(count => window.__barkdown.state.barkparkDocs.length >= count, carried.length, { timeout: 60000 });
  const view = await page.evaluate(() => { const st = window.__barkdown.state; return { authority: st.authority, chat: st.chats.main?.messages.map(m => m.text), roots: st.pages.roots, children: st.pages.children, owners: [...new Set(st.barkparkDocs.map(d => d.paperOwner))] }; });
  assert.equal(view.authority, 'paper');
  assert.deepEqual(view.chat, ['Does this arrive on the other computer?', 'It does, with every note and this conversation. ' + literalIdentity]);
  assert.equal(await page.evaluate(() => window.__barkdown.state.chats.main.draft), literalIdentity);
  assert.deepEqual(await library(), carried, 'the same Papers, by id and title');
  assert.equal(view.owners.length, 1); assert.notEqual(view.owners[0], ownerOne, 'navigation belongs to this installation');
  const keys = [...view.roots, ...Object.values(view.children).flat()].filter(k => String(k).startsWith('bp:v1:'));
  assert.ok(keys.length >= 2); for (const key of keys) assert.ok(key.startsWith(`bp:v1:${view.owners[0]}:`), key);
  for (const title of ['Orchard fieldbook', 'Harbour ledger']) await page.locator(`[title="${title}"], :text-is("${title}")`).first().waitFor({ timeout: 30000 });
  await page.getByText('It does, with every note', { exact: false }).first().waitFor({ timeout: 30000 });
  const harbour = carried.find(p => p.title === 'Harbour ledger');
  assert.match((await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: harbour.id, paperOwner: view.owners[0] })).markdown, /Cobalt lanterns mark the quay/);
  assert.equal((await page.evaluate(id => window.barkdown.docs.get(id), soil.id)).retained, true, 'the retained original is readable');
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: pictured.id, paperOwner: view.owners[0] });
  await page.waitForFunction(() => { const img = document.querySelector('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img'); return img && img.complete && img.naturalWidth === 1; }, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the imported profile opens in the appearance of this installation');
  await shot('02-opened-on-the-other-installation');
  // Credentials belong to this installation: its own token, and the first installation's token is refused.
  const tokenTwo = await app.evaluate(() => process.env.BARKDOWN_BP_TOKEN);
  assert.notEqual(tokenTwo, tokenOne);
  assert.notEqual(fs.readFileSync(path.join(importedDir, 'local-credentials.json'), 'utf8'), credentialsOne);
  const server = `http://127.0.0.1:${JSON.parse(fs.readFileSync(path.join(importedDir, 'runtime.json'), 'utf8')).port}`;
  const probe = token => fetch(server + '/v1/data/query/production/paper?limit=1&perspective=drafts', { headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) }).then(r => r.status);
  assert.equal(await probe(tokenTwo), 200); assert.ok([401, 403].includes(await probe(tokenOne)), 'the exporting installation\'s token is refused');
  const written = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  assert.ok(written.id, 'writing works on the imported profile');
  if (newer) {
    const record = JSON.parse(fs.readFileSync(path.join(importedDir, 'profile-import.json'), 'utf8'));
    assert.equal(record.upstream, upstream); assert.equal(record.importedAtUpstream, upstreamNewer);
    assert.equal(JSON.parse(fs.readFileSync(path.join(importedDir, 'runtime.json'), 'utf8')).source, newer, 'the imported profile runs the later Barkpark');
    report.checks.push({ name: 'The export was taken at an earlier Barkpark and imported by a later one that descends from it; the imported profile runs the later version', exportedAt: upstream.slice(0, 9), importedBy: upstreamNewer.slice(0, 9) }); persist();
  }
  report.checks.push({ name: 'Installation two: the folder is imported from Settings as a new profile with its own identity, database, port and token; it opens with the same Papers, the conversation, Pages owned here, the retained original and the picture; the first installation\'s token is refused; writing works' }); persist();

  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('#profile-choice').selectOption(home.id);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, home.id, { timeout: 60000 });
  await runtimeReady();
  assert.deepEqual(await library(), homeBefore, 'the profile that was already there is unchanged');
  await quit();
  assert.deepEqual(one.load().profiles.map(p => p.id), [desk.id], 'installation one still has its one profile');
  assert.equal(fs.readFileSync(path.join(deskDir, 'local-credentials.json'), 'utf8'), credentialsOne);
  assert.equal(verifyExport(exportDir).files, verified.files, 'the carried folder is unchanged');
  report.checks.push({ name: 'Nothing else moved: the profile already on installation two, installation one and the carried folder are unchanged' }); persist();
  report.status = 'passed'; delete report.mainStderr; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = (report.mainStderr || []).slice(-30);
  try { report.importStatus = await page.evaluate(() => document.querySelector('#profile-import-status')?.textContent); } catch {}
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch {}
  throw error;
}
