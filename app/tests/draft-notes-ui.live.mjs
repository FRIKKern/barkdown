import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit private runtime source required');
const appDir = path.resolve('.'), root = path.resolve('..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-note-native-'));
const out = path.join(root, 'docs/visual/paper-notes/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const manifest = { host: git(['rev-parse', 'HEAD']), upstream: git(['rev-parse', 'HEAD'], source), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', frames: [], results: [], errors: [], failure: null };
let app, page, video;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData],
    recordVideo: { dir: out, size: { width: 1400, height: 900 } }, timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow({ timeout: 180000 }); video = page.video(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => manifest.errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
};
const close = async name => { await app.close(); app = null; if (video) fs.renameSync(await video.path(), path.join(out, name + '.webm')); };
const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png') }); manifest.frames.push(name + '.png'); };
const configure = () => page.evaluate(async source => {
  window.__barkdown.state.settings = await window.barkdown.settings.set({ provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } });
}, source);
const refresh = () => page.evaluate(async () => { await window.__barkdown.refreshLibrary(); return window.__barkdown.state.barkparkDocs; });
const save = () => page.evaluate(async () => { const s = window.__barkdown.state; await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, favorites: s.favorites, pages: s.pages, current: s.current, mode: s.mode, directTab: s.directTab }); });
const open = async paper => {
  await page.evaluate(p => window.__barkdown.openDirect(p.id, 'barkpark', p.paperOwner), paper);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
};
const saved = () => page.waitForFunction(() => {
  const pane = document.querySelector('.bw-paper-pane:not([hidden])');
  return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges();
});
const select = async id => {
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(id); await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.profileId === id && window.__barkdown?.state.loaded, id, { timeout: 180000 });
};
try {
  await launch(); await configure();
  const profileA = await page.evaluate(() => window.__barkdown.state.profileId);
  const profileB = (await page.evaluate(() => window.barkdown.profiles.create('Other notebook'))).id;
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  let paper = await page.evaluate(async () => {
    const s = window.__barkdown.state, tab = s.chats[s.current].tabs.find(t => t.id === s.chats[s.current].active);
    return window.barkdown.barkpark.get(tab.path.at(-1), undefined, tab.paperOwner);
  });
  const requestId = paper.id.slice('drafts.bd-note-'.length);
  assert.equal(paper.id, 'drafts.bd-note-' + requestId); assert.equal(paper.rev, 0);
  const ownerA = paper.paperOwner;
  await refresh(); await open(paper); await shot('01-empty-paper');
  const title = 'A note to come back to', text = 'Saffron notebooks keep the exact words I wrote.';
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click();
  await page.keyboard.type(title); await saved();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last().waitFor({ state: 'visible' });
  // Enter moves into the original body instead of splitting the locked title.
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await shot('02a-enter-body');
  await page.keyboard.type(text); await saved(); await shot('02-human-title-and-body');
  paper = await page.evaluate(p => window.barkdown.barkpark.get(p.id, undefined, p.paperOwner), paper);
  assert.equal(paper.title, title); assert(paper.markdown.includes(text));
  assert((await refresh()).some(d => d.id === paper.id && d.title === title));
  const hits = await page.evaluate(() => window.barkdown.barkpark.search('Saffron'));
  assert(hits.some(d => d.id === paper.id && d.paperOwner === ownerA));
  // Ctrl+K belongs to link editing while the Paper canvas has focus.
  await page.locator('#bw-new-page').focus();
  await page.keyboard.press('Control+k'); await page.locator('#bw-palette-input').fill('Saffron');
  await page.getByRole('option').filter({ hasText: title }).first().waitFor(); await shot('02b-body-search');
  await page.getByRole('option').filter({ hasText: title }).first().click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await open(paper);
  await save();
  await select(profileB); await configure();
  assert(!(await refresh()).some(d => d.id === paper.id));
  const twin = await page.evaluate(id => window.barkdown.barkpark.createNote(id), requestId);
  assert.equal(twin.id, paper.id); assert.notEqual(twin.paperOwner, ownerA);
  const refused = await page.evaluate(async p => { try { await window.barkdown.barkpark.get(p.id, undefined, p.paperOwner); return false; } catch { return true; } }, paper);
  assert(refused); await refresh(); await open(twin); await shot('03-other-profile-empty-twin');
  assert(!(await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText()).includes(text));
  await select(profileA); await refresh(); await open(paper); await save(); await close('create-edit-and-profile-switch');
  await launch(); assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), profileA);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor({ timeout: 60000 });
  assert((await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText()).includes(text));
  const reopened = await page.evaluate(() => window.__barkdown.state.chats.direct.tabs.find(t => t.id === window.__barkdown.state.directTab));
  assert.equal(reopened.path.at(-1), paper.id); assert.equal(reopened.paperOwner, ownerA);
  await shot('04-restarted-original-note'); await page.setViewportSize({ width: 820, height: 900 }); await shot('05-narrow-reopened');
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark'); await shot('06-dark-reopened');
  assert.deepEqual(manifest.errors, []);
  manifest.results.push('New Page creates empty note and real Paper typing saves title/body; library and quick-open body search preserve exact row',
    'Two real profiles with identical draft IDs remain isolated; foreign saved owner refused', 'Restart restores original profile, exact draft tab and acknowledged human text');
  console.log('PASS', manifest.results);
} catch (error) {
  manifest.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  if (app) await close('restarted');
  manifest.artifacts = Object.fromEntries(fs.readdirSync(out).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(out, name))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Native note evidence:', out, 'Retained data:', userData);
}
