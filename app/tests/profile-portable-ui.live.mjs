// Export and import from the app (C085): real Electron in profiles mode with managed runtimes.
// A profile with legacy notes and a conversation is switched to Paper, written on, exported
// from Settings into a folder chosen through the (stubbed) native picker, and imported from
// Settings as a new profile. The imported profile is opened: its Pages, its conversation, a
// retained original, a Paper with its words, and an assistant edit with Undo. The exporting
// profile is then opened again and is unchanged. No terminal is involved after launch.
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
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
const { verifyExport } = require('../main/profile-export');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-portable-ui');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-portable-ui-')));
const chosen = path.join(userData, 'chosen-by-the-person'); fs.mkdirSync(chosen);
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One machine, one run, a small library. Both profiles live in one registry: a second machine, another OS and another Postgres major version are not exercised. The native folder picker is stubbed in the main process; everything after it is the app. The assistant is scripted model turns through the real API SDK, not a live model.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
const documents = createDocuments(createStore(dir, { create: false }));
const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id,
  chats: { main: { id: 'main', title: 'Writing room', messages: [{ id: 'm1', role: 'user', text: 'Which notes travel with me?', at: '2026-09-29T12:00:00Z' }, { id: 'm2', role: 'assistant', text: 'Every note in this library travels, and so does this conversation.', at: '2026-09-29T12:00:05Z' }], events: [], apiHistory: [], tabs: [], draft: 'An unsent thought.' } },
  order: ['main'], current: 'main', pages: { layoutVersion: 2, seeded: true, roots: [orchard.id], children: { [orchard.id]: [soil.id] }, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: soil.id, source: 'local' } }] }));
registry.selectProfile(profile.id);

