// Real private Barkpark; the relay injects transport failures, never paper data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url);
const { listAllPapers, cliListAllPapers } = require('../main/barkpark');
const { createStore } = require('../main/store');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-complete-library-'));
const out = path.resolve(appDir, '../docs/visual/catalog/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const config = { server, token, dataset: 'production' }, frames = [], results = [], errors = [];
let app, page, video, fault = false, delayNext = false, release, entered;
const queries = [];
const relay = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/v1/data/query/')) {
      queries.push(req.url);
      if (delayNext) { delayNext = false; entered?.(); await new Promise(r => { release = r; }); }
      if (fault) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Private test connection temporarily unavailable' } })); return; }
    }
    const body = []; for await (const part of req) body.push(part);
    const upstream = await fetch(server + req.url, { method: req.method, headers: { authorization: req.headers.authorization || '', 'content-type': req.headers['content-type'] || 'application/json' }, ...(body.length ? { body: Buffer.concat(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(30000) });
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) { res.writeHead(502); res.end('Private relay failed'); }
});
await new Promise(r => relay.listen(0, '127.0.0.1', r));
const relayServer = `http://127.0.0.1:${relay.address().port}`;
async function request(method, route, body, status = 200) {
  const r = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data.result || data;
}
const id = i => `catalog-${String(i).padStart(3, '0')}`;
const create = i => request('POST', `/v1/plugins/bulldocs/papers/${id(i)}/create`, { slug: id(i), title: `Library note ${String(i).padStart(3, '0')}`, style: 'article', description: 'A private complete-library fixture proving discovery, human organization and recovery beyond the first catalog page.', tags: [{ tag: 'catalogproof', strength: 95, rationale: 'Private complete catalog discovery proof' }], blocks: [{ id: 'text', type: 'paragraph', content: [{ type: 'text', value: `Native library note ${i}, kept in its human-selected place.` }] }] }, 201);
const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png') }); frames.push(name + '.png'); };
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); video = page.video(); page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded); await page.setViewportSize({ width: 1400, height: 900 });
};
const close = async name => { await app.close(); app = null; if (video) fs.renameSync(await video.path(), path.join(out, name + '.webm')); };
const configure = async (extra = {}) => page.evaluate(async settings => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: settings }); }, { enabled: true, writes: true, viaCli: false, server: relayServer, token, dataset: 'production', ...extra });
const refresh = () => page.evaluate(() => window.__barkdown.refreshLibrary());
const assertHumanState = async () => {
  const s = await page.evaluate(() => window.__barkdown.state);
  assert.deepEqual(s.pages.roots, ['bp:catalog-000']); assert.deepEqual(s.pages.children, { 'bp:catalog-000': ['bp:catalog-001'] });
  assert.equal(s.chats.main.draft, 'A human draft stays here.'); assert.equal(s.chats.side.draft, 'Independent side draft.'); assert.equal(s.chats.side.parent, 'main');
};
try {
  assert.equal((await listAllPapers(config)).length, 0);
  await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'catalogproof', _type: 'tag', title: 'Catalog proof' } }, { publish: { id: 'catalogproof', type: 'tag' } }] });
  for (let start = 0; start < 200; start += 4) await Promise.all(Array.from({ length: 4 }, (_, j) => create(start + j)));
  const exact = await listAllPapers(config); assert.equal(exact.length, 200); assert.equal(new Set(exact.map(d => d.id)).size, 200);
  const cliExact = await cliListAllPapers(config); assert.deepEqual(cliExact, exact);
  results.push('Real HTTP and explicitly scoped CLI discover an exactly full final page of 200 papers');
  await create(200); const full = await listAllPapers(config); assert.equal(full.length, 201); assert.deepEqual(await cliListAllPapers(config), full);
  results.push('Real HTTP and CLI discover 201 unique papers across two pages');
  const chat = (chatId, extra = {}) => ({ id: chatId, title: chatId === 'main' ? 'Library room' : 'Side reflection', messages: [], events: [], apiHistory: [], tabs: [], active: null, draft: chatId === 'main' ? 'A human draft stays here.' : 'Independent side draft.', draftImages: [], closedTargets: [], runId: null, folder: null, ...extra });
  createStore(path.join(userData, 'barkdown')).writeJson('workspace.json', { version: 1, chats: { main: chat('main'), side: chat('side', { side: true, parent: 'main', parentTitle: 'Library room' }) }, order: ['main', 'side'], current: 'main', mode: 'chat', favorites: [], pages: { layoutVersion: 2, seeded: true, roots: ['bp:catalog-000'], children: { 'bp:catalog-000': ['bp:catalog-001'] }, expanded: { 'bp:catalog-000': true }, archiveOpen: false, archiveFilter: '', cloudArchiveOpen: true, cloudArchiveFilter: '200' } });
  await launch(); await configure(); await refresh(); await assertHumanState();
  assert.equal(await page.evaluate(() => window.__barkdown.state.barkparkDocs.length), 201);
  await page.locator('#bw-cloud-archive [data-open="bp:catalog-200"]').waitFor(); await shot('01-complete-library');
  await page.locator('#bw-cloud-archive [data-open="bp:catalog-200"]').click();
  await page.waitForFunction(() => document.querySelector('bp-paper-canvas')?._editor && document.querySelector('.bw-paper-pane #meta')?.textContent.includes('Editing live'));
  assert.match(await page.locator('bp-paper-canvas').innerText(), /Native library note 200/); await shot('02-paper-beyond-first-page');
  fault = true; await refresh(); assert.equal(await page.evaluate(() => window.__barkdown.state.barkparkDocs.length), 201);
  await page.locator('.bw-library-notice').waitFor(); assert.match(await page.locator('.bw-library-notice').innerText(), /last known/); await assertHumanState(); await shot('03-failed-refresh-preserves-library');
  fault = false; await page.locator('#bw-library-retry').click(); await page.waitForFunction(() => !window.__barkdown.state.barkparkLibraryError); await shot('04-retry-recovers');
  const reached = new Promise(r => { entered = r; }); delayNext = true;
  const older = refresh(); await reached;
  await configure({ server }); await refresh(); release(); await older;
  assert.equal(await page.evaluate(() => window.__barkdown.state.barkparkDocs.length), 201); await assertHumanState();
  results.push('Superseded relay request cannot overwrite a new connection refresh; human Pages and both drafts remain intact');
  fault = true; await configure(); await refresh();
  assert.equal(await page.evaluate(() => window.__barkdown.state.barkparkDocs.length), 0);
  assert.match(await page.locator('.bw-library-notice').innerText(), /unavailable/); await assertHumanState(); await shot('05-new-connection-does-not-borrow');
  fault = false; await page.locator('#bw-library-retry').click(); await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length === 201);
  await page.setViewportSize({ width: 820, height: 900 }); fault = true; await refresh();
  await page.locator('#bw-library-retry').focus(); assert.ok(await page.locator('#bw-library-retry').isVisible()); await shot('06-narrow-retry');
  fault = false; await page.locator('#bw-library-retry').press('Enter'); await page.waitForFunction(() => !window.__barkdown.state.barkparkLibraryError);
  await page.setViewportSize({ width: 760, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('07-narrow-paper');
  await page.waitForFunction(async () => (await window.barkdown.state.load())?.chats.main.draft === 'A human draft stays here.');
  await close('discovery-and-recovery'); await launch(); await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length === 201);
  await assertHumanState(); await shot('08-restarted-library');
  assert.deepEqual(await listAllPapers(config), full); assert.deepEqual(errors, []);
  results.push('Failures preserve only the same connection catalog; retry/narrow layout/restart preserve the actual library and human organization');
  console.log('PASS native complete catalog: exact200,201,two adapters,failure/retry,connection ordering,Pages/drafts/restart');
} catch (error) {
  if (page && app) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  fs.writeFileSync(path.join(out, 'failure.txt'), error.stack); throw error;
} finally {
  release?.(); if (app) await close('restart-or-failure'); await new Promise(r => relay.close(r));
  const artifacts = Object.fromEntries(fs.readdirSync(out).map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), barkdownCommit: process.env.BARKDOWN_SHOTS_HOST_COMMIT, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, isolatedRuntime: true, count: 201, results, frames, artifacts, queryCount: queries.length, limits: ['Disposable legacy-mode app with real private Paper storage; no authority switch', 'Relay injects transport failures and delay; never replaces server paper data', 'Offset discovery is not an atomic snapshot; bounded to10000papers/32MiB/60seconds after routing', 'Provider list tool remains limited; source origin classification is the next cycle'] }, null, 2) + '\n');
  console.log('Catalog evidence:', out);
}
