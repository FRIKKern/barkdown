// Characterize upstream creation on an owned disposable runtime. This is not a migration runner.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const server = process.env.BARKDOWN_SHOTS_SERVER;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !process.env.BARKPARK_API_TOKEN) throw Error('Only an owned isolated runtime may run this probe');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/cycles/evidence/C044');
const prefix = 'migration-probe-' + crypto.randomUUID().slice(0, 8);
const observations = [];
async function request(method, route, body, key) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + process.env.BARKPARK_API_TOKEN, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  return { status: response.status, replay: response.headers.get('idempotency-replay'), data };
}
const mutate = (mutations, key) => request('POST', '/v1/data/mutate/production', { mutations }, key);
const envelope = response => response.data.result || response.data;
const get = async (id, perspective = 'published') => envelope(await request('GET', `/v1/data/doc/production/paper/${id}?perspective=${perspective}`));
function paper(slug, text) {
  return { slug, title: text, style: 'article', description: 'Disposable migration contract probe: ' + text, tags: [{ tag: 'migration-probe', strength: 95, rationale: 'Private migration contract test fixture' }], blocks: [{ type: 'heading', level: 1, text }, { type: 'paragraph', content: [{ type: 'text', value: text + '. This disposable paper records a specific creation boundary so the migration adapter can preserve existing content before it writes any real note.' }] }] };
}
const create = (kind, payload) => ({ [kind]: { _id: payload.slug, _type: 'paper', ...payload } });
const publish = id => ({ publish: { id, type: 'paper' } });
const tag = await mutate([{ createOrReplace: { _type: 'tag', _id: 'migration-probe', title: 'Migration probe' } }, { publish: { type: 'tag', id: 'migration-probe' } }]);
assert.equal(tag.status, 200, JSON.stringify(tag));

const draftId = prefix + '-draft';
const draft = paper(draftId, 'Draft collision preserves an existing writer');
const first = await mutate([create('create', draft)]);
assert.equal(first.status, 200, JSON.stringify(first));
const second = await mutate([create('create', paper(draftId, 'A replacement must not become this draft'))]);
const noop = await mutate([create('createIfNotExists', paper(draftId, 'Another replacement must remain a no-op'))]);
assert.equal(second.status, 409, JSON.stringify(second));
assert.equal(noop.status, 200, JSON.stringify(noop));
assert.equal((await get(draftId, 'drafts')).title, draft.title);
observations.push({ boundary: 'existing-draft', createStatus: second.status, createIfNotExists: envelope(noop).results?.[0]?.operation, originalRetained: true });

const publishedId = prefix + '-published';
const original = paper(publishedId, 'Published content belongs to the original author');
const born = await request('POST', '/v1/plugins/bulldocs/papers', original);
assert.equal(born.status, 200, JSON.stringify(born));
const attempted = paper(publishedId, 'A generic create followed by publish has different content');
const collision = await mutate([create('createIfNotExists', attempted), publish(publishedId)]);
const after = await get(publishedId);
observations.push({ boundary: 'existing-published', status: collision.status, error: collision.data.error || null, beforeTitle: original.title, afterTitle: after.title, originalRetained: after.title === original.title });

const replayId = prefix + '-receipt', key = crypto.randomUUID();
const replayBody = [create('create', paper(replayId, 'A durable response receipt survives a repeated request'))];
const acknowledged = await mutate(replayBody, key);
const repeated = await mutate(replayBody, key);
assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged));
assert.equal(repeated.replay, 'true');
assert.deepEqual(repeated.data, acknowledged.data);
observations.push({ boundary: 'same-key-replay', originalStatus: acknowledged.status, repeatedStatus: repeated.status, byteEquivalentJson: true });

const concurrentId = prefix + '-concurrent';
const concurrent = await Promise.all(Array.from({ length: 6 }, (_, i) => mutate([create('createIfNotExists', paper(concurrentId, 'Concurrent isolated attempt number ' + i))], crypto.randomUUID())));
observations.push({ boundary: 'different-key-concurrency', results: concurrent.map(r => ({ status: r.status, operation: envelope(r).results?.[0]?.operation, error: r.data.error || null })), finalTitle: (await get(concurrentId, 'drafts')).title, limitation: 'One timing sample cannot establish race freedom.' });

fs.mkdirSync(out, { recursive: true });
const result = { capturedAt: new Date().toISOString(), barkdownCommit: process.env.BARKDOWN_SHOTS_HOST_COMMIT, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, isolatedRuntime: true, migrationWritesAuthorized: false, observations };
fs.writeFileSync(path.join(out, 'contract-probe.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