let agentTarget = null;
const transport = await createToolFixture((body, index) => {
  const result = body.messages.at(-1).content?.find?.(b => b.type === 'tool_result');
  if (index === 0) return { name: 'read_document', input: { id: 'bp:' + agentTarget, format: 'structured' } };
  if (index === 1) { assert.ok(result && !result.is_error, JSON.stringify(result)); return { name: 'edit_document', input: { id: 'bp:' + agentTarget, mode: 'append', markdown: 'One assistant addition on the imported profile.', summary: 'Add one thought' } }; }
  if (index === 2) { assert.ok(result && !result.is_error, JSON.stringify(result)); return { text: 'Added one thought. Undo is available.' }; }
  throw Error('Unexpected model turn ' + index);
});
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
  await app.context().addInitScript(() => { window.__toasts = []; new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches?.('.bw-toast, .bw-toast *')) window.__toasts.push(n.textContent); }).observe(document.documentElement, { childList: true, subtree: true }); });
  // The window opens after the profile's runtime has started; the first boot of a new library takes about 30 seconds.
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  page.on('pageerror', error => (report.pageErrors ||= []).push(error.message));
  app.process().stderr?.on('data', chunk => (report.mainStderr ||= []).push(String(chunk).slice(0, 400)));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => {
  const started = Date.now();
  for (;;) {
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(error => ({ phase: 'pending', error: error.message }));
    if (status.phase === 'ready') return status;
    if (status.phase === 'failed') throw new Error('Profile runtime failed: ' + status.error);
    if (Date.now() - started > 300000) throw new Error('Profile runtime not ready after 5 minutes: ' + JSON.stringify(status));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const openSettings = async () => { await page.evaluate(() => document.querySelector('#bw-settings').click()); await page.locator('#profile-export').scrollIntoViewIfNeeded(); };
const pick = folder => app.evaluate(({ dialog }, chosenFolder) => { dialog.showOpenDialog = async (_window, options) => { (globalThis.__picked ||= []).push(options.title); return { canceled: false, filePaths: [chosenFolder] }; }; }, folder);
const dismissCompleted = async text => {
  const notice = page.locator('.bw-preparation-notice', { hasText: text });
  await notice.waitFor({ timeout: 30000 });
  assert.equal(await notice.locator('[data-restart]').isHidden(), true, 'no restart demanded on a fresh host');
  await notice.locator('[data-dismiss]').click();
  await page.waitForFunction(() => !document.querySelector('.bw-preparation-notice'));
};
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds; owned runtimes may be orphaned')), 90000))]); };
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const library = async () => (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => ({ id: p.id, title: p.title })).sort((x, y) => x.id.localeCompare(y.id));
try {
  // The library the person has: switched to Paper, with one note written there.
  await launch(); await runtimeReady();
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('.bw-settings-nav [data-pane="barkpark"]').click();
  await page.locator('[data-act="switch-paper"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#bp-switch-status')?.textContent === 'Legacy notes, not switched');
  await page.locator('[data-act="switch-paper"]').click();
  await page.locator('.bw-ask [data-ok]').click();
  await page.waitForFunction(() => window.__barkdown?.state.loaded && window.__barkdown.state.authority === 'paper', null, { timeout: 150000 });
  await page.locator('.bw-preparation-notice', { hasText: 'The library switch completed' }).waitFor({ timeout: 30000 });
  await quit(); await launch(); await runtimeReady();
  await dismissCompleted('The library switch completed');
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Harbour ledger'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Cobalt lanterns mark the quay where the words must arrive.'); await paperSaved();
  // A note with a picture, uploaded to this profile's runtime.
  const pictured = await page.evaluate(async dataUrl => {
    const note = await window.barkdown.barkpark.createNote(crypto.randomUUID());
    const media = await window.barkdown.barkpark.uploadMedia({ binding: note.binding, name: 'lantern.png', mime: 'image/png', dataUrl });
    const paper = await window.barkdown.barkpark.get(note.id, undefined, note.paperOwner);
    await window.barkdown.barkpark.applyOps(note.id, [{ op: 'append-block', block: { id: 'lantern', type: 'image', src: media.src, alt: 'A cobalt lantern' } }], paper.rev, note.binding);
    return { id: note.id, src: media.src };
  }, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  assert.match(pictured.src, /^http:\/\/127\.0\.0\.1:\d+\/media\//);
  const before = await library();
  assert.equal(before.length, 5, JSON.stringify(before)); // two switched notes, one written on Paper, one with a picture, the runtime's welcome Paper
  const harbour = before.find(p => p.title === 'Harbour ledger');
  report.checks.push({ name: 'A library to carry: two notes switched to Paper, one written on Paper, the welcome Paper, one conversation', papers: before.length }); persist();

  // Export from Settings.
  await pick(chosen);
  await openSettings();
  await shot('01-settings-export-and-import');
  await page.locator('#profile-export').click();
  const exported = page.locator('.bw-preparation-notice', { hasText: 'The export completed' });
  await exported.waitFor({ timeout: 180000 });
  assert.equal(await exported.locator('[data-restart]').isVisible(), true, 'Restart Barkdown is offered');
  assert.match(await exported.locator('p').textContent(), /5 Papers, [1-9]\d* media files? and \d+ profile files are in .*Barkdown export - Writing desk - /);
  await shot('02-export-completed-restart-offered');
  const folders = fs.readdirSync(chosen);
  assert.equal(folders.length, 1); assert.match(folders[0], /^Barkdown export - Writing desk - \d{4}-\d\d-\d\d \d{4}$/);
  const exportDir = path.join(chosen, folders[0]);
  const verified = verifyExport(exportDir);
  assert.deepEqual(verified.manifest.counts, { papers: 3, drafts: 2 }, 'three published Papers and the two notes written in the app, which are drafts'); assert.equal(verified.manifest.upstream, upstream); assert.equal(verified.manifest.profile.id, profile.id);
  for (const name of fs.readdirSync(exportDir, { recursive: true })) assert.doesNotMatch(String(name), /local-credentials|paper-owner-key/);
  assert.deepEqual(await app.evaluate(() => globalThis.__picked), ['Choose where the profile export goes']);
  // The restart is a quit and a launch here: a relaunched process would not belong to this rehearsal.
  await quit(); await launch(); await runtimeReady();
  await dismissCompleted('The export completed');
  assert.equal((await page.evaluate(() => window.barkdown.preparation.status())).readOnly, false);
  assert.deepEqual(await library(), before, 'the exporting library is unchanged');
  report.checks.push({ name: 'Export from Settings: folder chosen in the picker, profile prepared, exported under the hold, the notice names the outcome and the folder and offers Restart, a fresh host edits again', folder: folders[0], files: verified.files, store: verified.manifest.store.length }); persist();

  // What must be refused, before anything is created: each is a copy of the export with one thing wrong.
  const refusals = [];
  const refuse = async (name, folder, expected) => {
    await pick(folder); await openSettings();
    await page.locator('#profile-import').click();
    await page.waitForFunction(() => document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 120000 });
    const said = await page.locator('#profile-import-status').textContent();
    assert.match(said, expected, name + ': ' + said);
    assert.equal(registry.load().profiles.length, 1, name + ': no profile was created');
    assert.deepEqual(fs.readdirSync(path.join(userData, 'profile-data', 'profiles')), [profile.id], name + ': no folder was created');
    refusals.push({ name, said });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#profile-import'));
  };
  const variant = (name, change) => { const folder = path.join(userData, 'variants', name); fs.cpSync(exportDir, folder, { recursive: true }); change(folder); return folder; };
  const aStoreFile = verified.manifest.store.find(entry => entry.path === 'profile/workspace.json').path;
  await refuse('tampered', variant('tampered', folder => fs.appendFileSync(path.join(folder, 'database.dump'), 'x')), /^Changed since the export: database\.dump$/);
  await refuse('truncated', variant('truncated', folder => fs.rmSync(path.join(folder, aStoreFile))), /^Missing from the export: profile\/workspace\.json$/);
  await refuse('added to', variant('added', folder => fs.writeFileSync(path.join(folder, 'profile', 'planted.json'), '{}')), /^Files the manifest does not list: profile\/planted\.json$/);
  await refuse('another version', variant('version', folder => { const file = path.join(folder, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8')); manifest.upstream = '0123456789abcdef0123456789abcdef01234567'; fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n'); }), /^This export was taken at Barkpark 012345678; this Barkdown runs [0-9a-f]{9}\. Import needs the same version or an earlier one that this one descends from$/);
  await refuse('not an export', chosen, /^This folder is not a Barkdown profile export/);
  report.checks.push({ name: 'Refused from Settings with the reason on screen, nothing created: a tampered, a truncated, an added-to and an other-version export, and a folder that is not an export', refusals }); persist();
  await shot('02b-refusal-on-screen');

  // Import from Settings, as a new profile. The folder was opened in a file manager first.
  fs.writeFileSync(path.join(exportDir, '.DS_Store'), 'left by a file manager');
  await pick(exportDir);
  await openSettings();
  await page.locator('#profile-import').click();
  await page.waitForFunction(() => /^Imported /.test(document.querySelector('#profile-import-status')?.textContent || '') || document.querySelector('#profile-import-status')?.classList.contains('err'), null, { timeout: 300000 });
  const said = await page.locator('#profile-import-status').textContent();
  assert.match(said, /^Imported “Writing desk \(imported\)” with 5 Papers\./, said);
  await page.locator('#profile-import-status').scrollIntoViewIfNeeded();
  await shot('03-import-completed');
  const profiles = registry.load().profiles;
  assert.equal(profiles.length, 2);
  const imported = profiles.find(p => p.id !== profile.id);
  assert.equal(await page.locator('#profile-choice').inputValue(), imported.id, 'the imported profile is chosen, ready to switch to');
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, imported.id, { timeout: 60000 });
  await runtimeReady();
  report.checks.push({ name: 'Import from Settings: export folder chosen in the picker (opened in a file manager first), a new profile with its own database, chosen in the profile list, opened with Switch', profile: imported.name }); persist();

  // The imported profile, opened.
  const view = await page.evaluate(() => { const st = window.__barkdown.state; return { authority: st.authority, selection: st.selection, order: st.order, chat: st.chats.main && { title: st.chats.main.title, messages: st.chats.main.messages.map(m => m.text), draft: st.chats.main.draft }, roots: st.pages.roots, children: st.pages.children, favorites: st.favorites.map(f => f.target) }; });
  assert.equal(view.authority, 'paper');
  assert.deepEqual(view.chat, { title: 'Writing room', messages: ['Which notes travel with me?', 'Every note in this library travels, and so does this conversation.'], draft: 'An unsent thought.' });
  assert.deepEqual(await library(), before, 'the same Papers, by id and title');
  const docs = await page.evaluate(() => window.__barkdown.state.barkparkDocs.map(d => ({ id: d.id, owner: d.paperOwner })));
  const owner = docs[0].owner;
  assert.ok(owner && docs.every(d => d.owner === owner));
  assert.notEqual(owner, verified.manifest.navigation.owner, 'navigation belongs to the importing library');
  const keys = [...view.roots, ...Object.values(view.children).flat()].filter(k => String(k).startsWith('bp:v1:'));
  assert.ok(keys.length >= 2, JSON.stringify(view.roots)); for (const key of keys) assert.ok(key.startsWith(`bp:v1:${owner}:`), key);
  // Roots are on screen; the child page sits under its collapsed parent, as it did before the export.
  for (const title of ['Orchard fieldbook', 'Harbour ledger']) await page.locator(`[title="${title}"], :text-is("${title}")`).first().waitFor({ timeout: 30000 });
  await page.getByText('Every note in this library travels', { exact: false }).first().waitFor({ timeout: 30000 });
  await shot('04-imported-profile-pages-and-conversation');
  const retained = await page.evaluate(id => window.barkdown.docs.get(id), soil.id);
  assert.equal(retained.retained, true); assert.match(retained.markdown, /Measure soil moisture at dawn/);
  const original = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: harbour.id, paperOwner: owner });
  assert.match(original.markdown, /Cobalt lanterns mark the quay/);
  // The picture: its address was written with the exporting runtime's port. It must show here, served by this profile's runtime.
  const exporterOrigin = new URL(pictured.src).origin;
  const stored = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: pictured.id, paperOwner: owner });
  const image = stored.blocks.find(b => b.type === 'image');
  assert.ok(image, 'the picture block arrived');
  await assert.rejects(fetch(exporterOrigin + '/status.json', { signal: AbortSignal.timeout(3000) }), 'the exporting runtime does not run while this profile is open');
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: pictured.id, paperOwner: owner });
  await page.waitForFunction(() => { const img = document.querySelector('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img'); return img && img.complete && img.naturalWidth === 1; }, null, { timeout: 60000 });
  await shot('04b-imported-picture-shown');
  report.checks.push({ name: 'The picture of a note arrives and is shown in the imported profile, served by its own runtime', storedAddress: image.src.replace(/\d{4,5}/, 'PORT'), note: 'the stored address keeps the exporting port; the request is answered by the importing runtime' }); persist();
  report.checks.push({ name: 'The imported profile opened: Paper authority, the conversation with its unsent draft, Pages owned by the importing library, the same Papers, a retained original readable', owner: owner.slice(0, 8) }); persist();

  // The assistant on the imported profile, with Undo.
  agentTarget = harbour.id;
  await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ provider: 'api', apiKey: 'synthetic-fixture' }); });
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), { id: harbour.id, paperOwner: owner });
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Cobalt lanterns' }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !window.__barkdown.state.chats[window.__barkdown.state.current].runId);
  await page.locator('#bw-prompt').fill('Add one thought to the note.'); await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('One assistant addition on the imported profile.'), null, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('[data-agent-phase]'));
  await page.waitForFunction(() => !window.__barkdown.state.chats[window.__barkdown.state.current].runId, null, { timeout: 120000 });
  await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').waitFor();
  await shot('05-imported-profile-agent-edit');
  await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').click();
  await page.waitForFunction(() => !document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('One assistant addition on the imported profile.'), null, { timeout: 60000 });
  const undone = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: harbour.id, paperOwner: owner });
  assert.deepEqual(undone.blocks, original.blocks, 'Undo restores the blocks exactly');
  report.checks.push({ name: 'The assistant on the imported profile: reads and appends through the MCP server, Undo restores the blocks exactly', modelTurns: transport.requests.length }); persist();

  // A new profile made here starts with its managed runtime on, the one this installation last configured (R3).
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('#profile-name').fill('Fresh desk'); await page.locator('#profile-create').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#profile-choice option')].some(o => o.textContent === 'Fresh desk'));
  const fresh = registry.load().profiles.find(p => p.name === 'Fresh desk');
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, fresh.id, { timeout: 60000 });
  await runtimeReady();
  const freshSettings = await page.evaluate(() => window.barkdown.settings.get());
  assert.equal(freshSettings.barkpark?.local?.enabled, true, 'the new profile runs a managed runtime without being configured');
  assert.equal(await page.evaluate(() => window.barkdown.barkpark.localStatus()).then(s => s.phase), 'ready');
  report.checks.push({ name: 'A new profile starts with its managed runtime on: the runtime this installation last configured, no setup', profile: fresh.name }); persist();
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  // Back on the exporting profile: nothing moved.
  await page.evaluate(() => document.querySelector('#bw-settings').click());
  await page.locator('#profile-choice').selectOption(profile.id);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, profile.id, { timeout: 60000 });
  await runtimeReady();
  assert.deepEqual(await library(), before);
  const back = await page.evaluate(({ id }) => window.barkdown.barkpark.get(id, undefined, window.__barkdown.state.barkparkDocs.find(d => d.id === id)?.paperOwner), { id: harbour.id });
  assert.deepEqual(back.blocks, original.blocks, 'the exporting profile never saw the imported profile\'s edit');
  assert.equal(verifyExport(exportDir).files, verified.files, 'the export folder is unchanged by the import');
  // A completed outcome is said once: dismissed after the export, it did not return at later launches.
  assert.equal(await page.locator('.bw-preparation-notice').count(), 0);
  report.checks.push({ name: 'The exporting profile afterwards: same Papers, same words; the export folder verifies as written' }); persist();
  await quit();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
  await transport.close?.();
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error);
  try { report.toasts = await page.evaluate(() => window.__toasts); } catch {}
  try { report.failedAt = { preparation: await page.evaluate(() => window.barkdown.preparation.status()), exportStatus: await page.evaluate(() => document.querySelector('#profile-export-status')?.textContent), importStatus: await page.evaluate(() => document.querySelector('#profile-import-status')?.textContent) }; } catch (e) { report.failedAt = String(e); }
  persist();
  try { if (page && !page.isClosed()) await shot('99-failure'); } catch {}
  try { await quit(); } catch (quitError) { report.quitError = quitError.message; persist(); try { app?.process().kill('SIGKILL'); } catch {} }
  try { await transport.close?.(); } catch {}
  throw error;
}
