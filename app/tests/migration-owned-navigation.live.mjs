// Disposable managed-library preview copy. Never selects migration authority.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { inventoryProfile } = require('../main/migration-preflight');
const { stageMigration } = require('../main/migration-staging');
const { projectOwnedWorkspace } = require('../main/migration-workspace');
const source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit private runtime source required');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), root = path.dirname(appDir);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-owned-navigation-'));
const userData = path.join(temporary, 'app');
const out = path.join(root, 'docs/visual/migration/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const report = { source: git(['rev-parse', 'HEAD']), upstream: git(['rev-parse', 'HEAD'], source), sourceDirty: Boolean(git(['status', '--porcelain', '--', 'app'])), status: 'running', frames: [], checks: [], rendererErrors: [], limits: ['Disposable preview copy only; no migration authority switch or rollback proof.'] };
let app, page, video, videoStarted;
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); (report.frameTimes ||= []).push({ name, elapsedMs: Date.now() - videoStarted }); persist(); };
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' }, timeout: 180000 });
  page = await app.firstWindow({ timeout: 180000 }); page.on('pageerror', error => { report.rendererErrors.push(error.message); persist(); }); video = page.video(); videoStarted = Date.now(); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
}
async function close(name) { await app.close(); app = null; if (video) fs.renameSync(await video.path(), path.join(out, name + '.webm')); }
async function arrived(id, text) {
  await page.waitForFunction(({ id, text }) => {
    const pane = document.querySelector('.bw-paper-pane:not([hidden])'), canvas = pane?.querySelector('bp-paper-canvas');
    return pane?.querySelector('#path')?.textContent.includes(id) && canvas?._editor && canvas.recoverySnapshot().blocks?.[0]?.content?.[0]?.value === text;
  }, { id, text });
}
try {
  await launch(); console.log('Managed app launched');
  const profileId = (await page.evaluate(() => window.barkdown.profiles.status())).profileId;
  await page.evaluate(async source => { window.__barkdown.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', apiKey: 'fixture-unused', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } }); await window.__barkdown.refreshLibrary(); }, source);
  // Private credentials stay in this disposable process and never enter evidence.
  const connection = await app.evaluate(async ({ app, safeStorage }) => {
    const r = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js'), store = r('./store');
    const descriptor = store.readJson('runtime.json'), encrypted = store.readJson('local-credentials.json').token;
    const token = encrypted.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(encrypted.slice(4), 'base64')) : Buffer.from(encrypted.slice(6), 'base64').toString();
    const config = { server: 'http://127.0.0.1:' + descriptor.port, token, dataset: 'production', viaCli: false };
    r('./paper-evidence-owner').createPaperEvidenceOwner(store).identify(config, { create: true });
    return { ...config, storeDir: store.dir(), key: store.readJson('agent-edits/paper-owner-key.json') };
  });
  const sourceDir = path.join(temporary, profileId), store = createStore(sourceDir);
  store.writeJson('agent-edits/paper-owner-key.json', connection.key);
  const texts = { alpha: 'The writing room keeps its original path.', beta: 'The nested note stays where its human placed it.', loose: 'This unplaced note belongs in local Archive.' };
  for (const [id, text] of Object.entries(texts)) store.writeJson('documents/' + id + '.json', { id, title: id === 'loose' ? 'Unplaced field note' : id === 'alpha' ? 'Writing room' : 'Nested observation', rev: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
  const foreign = 'b'.repeat(64);
  const sameSlug = 'local-' + crypto.createHash('sha256').update(JSON.stringify([profileId, 'alpha'])).digest('hex').slice(0, 32);
  const workspace = { version: 1, profileId, chats: { main: { id: 'main', title: 'Migration rehearsal', messages: [], events: [], apiHistory: [], following: true, folder: null, draftImages: [], tabs: [{ id: 'path-main', type: 'doc', source: 'local', path: ['alpha', 'beta'], title: 'Nested observation' }], active: 'path-main', closedTargets: [], draft: 'Keep my draft.', runId: null } }, order: ['main'], current: 'main', mode: 'chat', favorites: [{ id: 'local-fav', label: 'Writing room', target: { kind: 'doc', id: 'alpha', source: 'local' }, chatId: 'main' }, { id: 'foreign-fav', label: 'Other library', target: { kind: 'doc', id: sameSlug, source: 'barkpark', paperOwner: foreign }, chatId: 'main' }], pages: { layoutVersion: 2, seeded: true, roots: ['alpha'], children: { alpha: ['beta'] }, expanded: { alpha: true }, archived: {}, labels: { alpha: 'Writing room', beta: 'Nested observation', loose: 'Unplaced field note' }, archiveOpen: true, archiveFilter: '', cloudArchiveOpen: true, cloudArchiveFilter: '' } };
  store.writeJson('workspace.json', workspace);
  const options = { profileId, sourceDir, destinationDir: path.join(temporary, 'backup'), quiesced: true, metadata: Object.fromEntries(Object.keys(texts).map(id => [id, { description: 'Private owned navigation preservation rehearsal with exact local Archive identity and restart checks.', tags: [{ tag: 'navproof', strength: 95, rationale: 'Disposable migration navigation fixture' }] }])) };
  const target = { profileId, runtimeId: 'native-' + profileId, ...connection, assertOwned: async binding => {
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus());
    const descriptorMatches = await app.evaluate(({ app }, binding) => { const r = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js'); const d = r('./store').readJson('runtime.json'); return d.profileId === binding.profileId && 'http://127.0.0.1:' + d.port === binding.server; }, binding);
    return status.phase === 'ready' && status.profileId === binding.profileId && descriptorMatches;
  } };
  const response = await fetch(connection.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + connection.token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [{ create: { _id: 'navproof', _type: 'tag', title: 'Navigation proof' } }, { publish: { id: 'navproof', type: 'tag' } }] }) });
  assert(response.ok);
  console.log('Managed runtime ready; checking projection');
  const original = inventoryProfile(options);
  const projection = await projectOwnedWorkspace(options, target); assert.equal(projection.status, 'preview');
  await stageMigration(options, target); console.log('Staging complete');
  const ids = Object.fromEntries(projection.documentMap.map(d => [d.id, d.targetId]));
  await close('setup'); console.log('Setup closed');
  // The actual managed profile receives only a disposable projected copy after shutdown.
  createStore(connection.storeDir, { create: false }).writeJson('workspace.json', projection.workspace);
  const checkOrganization = async () => {
    const state = await page.evaluate(() => window.__barkdown.state);
    assert.deepEqual(state.pages.roots, projection.workspace.pages.roots);
    assert.deepEqual(state.pages.children, projection.workspace.pages.children);
    assert.deepEqual(state.favorites, projection.workspace.favorites);
    assert.equal(state.chats.main.draft, 'Keep my draft.');
    const local = await page.locator('#bw-archive .bw-page-title').allTextContents();
    assert(local.includes('Unplaced field note')); assert(!local.includes('Nested observation'));
    assert(!(await page.locator('#bw-cloud-archive .bw-page-title').allTextContents()).includes('Unplaced field note'));
  };
  await launch(); await arrived(ids.beta, texts.beta); await checkOrganization(); await shot('01-owned-path-and-archive');
  await page.locator('#bw-archive [data-open="bp:v1:' + projection.paperOwner + ':' + ids.loose + '"]').click();
  await arrived(ids.loose, texts.loose); await shot('02-unplaced-local-note');
  await page.locator('#bw-favorites').click(); await page.locator('#bw-fav-menu [data-open="local-fav"]').click();
  await arrived(ids.alpha, texts.alpha); await shot('03-owned-favorite');
  await page.locator('#bw-favorites').click(); await page.locator('#bw-fav-menu [data-open="foreign-fav"]').click();
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden])')?.textContent.includes('connection'));
  assert.equal(await page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas').count(), 0); await shot('04-foreign-owner-refused');
  await page.locator('#bw-pages [data-open="bp:v1:' + projection.paperOwner + ':' + ids.beta + '"]').click(); await arrived(ids.beta, texts.beta);
  await page.setViewportSize({ width: 1000, height: 850 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('05-narrow');
  await page.waitForFunction(async id => { const saved = await window.barkdown.state.load(); return JSON.stringify(saved).includes(id); }, ids.beta);
  await close('navigation'); await launch(); await arrived(ids.beta, texts.beta); await checkOrganization(); await shot('06-restarted');
  for (const file of original.files) {
    assert.deepEqual(fs.readFileSync(path.join(sourceDir, file.path)), file.data);
    assert.deepEqual(fs.readFileSync(path.join(options.destinationDir, 'source', file.path)), file.data);
  }
  assert.deepEqual(report.rendererErrors, []);
  report.checks.push('Owned path, nested Pages, local Archive, favorite, foreign-owner refusal, narrow layout, restart and byte-identical source/backup'); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; if (page && !page.isClosed()) await shot('failure').catch(() => {}); persist(); throw error; }
finally { if (app) await close('final'); persist(); console.log('Owned navigation evidence:', out); }
