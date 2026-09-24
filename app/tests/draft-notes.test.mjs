import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDraftNotes } = require('../main/draft-notes');
const { createStore } = require('../main/store');

function fixture() {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-note-intent-')));
  const requestId = crypto.randomUUID(), profileId = crypto.randomUUID(), paperOwner = 'a'.repeat(64);
  const requests = [], rows = new Map(); let drop = false, offline = false, refusal = null, owned = true;
  const options = { store, profileId, paperOwner, config: { enabled: true, writes: true, server: 'http://fixture', dataset: 'test' },
    assertOwned: () => { if (!owned) throw Error('Profile lease lost'); },
    request: async (_config, method, route, body) => {
      requests.push({ method, route, body });
      if (offline) throw Error('Offline');
      if (method === 'POST') {
        if (refusal) throw Object.assign(Error('Refused'), { status: refusal });
        const d = body.mutations[0].create, id = 'drafts.' + d._id;
        assert(!rows.has(id), 'Must never replay create');
        rows.set(id, { ...d, _id: id, _draft: true, _publishedId: d._id, _rev: 'opaque-revision',
          blocks: d.blocks.length ? d.blocks : [{ id: 'tpl-title', role: 'title', locked: true, type: 'heading', level: 1, text: d.title }, { id: 'tpl-body', type: 'paragraph', content: [] }] });
        if (drop) throw Error('Response lost after commit');
        return { results: [{ document: rows.get(id) }] };
      }
      const id = decodeURIComponent(route.split('?')[0].split('/').at(-1));
      if (!rows.has(id)) throw Object.assign(Error('Missing'), { status: 404 });
      return { result: structuredClone(rows.get(id)) };
    } };
  return { store, options, requestId, rows, requests, service: () => createDraftNotes(options),
    drop: () => { drop = true; }, offline: value => { offline = value; }, refuse: status => { refusal = status; }, loseLease: () => { owned = false; } };
}
test('ordinary empty create keeps exact row, distinct revisions and durable read-only replay', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.service().create(f.requestId), f.service().create(f.requestId)]);
  assert.equal(a.id, 'drafts.bd-note-' + f.requestId); assert.deepEqual(a, b);
  assert.equal(a.rev, 0); assert.equal(a.revision, 'opaque-revision'); assert.equal(a.title, 'Untitled');
  f.rows.get(a.id).title = 'Later human title';
  assert.equal((await f.service().create(f.requestId)).title, 'Later human title');
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
  assert(f.requests.filter(r => r.method === 'GET').every(r => r.route.endsWith('?perspective=drafts')));
});
test('lost response reconciles once without duplicate create', async () => {
  const f = fixture(); f.drop();
  const result = await f.service().create(f.requestId);
  assert.equal(result.id, 'drafts.bd-note-' + f.requestId);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
});

test('agent initial content is one create with a locked title; replay cannot change intent or later human content', async () => {
  const f = fixture(), input = { title: 'An agent note', markdown: 'Original **words**.' };
  f.drop();
  const paper = await f.service().create(f.requestId, input);
  assert.equal(paper.title, input.title); assert.equal(paper.blocks[0].locked, true);
  assert.match(paper.markdown, /Original \*\*words\*\*/);
  await assert.rejects(f.service().create(f.requestId, { ...input, title: 'Changed' }), /different content/);
  f.rows.get(paper.id).blocks[1].content = [{ type: 'text', value: 'Later human words' }];
  assert.match((await f.service().create(f.requestId, input)).markdown, /Later human words/);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
});

