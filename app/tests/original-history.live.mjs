// Real Electron/main/profile/backup reader. Only the OS folder-picker result is
// supplied by the fixture; there is no fake history response or provider turn.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { cleanSource } from './helpers/capture-lifecycle.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createDocuments } = require('../main/documents');
const { createStore } = require('../main/store');
const { createAgentEdits } = require('../main/agent-edits');
const { prepareMigration } = require('../main/migration-preflight');
const capture = process.env.BARKDOWN_HISTORY_CAPTURE === '1';
const root = path.resolve('..'), source = capture ? cleanSource(root, { allowEvidence: true }).commit : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(capture ? '../docs/visual/original-history/runs' : 'test-results/original-history', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-original-history-native-'));
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const a = registry.createProfile({ name: 'Writing desk' }), b = registry.createProfile({ name: 'Other notebook' });
const body = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const original = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What we kept' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Keep the context behind a note, not just its latest words. ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'The original revisions stay here as a quiet reference.' }] },
  { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A later edit should never erase how we arrived here.' }] }] },
  { type: 'bulletList', content: ['The first draft and its wording', 'An agent suggestion still waiting for review', 'The decision that changed after discussion'].map(text => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })) },
] };
async function seed(profile, label) {
  const store = createStore(registry.storeFor(profile.id).storeDir), documents = createDocuments(store); documents.loadAll({ seed: false });
  const note = documents.create({ title: 'Field notes — a quieter workspace', content: original });
  const edits = createAgentEdits({ store, documents });
  await edits.apply({ id: note.id, baseRev: 1, mode: 'append', markdown: `An acknowledged ${label} agent addition.`, summary: 'Keep the original context' });
  documents.addProposal(note.id, { baseRev: 2, mode: 'replace', markdown: 'A suggestion that was never accepted.', summary: 'A different opening', status: 'pending' });
  documents.save({ id: note.id, baseRev: 2, content: original, actor: 'you', summary: 'Keep the calmer wording' });
  const undone = documents.create({ title: 'An earlier decision', markdown: 'The wording we returned to.' });
  const receipt = await edits.apply({ id: undone.id, baseRev: 1, mode: 'append', markdown: 'A change we reconsidered.', summary: 'Temporary change' });
  await edits.undo(undone.id, receipt.id);
  const unknown = documents.create({ title: 'A preserved old widget', markdown: 'Historical material.' });
  const value = store.readJson('documents/' + unknown.id + '.json');
  value.content = { type: 'doc', content: [{ type: 'retiredWidget', attrs: { literal: '<script>window.untrustedHistory=true</script>', mode: 'historical-only' }, content: [{ type: 'text', text: 'Original widget wording.' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Original link', marks: [{ type: 'link', attrs: { href: 'https://history-content.invalid/never-fetch' } }] }] }, { type: 'image', attrs: { src: 'https://history-content.invalid/never-load.png', alt: 'Retained image reference' } }] };
  value.content.content.push({ type: 'constructor', content: [{ type: 'text', text: 'Literal inherited name.', marks: [{ type: '__proto__' }, null] }] });
  store.writeJson('documents/' + unknown.id + '.json', value);
  store.writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: false, viaCli: false, writes: false } });
  const backupDir = path.join(userData, 'backups', label);
  prepareMigration({ profileId: profile.id, sourceDir: store.dir(), destinationDir: backupDir, quiesced: true });
  return { store, note, undone, unknown, backupDir };
}
const fa = await seed(a, 'Writing-desk-originals'), fb = await seed(b, 'Other-notebook-originals');
const digestTree = dir => {
  const value = {};
  const visit = (p, prefix = '') => { for (const name of fs.readdirSync(p)) { const file = path.join(p, name), key = prefix + name; if (fs.statSync(file).isDirectory()) visit(file, key + '/'); else value[key] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } };
  visit(dir); return value;
};
const before = { backups: digestTree(path.join(userData, 'backups')), documentsA: digestTree(fa.store.filePath('documents')), receiptsA: digestTree(fa.store.filePath('agent-edits')) };
const report = { source, capture, platform: process.platform, scope: 'Actual native UI and main IPC on disposable profiles; OS folder-picker result supplied; no model calls or Paper writes.', screenshots: [], checks: [], userData };
let app, page, video, timer, recording = false;
const errors = [], external = [];
const persist = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
async function shot(name) { const file = name + '.png'; await page.screenshot({ path: path.join(out, file) }); report.screenshots.push(file); persist(); }
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1200, height: 850 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); video = page.video();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://history-content.invalid/**', route => { external.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.evaluate(async () => { await window.barkdown.settings.set({ theme: 'dark' }); document.documentElement.dataset.theme = 'dark'; });
  if (capture) {
    let frame = 0;
    timer = setInterval(async () => { if (recording || page.isClosed()) return; recording = true; try { await page.screenshot({ path: path.join(out, `motion-${String(report.session || 0)}-${String(frame++).padStart(4, '0')}.png`) }); } catch {} finally { recording = false; } }, 200);
  }
}
async function stop() { clearInterval(timer); while (recording) await new Promise(r => setTimeout(r, 25)); if (app) { await app.close(); (report.videos ||= []).push(path.basename(await video.path())); app = null; } }
async function open() { await page.keyboard.press('Control+,'); await page.locator('[data-act="original-history"]').click(); await page.locator('.bw-original-history').waitFor(); }
async function choose(dir) { await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, dir); await page.locator('[data-choose]').click(); }
async function note(id) { await page.locator(`[data-document="${id}"]`).click(); await page.locator('.bw-history-title p').filter({ hasText: id }).waitFor(); }
async function geometry() { return page.evaluate(() => { const n = document.querySelector('.bw-original-history'), r = n.getBoundingClientRect(); return { width: innerWidth, left: r.left, right: r.right, bottom: r.bottom, height: innerHeight, overflow: n.scrollWidth > n.clientWidth + 1, editable: n.querySelectorAll('[contenteditable=true],textarea').length }; }); }
try {
  await launch(); await open(); await page.getByText('Your originals, kept close').waitFor(); await shot('01-empty');
  await choose(fb.backupDir); await page.getByRole('status').filter({ hasText: 'That backup was not opened' }).waitFor();
  assert.equal(await page.locator('[data-document]').count(), 0); report.checks.push('Foreign profile backup refused before registration');
  await choose(fa.backupDir); await note(fa.note.id); await page.locator('.bw-history-title h3').filter({ hasText: fa.note.title }).waitFor();
  await page.getByLabel('Find an original note').fill('quieter'); assert.equal(await page.locator('[data-document]').count(), 1);
  await page.getByLabel('Find an original note').fill(''); assert.equal(await page.locator('[data-document]').count(), 3);
  assert.match(await page.locator('.bw-history-content').innerText(), /What we kept/); await shot('02-document');
  await page.locator('[data-kind="revisions"]').click(); await page.getByLabel('Select original record').selectOption('2');
  assert.match(await page.locator('.bw-history-record-note').innerText(), /Revision 1/); await shot('03-revision');
  await page.locator('[data-kind="proposals"]').click(); assert.match(await page.locator('.bw-history-content').innerText(), /never accepted/); await shot('04-pending-proposal');
  await page.locator('[data-kind="receipt"]').click(); assert.match(await page.locator('.bw-history-record').innerText(), /later revision exists/); await shot('05-stale-receipt');
  report.checks.push('Original revision content, pending proposal and stale receipt are readable');
  await note(fa.undone.id); await page.locator('[data-kind="receipt"]').click(); assert.match(await page.locator('.bw-history-record').innerText(), /Undone edit/); await shot('06-undone-receipt');
  await note(fa.unknown.id); await page.locator('.bw-history-raw summary').click();
  await page.waitForFunction(() => document.querySelector('.bw-history-raw pre')?.textContent.includes('historical-only'));
  assert.match(await page.locator('.bw-history-raw pre').innerText(), /historical-only/);
  assert.match(await page.locator('.bw-history-content').innerText(), /Literal inherited name/);
  assert.equal(await page.locator('.bw-history-content').getByText('constructor', { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => Boolean(window.untrustedHistory)), false);
  assert.equal(await page.locator('.bw-original-history a[href],.bw-original-history img[src],.bw-original-history script').count(), 0);
  assert.deepEqual(external, []); await shot('07-unsupported-original'); report.checks.push('Unsupported data and inert external references preserved without execution/network');
  await note(fa.note.id); await page.setViewportSize({ width: 620, height: 760 });
  const narrow = await geometry(); assert(!narrow.overflow && narrow.left >= 0 && narrow.right <= narrow.width && narrow.bottom <= narrow.height && narrow.editable === 0); report.narrow = narrow; await shot('08-narrow');
  const forbidden = await page.locator('.bw-original-history button').allTextContents(); assert(!forbidden.some(s => /^(Restore|Undo|Keep|Accept|Discard|Delete|Save)$/.test(s.trim())));
  await page.locator('[data-close]').focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await page.locator('[data-refresh]').evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await page.locator('[data-close]').evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.bw-original-history').count(), 0); report.checks.push('Read-only controls, narrow geometry and Escape verified');
  await stop(); report.session = 1; await launch(); await open(); await note(fa.note.id); await page.locator('.bw-history-title h3').filter({ hasText: fa.note.title }).waitFor(); await shot('09-restart'); report.checks.push('Registered source and exact original content survive restart');
  const owner = await page.evaluate(() => window.barkdown.originalHistory.list());
  await page.keyboard.press('Escape');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, b.id); await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.id);
  const refusal = await page.evaluate(async args => { try { await window.barkdown.originalHistory.read(args); return null; } catch (e) { return e.message; } }, { sourceId: owner[0].id, documentId: fa.note.id });
  assert.match(refusal, /does not belong/); await open(); await page.getByText('Your originals, kept close').waitFor(); await shot('10-other-profile'); report.checks.push('Other profile cannot read the same-slug original or reuse its source ID');
  await page.keyboard.press('Escape'); await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, a.id); await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, a.id);
  const damaged = path.join(fa.backupDir, 'source/documents', fa.note.id + '.json'), saved = fs.readFileSync(damaged);
  fs.appendFileSync(damaged, ' '); await open(); await page.getByText('Original backup unavailable', { exact: true }).waitFor(); await shot('11-changed-backup');
  fs.writeFileSync(damaged, saved); await page.locator('[data-refresh]').click(); await page.locator('.bw-history-title').waitFor(); report.checks.push('Changed backup refuses and explicit refresh reads the restored original');
  assert.deepEqual(digestTree(path.join(userData, 'backups')), before.backups);
  assert.deepEqual(digestTree(fa.store.filePath('documents')), before.documentsA); assert.deepEqual(digestTree(fa.store.filePath('agent-edits')), before.receiptsA);
  assert.deepEqual(errors, []); report.checks.push('Original documents, receipts and backup bytes unchanged'); report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; if (page && !page.isClosed()) await shot('failure').catch(() => {}); throw error; }
finally { await stop(); report.errors = errors; report.externalRequests = external; if (capture && cleanSource(root, { allowEvidence: true }).commit !== source) throw Error('Source changed during capture'); persist(); console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks })); }
