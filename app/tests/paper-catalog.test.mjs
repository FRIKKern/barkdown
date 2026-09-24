import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readCatalog } = require('../main/paper-catalog');
const { listAllPapers, listPapers } = require('../main/barkpark');
const papers = n => Array.from({ length: n }, (_, i) => ({ _id: `paper-${i}`, title: `Paper ${i}`, _updatedAt: new Date(1700000000000 + i * 1000).toISOString() }));
function page(all, limit, offset) {
  const documents = all.slice(offset, offset + limit), hasMore = offset + documents.length < all.length;
  return { result: { documents, count: documents.length, limit, offset, hasMore, perspective: 'published', total: all.length, ...(hasMore ? { nextOffset: offset + limit } : {}) } };
}
for (const size of [0, 1, 60, 61, 200, 201, 400, 401]) test(`complete catalog of ${size} papers`, async () => {
  const all = papers(size), calls = [];
  const actual = await readCatalog(({ limit, offset }) => { calls.push(offset); return page(all, limit, offset); });
  assert.deepEqual(actual, all);
  assert.equal(calls.length, Math.max(1, Math.ceil((size - 1) / 199)));
});
const invalid = {
  'old response without pagination': p => ({ documents: p.documents }),
  'missing total': p => { delete p.total; return p; },
  'wrong offset': p => ({ ...p, offset: 1 }),
  'wrong limit': p => ({ ...p, limit: 1 }),
  'wrong count': p => ({ ...p, count: 1 }),
  'unknown perspective': p => ({ ...p, perspective: 'raw' }),
  'nonboolean hasMore': p => ({ ...p, hasMore: 'true' }),
  'missing next offset': p => { delete p.nextOffset; return p; },
  'nonadvancing next offset': p => ({ ...p, nextOffset: 0 }),
  'overlapping page': p => ({ ...p, nextOffset: 199 }),
  'short intermediate page': p => ({ ...p, count: 199, documents: p.documents.slice(0, 199) }),
  'invalid paper id': p => ({ ...p, documents: [{ _id: '' }, ...p.documents.slice(1)] }),
  'draft in published catalog': p => ({ ...p, documents: [{ ...p.documents[0], _draft: true }, ...p.documents.slice(1)] }),
  'duplicate inside page': p => ({ ...p, documents: [p.documents[1], ...p.documents.slice(1)] }),
  'over budget total': p => ({ ...p, total: 10001 }),
};
for (const [name, mutate] of Object.entries(invalid)) test(`refuses ${name}`, async () => {
  await assert.rejects(readCatalog(({ limit, offset }) => mutate(page(papers(401), limit, offset).result)), { code: 'catalog_incomplete' });
});
test('refuses changing totals and repeated ids across pages', async () => {
  for (const change of ['total', 'id']) await assert.rejects(readCatalog(({ limit, offset }) => {
    const p = page(papers(401), limit, offset).result;
    if (offset) { if (change === 'total') p.total--; else p.documents[0]._id = 'paper-0'; }
    return p;
  }), { code: 'catalog_incomplete' });
});
test('refuses false finality, extra final offset and failed later pages', async () => {
  for (const mutate of [p => ({ ...p, total: 2 }), p => ({ ...p, nextOffset: 200 })]) await assert.rejects(readCatalog(({ limit, offset }) => mutate(page(papers(1), limit, offset).result)), { code: 'catalog_incomplete' });
  await assert.rejects(readCatalog(({ limit, offset }) => { if (offset) throw new Error('permission lost'); return page(papers(201), limit, offset); }), /permission lost/);
});
test('byte and elapsed budgets refuse instead of returning a prefix', async () => {
  await assert.rejects(readCatalog(({ limit, offset }) => page(papers(1), limit, offset), { maxBytes: 1 }), { code: 'catalog_incomplete' });
  await assert.rejects(readCatalog(async ({ limit, offset }) => { await new Promise(r => setTimeout(r, 15)); return page(papers(1), limit, offset); }, { timeoutMs: 5 }), { code: 'catalog_incomplete' });
});
test('HTTP adapter captures connection, uses audited pagination and preserves bounded provider listing', async () => {
  const all = papers(401), requests = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://fixture'); requests.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), auth: req.headers.authorization });
    if (requests.length === 1) { config.server = 'http://127.0.0.1:1'; config.token = 'changed'; config.dataset = 'elsewhere'; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(page(all, Number(u.searchParams.get('limit')), Number(u.searchParams.get('offset') || 0))));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const config = { server: `http://127.0.0.1:${server.address().port}`, token: 'fixture-token', dataset: 'fixture' }, initial = { ...config };
  try {
    const actual = await listAllPapers(config);
    assert.equal(actual.length, 401); assert.equal(actual[0].id, 'paper-400');
    assert.deepEqual(requests.map(r => r.query.offset), ['0', '199', '398']);
    for (const r of requests) { assert.equal(r.auth, 'Bearer fixture-token'); assert.equal(r.path, '/v1/data/query/fixture/paper'); assert.equal(r.query.order, '_createdAt:asc'); assert.equal(r.query.count, 'true'); assert.equal(r.query.perspective, 'published'); assert.equal(r.query.fields, 'title,slug,tags'); }
    assert.equal((await listPapers(initial)).length, 60);
    assert.equal(requests.length, 4);
  } finally { await new Promise(r => server.close(r)); }
});
test('HTTP catalog stops an oversized page before parsing or publishing it', async () => {
  const chunk = 'x'.repeat(1024 * 1024);
  const server = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); for (let i = 0; i < 21; i++) res.write(chunk); res.end(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await assert.rejects(listAllPapers({ server: `http://127.0.0.1:${server.address().port}` }), /page size budget/); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
test('refuses a constant-count deletion/insertion that would silently skip a boundary paper', async () => {
  const all = papers(401);
  await assert.rejects(readCatalog(({ limit, offset }) => {
    if (offset) { all.shift(); all.push({ _id: 'replacement' }); }
    return page(all, limit, offset);
  }), /shifted between pages/);
});
test('boundary overlap does not excuse duplicate identities later in a page', async () => {
  const all = papers(401);
  await assert.rejects(readCatalog(({ limit, offset }) => {
    const p = page(all, limit, offset);
    if (offset) p.result.documents[1] = all[0];
    return p;
  }), /repeated paper/);
});