test('a cooperating process holding the request lease prevents any network mutation', async () => {
  const f = fixture(), file = f.store.filePath(`paper-creation/${f.requestId}.json.lock`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lease = require('../main/file-lease').acquireFileLease(file, { completeOwner: true });
  try { await assert.rejects(f.service().create(f.requestId), /already running/); assert.equal(f.requests.length, 0); }
  finally { lease.release(); }
  assert.equal((await f.service().create(f.requestId)).rev, 0);
});

test('replacement and Undo retain locked title; append Undo retains other locked slots', () => {
  const { replaceBody, restoreBlocks } = require('../main/paper-edit-ops');
  const title = { id: 'title', type: 'heading', role: 'title', locked: true, text: 'Keep title' };
  const body = { id: 'body', type: 'paragraph', content: [{ type: 'text', value: 'Original' }] };
  const added = { ...body, id: 'new' }, featured = { id: 'featured', role: 'featured', locked: true, type: 'image' };
  assert.deepEqual(replaceBody([title, body], [added]), [{ op: 'remove-block', id: 'body' }, { op: 'append-block', block: added }]);
  assert.deepEqual(restoreBlocks([title, added], [title, body]), [{ op: 'remove-block', id: 'new' }, { op: 'append-block', block: body }]);
  assert.deepEqual(restoreBlocks([title, featured, body, added], [title, featured, body]), [{ op: 'remove-block', id: 'new' }]);
  assert.throws(() => replaceBody([title, featured, body], [added]), /additional locked/);
  assert.throws(() => restoreBlocks([{ ...title, text: 'Human title' }, added], [title, body]), /title changed/);
});

test('owned tool access refuses a foreign runtime profile and disabled creation without legacy fallback', async () => {
  const f = fixture(), { createPaperTools } = require('../main/paper-tools');
  const connection = { ...f.options.config, token: 'fixture-only', managedProfileId: f.options.profileId };
  const foreign = createPaperTools({ store: f.store, connection, profileId: crypto.randomUUID() });
  await assert.rejects(foreign.create({ title: 'Refused', markdown: '' }), /another profile/);
  const disabled = createPaperTools({ store: f.store, connection: { ...connection, writes: false }, profileId: f.options.profileId });
  await assert.rejects(disabled.create({ title: 'Refused', markdown: '' }), /Enable local Paper writes/);
  assert.equal(f.store.list('documents', '.json').length, 0);
  assert.equal(f.store.list('paper-creation', '.json').length, 0);
});

test('MCP creation activity follows the acknowledged exact Paper ID, never a title lookup', () => {
  const { activityForTool } = require('../main/providers/runs');
  const profileId = crypto.randomUUID(), id = 'drafts.bd-note-' + crypto.randomUUID();
  const run = { context: {}, scope: { profileId, connection: { managedProfileId: profileId }, documents: {} } };
  const event = activityForTool(run, 'mcp__barkdown__create_document', { title: 'Same title' }, `Created document bp:${id} ("Same title") at rev 0.`);
  assert.equal(event.target.id, id); assert.equal(event.target.source, 'barkpark');
  assert.equal(activityForTool(run, 'mcp__barkdown__create_document', { title: 'Same title' }, 'Creation unconfirmed'), null);
});
test('uncertain missing row stays read-only on retry after restart', async () => {
  const f = fixture(); f.offline(true);
  await assert.rejects(f.service().create(f.requestId), { code: 'draft_creation_uncertain' });
  f.offline(false);
  await assert.rejects(f.service().create(f.requestId), /Missing/);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
});
test('published twins, wrong row, lost nonce and invalid revisions are refused', async () => {
  for (const mutate of [d => { d._id = d._publishedId; }, d => { d._publishedId = 'other'; }, d => { d._draft = false; },
    d => { d.rev = 'opaque'; }, d => { d.blocks = null; }, d => { d.barkdownCreation = 'other'; }]) {
    const f = fixture(), a = await f.service().create(f.requestId); mutate(f.rows.get(a.id));
    await assert.rejects(f.service().create(f.requestId), { code: 'draft_identity' });
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
  }
});
test('corrupt journal and owner change cannot create or open a replacement', async () => {
  const f = fixture(); await f.service().create(f.requestId);
  await assert.rejects(createDraftNotes({ ...f.options, paperOwner: 'b'.repeat(64) }).create(f.requestId), /another or unknown owner/);
  const file = f.store.filePath(`paper-creation/${f.requestId}.json`);
  fs.writeFileSync(file, '{broken');
  await assert.rejects(f.service().create(f.requestId), /unreadable/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
});
test('refused creation, read-only mode and lost lease do not write again', async () => {
  const f = fixture(); f.refuse(409);
  await assert.rejects(f.service().create(f.requestId), /Refused/);
  await assert.rejects(f.service().create(f.requestId), /refused this creation/);
  assert.equal(f.requests.length, 1);
  const off = fixture(); off.options.config.writes = false;
  await assert.rejects(off.service().create(off.requestId), { code: 'writes_disabled' });
  assert.equal(off.requests.length, 0);
  off.loseLease(); await assert.rejects(off.service().create(off.requestId), /lease lost/);
});
test('draft discovery uses complete pagination and rejects malformed identities and envelopes', async () => {
  const f = fixture();
  const rows = Array.from({ length: 201 }, (_, n) => ({ _id: `drafts.note-${n}`, _publishedId: `note-${n}`, _draft: true, _type: 'paper', _rev: 'opaque', title: `Note ${n}` }));
  const offsets = [];
  const request = async (_c, _method, route) => {
    const u = new URL('http://fixture' + route), offset = Number(u.searchParams.get('offset')), limit = Number(u.searchParams.get('limit'));
    assert.equal(u.searchParams.get('perspective'), 'drafts'); offsets.push(offset);
    const documents = rows.slice(offset, offset + limit), hasMore = offset + limit < rows.length;
    return { documents, perspective: 'drafts', offset, limit, count: documents.length, total: rows.length, hasMore, ...(hasMore ? { nextOffset: offset + limit } : {}) };
  };
  assert.equal((await createDraftNotes({ ...f.options, request }).list()).length, 201);
  assert.deepEqual(offsets, [0, 199]);
  rows[0]._publishedId = 'wrong';
  await assert.rejects(createDraftNotes({ ...f.options, request }).list(), { code: 'draft_identity' });
  await assert.rejects(createDraftNotes({ ...f.options, request: async () => ({ documents: [] }) }).list(), { code: 'catalog_incomplete' });
  await assert.rejects(createDraftNotes({ ...f.options, request: async () => ({}) }).search('text'), { code: 'draft_identity' });
});
test('draft ops require an exact row and integer Paper revision, and reject invalid acknowledgements', async () => {
  const f = fixture(), calls = [], ops = [{ op: 'patch-block', id: 'tpl-title', patch: { text: 'Title' } }];
  const service = createDraftNotes({ ...f.options, request: async (...args) => { calls.push(args); return { rev: 1 }; } });
  for (const [id, rev] of [['bare-id', 0], ['drafts.good', 'opaque'], ['drafts.good', null], ['drafts.good', -1]]) {
    await assert.rejects(service.apply(id, ops, rev), { code: 'draft_identity' });
  }
  assert.equal(calls.length, 0);
  assert.equal((await service.apply('drafts.good', ops, 0)).rev, 1);
  assert.equal(calls[0][2], '/v1/plugins/bulldocs/papers/drafts.good/ops');
  assert.deepEqual(calls[0][3], { ifRev: 0, ops });
  await assert.rejects(createDraftNotes({ ...f.options, request: async () => ({ rev: '1' }) }).apply('drafts.good', ops, 0), /acknowledge/);
});
