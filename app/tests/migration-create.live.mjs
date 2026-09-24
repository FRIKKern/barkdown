// Exercise the create-only contract against an owned disposable upstream runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const server = process.env.BARKDOWN_SHOTS_SERVER;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !process.env.BARKPARK_API_TOKEN) throw Error('Only an owned isolated runtime may run this test');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prefix = 'create-test-' + crypto.randomUUID().slice(0, 8);
const observations = [];
async function request(method, route, body, token = process.env.BARKPARK_API_TOKEN, origin = server) {
  const response = await fetch(origin + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  return { status: response.status, data: await response.json() };
}
const mutate = mutations => request('POST', '/v1/data/mutate/production', { mutations });
const envelope = response => response.data.result || response.data;
const get = async (id, perspective = 'published') => envelope(await request('GET', `/v1/data/doc/production/paper/${id}?perspective=${perspective}`));
const route = id => `/v1/plugins/bulldocs/papers/${id}/create`;
const create = payload => request('POST', route(payload.slug), payload);
function paper(slug, text) {
  return { slug, title: text, style: 'article', description: 'Private contract fixture: ' + text, tags: [{ tag: 'creation-contract', strength: 95, rationale: 'Disposable creation boundary integration proof' }], blocks: [{ id: 'heading', type: 'heading', level: 1, text }, { id: 'body', type: 'paragraph', content: [{ type: 'text', value: text + '. This note proves a creation boundary using an isolated database, with no access to the person’s existing library or working documents.' }] }] };
}
function stored(document) { return Object.fromEntries(['title', 'style', 'description', 'tags', 'blocks'].map(k => [k, document[k]])); }
function assertPaper(document, payload) { assert.deepEqual(stored(document), stored(payload)); }
const tag = await mutate([{ createOrReplace: { _type: 'tag', _id: 'creation-contract', title: 'Creation contract' } }, { publish: { type: 'tag', id: 'creation-contract' } }]);
assert.equal(tag.status, 200, JSON.stringify(tag));

const fresh = paper(prefix + '-fresh', 'Orchard harvesting receipts are stored once');
const born = await create(fresh);
assert.equal(born.status, 201, JSON.stringify(born));
const original = await get(fresh.slug);
assertPaper(original, fresh);
const refused = await create({ ...fresh, title: 'A different writer must never replace this note' });
assert.equal(refused.status, 409, JSON.stringify(refused));
assert.equal(refused.data.error.code, 'paper_exists');
assert.deepEqual(await get(fresh.slug), original);
observations.push({ boundary: 'published-collision', created: 201, refused: 409, completeDocumentUnchanged: true });

const draft = paper(prefix + '-draft', 'Workshop timber measurements remain in a draft');
assert.equal((await mutate([{ create: { _type: 'paper', _id: draft.slug, ...draft } }])).status, 200);
const draftBefore = await get(draft.slug, 'drafts');
const draftCollision = await create(draft);
assert.equal(draftCollision.status, 409, JSON.stringify(draftCollision));
assert.deepEqual(await get(draft.slug, 'drafts'), draftBefore);
assert.equal((await request('GET', `/v1/data/doc/production/paper/${draft.slug}?perspective=published`)).status, 404);
observations.push({ boundary: 'draft-collision', refused: 409, completeDraftUnchanged: true, publishedTwinAbsent: true });

for (let round = 0; round < 3; round++) {
  const slug = `${prefix}-race-${round}`;
  const topics = ['Maritime navigation bearings chart coastal tidal currents', 'Garden pollination experiments record seasonal insect observations', 'Astronomy telescope calibration tracks distant planetary orbits'];
  const inputs = Array.from({ length: 6 }, (_, i) => paper(slug, `${topics[round]} ${i}`));
  const replies = await Promise.all(inputs.map(create));
  assert.equal(replies.filter(r => r.status === 201).length, 1, JSON.stringify(replies));
  assert.equal(replies.filter(r => r.status === 409).length, 5, JSON.stringify(replies));
  const winner = replies.findIndex(r => r.status === 201);
  assertPaper(await get(slug), inputs[winner]);
  observations.push({ boundary: 'concurrent-create', round, statuses: replies.map(r => r.status), winnerContentRetained: true });
}

// Forward the write but destroy the client connection only after the upstream
// committed response arrived. The caller must recover without a create replay.
const lost = paper(prefix + '-lost', 'Alpine weather observations survive a disconnected receipt');
let committedStatus;
const proxy = http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const response = await request('POST', route(lost.slug), JSON.parse(Buffer.concat(chunks)));
    committedStatus = response.status;
  } finally { res.destroy(); }
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(request('POST', route(lost.slug), lost, process.env.BARKPARK_API_TOKEN, `http://127.0.0.1:${proxy.address().port}`));
  assert.equal(committedStatus, 201);
  assertPaper(await get(lost.slug), lost);
} finally { await new Promise(resolve => proxy.close(resolve)); }
observations.push({ boundary: 'lost-response', clientConnectionDestroyed: true, serverCommitted: 201, scopedReadbackMatches: true, createReplays: 0 });

const invalid = paper(prefix + '-invalid', 'Restricted inputs preserve the publishing policy');
assert.equal((await request('POST', route(invalid.slug), invalid, 'invalid-token')).status, 401);
assert.equal((await create({ ...invalid, slug: 'drafts.' + invalid.slug })).status, 400);
assert.equal((await create({ ...invalid, blocks: undefined, body_html: '<p>unsupported shape</p>' })).status, 400);
const wall = await create({ ...invalid, tags: undefined, description: undefined });
assert.equal(wall.status, 422, JSON.stringify(wall));
assert.equal((await request('GET', `/v1/data/doc/production/paper/${invalid.slug}`)).status, 404);
observations.push({ boundary: 'policy', unauthorized: 401, draftNamespace: 400, htmlOnly: 400, publishWall: 422, absentAfterRefusals: true });

const result = { capturedAt: new Date().toISOString(), barkdownCommit: process.env.BARKDOWN_SHOTS_HOST_COMMIT, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, isolatedRuntime: true, observations, limits: ['No real-library migration or authority switch', 'Concurrent generic draft writers are not namespace-reserved', 'Three contention samples complement insert-only database constraints; they do not prove all schedules'] };
const out = path.join(root, 'docs/cycles/evidence/C044'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'create-contract-' + Date.now() + '.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
