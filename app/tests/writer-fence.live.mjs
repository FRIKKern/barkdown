// The real Paper canvas and main IPC against an app-owned disposable runtime.
// Quiescence is invoked by the test controller; no migration switch is exposed.
import assert from 'node:assert/strict';
import { LINE_END } from './helpers/keys.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { cleanSource } from './helpers/capture-lifecycle.mjs';
const require = createRequire(import.meta.url);
const { createDocuments } = require('../main/documents');
const { createStore } = require('../main/store');
const { createProfileRegistry } = require('../main/profile-registry');
const { controller } = require('../main/writer-admission');
const { prepareMigration } = require('../main/migration-preflight');
const source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit private runtime source required');
const capture = process.env.BARKDOWN_WRITER_CAPTURE === '1', root = path.resolve('..');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const host = capture ? cleanSource(root, { allowEvidence: true }).commit : git(['rev-parse', 'HEAD']);
const out = path.resolve(capture ? '../docs/visual/writer-fence/runs' : 'test-results/writer-fence', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-native-'));
const report = { host, upstream: git(['rev-parse', 'HEAD'], source), capture, userData, frames: [], geometry: [], videos: [], checks: [], errors: [], passed: false };
let app, page, video;
const persist = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
async function viewport(width, height) {
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
  await page.setViewportSize({ width, height });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function shot(name) {
  const contentSize = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize());
  assert.deepEqual(contentSize, [page.viewportSize().width, page.viewportSize().height]);
  await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png');
  report.geometry.push({ frame: name + '.png', contentSize, viewport: page.viewportSize() });
  persist(); if (capture) await page.waitForTimeout(700);
}
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', '--user-data=' + userData], timeout: 180000,
    recordVideo: { dir: out, size: { width: 1280, height: 860 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow({ timeout: 180000 }); video = page.video(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  await viewport(1280, 860);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
}
async function close() { if (!app) return; await app.close(); app = null; report.videos.push(path.basename(await video.path())); persist(); }
const saved = () => page.waitForFunction(() => {
  const pane = document.querySelector('.bw-paper-pane:not([hidden])');
  return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges();
});
async function saveWorkspace() {
  await page.evaluate(async () => { const s = window.__barkdown.state; await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, favorites: s.favorites, pages: s.pages, current: s.current, mode: s.mode, directTab: s.directTab }); });
}
try {
  await launch();
  await page.evaluate(async source => {
    document.documentElement.dataset.theme = 'dark';
    window.__barkdown.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } });
    document.documentElement.dataset.theme = 'dark';
  }, source);
  const profileId = await page.evaluate(() => window.__barkdown.state.profileId);
  const registry = createProfileRegistry(path.join(userData, 'profile-data'));
  const store = createStore(registry.storeFor(profileId).storeDir, { create: false });
  // The legacy note is written into the store from here (the app no longer writes legacy notes, R4); the app reads it.
  const legacy = createDocuments(store).create({ title: 'Preserved source', markdown: 'The retained source remains readable.' });
  await page.evaluate(() => window.barkdown.docs.list());
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click();
  await page.keyboard.type('A dependable writing desk'); await saved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('These words were acknowledged before preparation.'); await saved();
  const paper = await page.evaluate(() => {
    const s = window.__barkdown.state, tab = s.chats[s.current].tabs.find(t => t.id === s.chats[s.current].active);
    return window.barkdown.barkpark.get(tab.path.at(-1), undefined, tab.paperOwner);
  });
  await saveWorkspace(); await shot('01-acknowledged-paper');
  const control = controller(store), token = control.capture(), barrier = control.quiesce(token);
  assert.equal(control.assertQuiescent(barrier).quiescent, true);
  const sourceBytes = fs.readFileSync(store.filePath(`documents/${legacy.id}.json`));
  const workspaceBytes = fs.readFileSync(store.filePath('workspace.json'));
  const backupDir = path.join(userData, 'verified-originals');
  prepareMigration({ profileId, sourceDir: store.dir(), destinationDir: backupDir, quiesced: true });
  const refusal = await page.evaluate(async ({ paper, legacy }) => {
    const result = {};
    for (const [name, action] of Object.entries({
      create: () => window.barkdown.barkpark.createNote(crypto.randomUUID()),
      paper: () => window.barkdown.barkpark.applyOps(paper.id, [{ op: 'append-block', block: { id: 'forbidden', type: 'paragraph', content: [{ type: 'text', value: 'Forbidden' }] } }], paper.rev, paper.binding),
      attachment: () => window.barkdown.attachments.save({ name: 'forbidden.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AA==' }),
      workspace: () => window.barkdown.state.save({ version: 1, chats: {}, order: [] }),
    })) { try { await action(); result[name] = 'unexpected-success'; } catch (error) { result[name] = error.message; } }
    return result;
  }, { paper, legacy });
  report.refusal = refusal;
  // Since the preparation foreground gate (C085) a held profile refuses in main before the writer fence is
  // reached; the fence itself still answers writer_stale for anything that gets past the gate.
  for (const message of Object.values(refusal)) assert.match(message, /\[(writer_stale|BARKDOWN_PROFILE_PREPARING)\]/);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last().click(); await page.keyboard.press(LINE_END);
  await page.keyboard.type(' This unsaved thought stays in the open buffer.');
  await page.getByText(/This profile is preparing|earlier library generation/).first().waitFor();
  assert.match(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText(), /unsaved thought stays/);
  const remote = await page.evaluate(p => window.barkdown.barkpark.get(p.id, p.binding, p.paperOwner), paper);
  assert.equal(remote.rev, paper.rev); assert.equal(remote.markdown, paper.markdown);
  assert.deepEqual(fs.readFileSync(store.filePath(`documents/${legacy.id}.json`)), sourceBytes);
  assert.deepEqual(fs.readFileSync(store.filePath('workspace.json')), workspaceBytes);
  await shot('02-save-refused-buffer-retained');
  await viewport(820, 860);
  await shot('03-narrow-refusal');
  report.checks.push('Real Paper title/body acknowledged before quiescence; stale native note/create/ops/attachment/workspace requests refused', 'Typing remains visible in the unsaved buffer; server revision/body and original source/workspace bytes unchanged');
  // Deliberately retain the test buffer in the report, not as a claimed product
  // draft restore. A2 must preserve/resolve human drafts before offering cutover.
  report.unsavedBuffer = await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText();
  await close(); await launch();
  // Since the preparation gate (C085) a held profile keeps the whole window paused after a restart, and
  // registering a backup as an original-history source is a write the gate refuses: the notice is the
  // visible proof that writing stays closed, and the verified backup is read with the app's own reader.
  await page.getByText(/Editing is paused for this profile while preparation is resolved/).first().waitFor();
  const { readRetainedDocument } = require('../main/migration-evidence');
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  const evidence = readRetainedDocument({ profileId, backupDir, expectedSourceHash: manifest.sourceHash, documentId: legacy.id });
  assert.ok(JSON.stringify(evidence).includes('The retained source remains readable.'), 'the verified original reads while the profile is paused');
  await shot('04-restarted-paused-gate');
  const newAttempt = await page.evaluate(async () => { try { await window.barkdown.docs.create({ title: 'Forbidden after restart' }); return null; } catch (error) { return error.message; } });
  assert.match(newAttempt, /read-only|Paper/, 'legacy creation is refused (retired), whatever the fence says');
  assert.equal(controller(store).assertQuiescent(barrier).quiescent, true);
  assert.deepEqual(report.errors, []);
  report.checks.push('Restart keeps the profile paused at the preparation gate while the verified original reads with the app\'s reader'); report.passed = true;
} catch (error) { report.error = error.stack; if (page && !page.isClosed()) await shot('failure').catch(() => {}); throw error; }
finally {
  await close();
  if (capture && cleanSource(root, { allowEvidence: true }).commit !== host) throw Error('Source changed during capture');
  report.artifacts = Object.fromEntries(fs.readdirSync(out).filter(f => f !== 'manifest.json').map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  persist(); console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks }));
}
