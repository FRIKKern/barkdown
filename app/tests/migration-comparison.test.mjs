import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { prepareMigration } = require('../main/migration-preflight');
const { stageMigration } = require('../main/migration-staging');
const { createMigrationComparison } = require('../main/migration-comparison');
const { PNG } = require('pngjs');

async function fixture(t, count = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-comparison-'));
  const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Comparison' });
  const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
  t.after(() => goals.close());
  const sourceDir = registry.storeFor(profile.id).storeDir, destinationDir = path.join(root, 'backup');
  const source = { id: 'note', title: 'Legacy orchard', rev: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep the complete orchard observations.' }] }] } };
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'documents/note.json'), JSON.stringify(source));
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null,
    pages: { layoutVersion: 2, seeded: true, roots: ['note'], children: {}, expanded: {} }, favorites: [] }));
  const state = { frozen: true, owned: true, onRead: null, png: PNG.sync.write(new PNG({ width: 2, height: 2 })) };
  const preparation = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async () => ({ profileId: profile.id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => state.frozen, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  await preparation.prepare(profile.id);
  const options = { profileId: profile.id, sourceDir, destinationDir, quiesced: true,
    metadata: { note: { description: 'Reviewed orchard migration', tags: [{ tag: 'orchard', strength: 95, rationale: 'Owned observation fixture' }] } } };
  options.expectedSourceHash = prepareMigration(options).sourceHash;
  const rows = new Map(), calls = [];
  for (let n = 0; n < count; n++) { const id = 'existing-' + String(n).padStart(3, '0'); rows.set(id, { _id: id, _type: 'paper', _draft: false, _rev: 'r-' + id, rev: 1, title: id, blocks: [] }); }
  rows.set('drafts.existing-000', { ...rows.get('existing-000'), _id: 'drafts.existing-000', _draft: true, _rev: 'draft-divergent', title: 'Divergent draft' });
  rows.set('drafts.only', { _id: 'drafts.only', _type: 'paper', _draft: true, _rev: 'draft-only', rev: 0, title: 'Unpublished thought', blocks: [] });
  const server = http.createServer(async (req, res) => {
    const send = (status, result) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result })); };
    const url = new URL(req.url, 'http://fixture'); calls.push([req.method, req.url]);
    try {
      if (req.method === 'GET') {
        if (state.onRead) await state.onRead(url);
        if (url.pathname === '/media/files/existing.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(state.png); return; }
        if (url.pathname.includes('/query/')) {
          const perspective = url.searchParams.get('perspective'), limit = Number(url.searchParams.get('limit')), offset = Number(url.searchParams.get('offset'));
          const list = [...rows.values()].filter(row => perspective === 'published' ? !row._draft : row._draft || !rows.has('drafts.' + row._id)).sort((a, b) => a._id.localeCompare(b._id, 'en'));
          const documents = list.slice(offset, offset + limit), hasMore = offset + limit < list.length;
          send(200, { documents, perspective, limit, offset, count: documents.length, total: list.length, hasMore, nextOffset: hasMore ? offset + limit : null }); return;
        }
        const id = decodeURIComponent(url.pathname.split('/').at(-1));
        if (rows.has(id)) send(200, rows.get(id)); else { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'not_found' } })); }
        return;
      }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks)), id = body.slug;
      assert.match(url.pathname, /\/create$/);
      rows.set(id, { ...body, _id: id, _type: 'paper', _draft: false, _rev: 'created', rev: 1 });
      send(201, { slug: id, rev: 1 });
    } catch (error) { send(500, { error: String(error) }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const target = { profileId: profile.id, runtimeId: 'owned-test', server: `http://127.0.0.1:${server.address().port}`, dataset: 'production', token: 'fixture-only', assertOwned: async () => state.owned };
  const adapter = createMigrationComparison({ preparation });
  async function capture() { const value = await adapter.captureBaseline(options, target); options.expectedBaselineHash = value.baselineHash; return value; }
  async function stage() { await capture(); return stageMigration(options, target); }
  return { root, options, target, rows, calls, state, preparation, adapter, capture, stage,
    compare: () => adapter.compare(options, target), targetId: () => JSON.parse(fs.readFileSync(path.join(destinationDir, 'manifest.json'))).documents[0].targetId };
}
function files(root) {
  return Object.fromEntries(fs.readdirSync(root, { recursive: true }).filter(name => fs.statSync(path.join(root, name)).isFile()).map(name => [name, fs.readFileSync(path.join(root, name)).toString('base64')]));
}

test('complete mixed library exceeds one page, preserves variants and never repairs or mutates', async t => {
  const f = await fixture(t, 201); await f.stage();
  const backup = files(f.options.destinationDir), source = files(f.options.sourceDir), calls = f.calls.length;
  const result = await f.compare();
  assert.equal(result.status, 'compared'); assert.equal(result.documents, 204); assert.equal(result.preserved, 203);
  assert.equal(result.activationAllowed, false); assert.equal(result.authority, 'legacy');
  assert.deepEqual(await f.compare(), result);
  assert.deepEqual(files(f.options.destinationDir), backup); assert.deepEqual(files(f.options.sourceDir), source);
  assert.ok(f.calls.slice(calls).every(([method]) => method === 'GET'));
  assert.ok(f.calls.some(([, url]) => url.includes('offset=199')));
});

for (const [label, change, error] of [
  ['missing existing Paper', f => f.rows.delete('existing-001'), /pre-existing/],
  ['changed existing draft', f => { f.rows.get('drafts.only').title = 'Later typing'; }, /pre-existing/],
  ['extra Paper', f => f.rows.set('extra', { ...f.rows.get('existing-001'), _id: 'extra' }), /Unexpected/],
  ['staged draft twin', f => f.rows.set('drafts.' + f.targetId(), { ...f.rows.get(f.targetId()), _id: 'drafts.' + f.targetId(), _draft: true }), /Unexpected/],
  ['changed staged revision', f => { f.rows.get(f.targetId())._rev = 'new'; }, /revisions/],
  ['missing receipt', f => fs.unlinkSync(path.join(f.options.destinationDir, 'staging', f.targetId() + '.receipt.json')), /missing receipts/],
  ['changed baseline', f => { const p = path.join(f.options.destinationDir, 'comparison-baseline.json'); const v = JSON.parse(fs.readFileSync(p)); v.rows[0].title = 'Forged'; fs.writeFileSync(p, JSON.stringify(v)); }, /pinned baseline/],
  ['invalid foreground hold', f => { f.state.frozen = false; }, /frozen/],
  ['lost runtime owner', f => { f.state.owned = false; }, /ownership changed/],
]) test(label + ' refuses without repair', async t => {
  const f = await fixture(t); await f.stage(); change(f);
  const before = files(f.options.destinationDir), calls = f.calls.length;
  await assert.rejects(f.compare(), error);
  assert.deepEqual(files(f.options.destinationDir), before); assert.ok(f.calls.slice(calls).every(([method]) => method === 'GET'));
});

test('cannot manufacture a baseline from completed staging', async t => {
  const f = await fixture(t); await stageMigration(f.options, f.target);
  await assert.rejects(f.capture(), /before staging/);
  assert.equal(fs.existsSync(path.join(f.options.destinationDir, 'comparison-baseline.json')), false);
});

test('comparison holds coordinator ownership and detects change during pending reads', async t => {
  const f = await fixture(t); await f.stage(); let checked = false;
  f.state.onRead = async () => {
    if (checked) return; checked = true;
    await assert.rejects(f.preparation.abort(f.options.profileId), /in progress/);
    await assert.rejects(f.compare(), /in progress/);
    f.state.owned = false;
  };
  await assert.rejects(f.compare(), /ownership changed/);
  f.state.onRead = null; f.state.owned = true;
  assert.equal((await f.compare()).status, 'compared');
  await f.preparation.abort(f.options.profileId);
  await assert.rejects(f.compare(), /Prepare/);
});

test('pre-existing PNG bytes compare; later image change is refused', async t => {
  const f = await fixture(t);
  f.rows.get('drafts.only').blocks = [{ type: 'image', src: f.target.server + '/media/files/existing.png' }];
  await f.stage(); assert.equal((await f.compare()).media, 1);
  const image = new PNG({ width: 2, height: 2 }); image.data.fill(255); f.state.png = PNG.sync.write(image);
  await assert.rejects(f.compare(), /media changed/);
});

test('external media refuses before producing a baseline', async t => {
  const f = await fixture(t); f.rows.get('drafts.only').blocks = [{ type: 'image', src: 'https://example.invalid/private.png' }];
  await assert.rejects(f.capture(), /captured-origin/);
  assert.equal(fs.existsSync(path.join(f.options.destinationDir, 'comparison-baseline.json')), false);
});

for (const [label, change, pattern] of [
  ['source changed', f => fs.appendFileSync(path.join(f.options.sourceDir, 'documents/note.json'), ' '), /Source differs/],
  ['backup changed', f => fs.appendFileSync(path.join(f.options.destinationDir, 'source/documents/note.json'), ' '), /size.type differs/],
  ['workspace ambiguity', f => { const p = path.join(f.options.sourceDir, 'workspace.json'); const ws = JSON.parse(fs.readFileSync(p)); ws.pages.roots = []; fs.writeFileSync(p, JSON.stringify(ws)); }, /Source differs/],
]) test(label + ' refuses before runtime access', async t => {
  const f = await fixture(t); await f.stage(); change(f); const count = f.calls.length;
  await assert.rejects(f.compare(), pattern); assert.equal(f.calls.length, count);
});

test('a changed final page cannot receive a comparison result', async t => {
  const f = await fixture(t); await f.stage(); let queries = 0;
  f.state.onRead = async url => {
    if (url.pathname.includes('/query/') && ++queries === 3) f.rows.get('drafts.only').title = 'Changed between traversals';
  };
  await assert.rejects(f.compare(), /Library changed/);
});

test('journal deletion during reads refuses without recreating it', async t => {
  const f = await fixture(t); await f.stage(); let changed = false;
  const file = path.join(f.options.destinationDir, 'staging', f.targetId() + '.receipt.json');
  f.state.onRead = async () => { if (!changed) { changed = true; fs.unlinkSync(file); } };
  await assert.rejects(f.compare(), /missing receipts/);
  assert.equal(fs.existsSync(file), false);
});
