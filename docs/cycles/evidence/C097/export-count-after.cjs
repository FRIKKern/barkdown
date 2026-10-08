const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createProfileExport } = require(path.resolve('app/main/profile-export.js'));
const out = path.resolve('docs/cycles/evidence/C097/export-count-after');
fs.mkdirSync(out, { recursive: true });
const rows = Array.from({ length: 201 }, (_, i) => ({ _id: `drafts.note-${i}`, _draft: true }));
const cases = [
  { name: 'valid-empty', total: 0, page: () => [], expected: 0 },
  { name: 'valid-201', total: 201, page: offset => rows.slice(offset, offset + 200), expected: 201 },
  { name: 'premature-empty', total: 201, page: () => [], refuse: true },
  { name: 'missing-documents', total: 201, page: () => undefined, refuse: true },
  { name: 'negative-total', total: -1, page: () => [], refuse: true },
  { name: 'duplicate-next-page', total: 201, page: offset => offset ? [rows[0]] : rows.slice(0, 200), refuse: true },
];
const results = [];
(async () => {
  for (const c of cases) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-count-review-')));
    const storeDir = path.join(root, 'store'), mediaDir = path.join(root, 'media'), destination = path.join(root, 'export');
    fs.mkdirSync(storeDir); fs.mkdirSync(mediaDir);
    fs.writeFileSync(path.join(storeDir, 'workspace.json'), '{"version":1}');
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(storeDir, 'workspace.json'))).digest('hex');
    const requests = [], events = [];
    const server = http.createServer((req, res) => {
      const query = new URL(req.url, 'http://fixture').searchParams;
      const perspective = query.get('perspective'), offset = Number(query.get('offset'));
      requests.push({ perspective, offset });
      const total = perspective === 'published' ? 2 : c.total;
      const documents = perspective === 'published' ? [{ _id: 'published' }] : c.page(offset);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ documents, total, offset, count: documents?.length, perspective, limit: Number(query.get('limit')), hasMore: offset + (documents?.length || 0) < total, ...(offset + (documents?.length || 0) < total ? { nextOffset: offset + Number(query.get('limit')) } : {}) }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const exporter = createProfileExport({
      registry: { load: () => ({ profiles: [{ id: 'fixture', name: 'Disposable count probe' }] }), storeFor: () => ({ storeDir }) },
      preparation: { withPrepared: async (_id, fn) => fn({ assertCurrent: async () => {} }) },
      runtimePool: { acquire: async () => ({ connection: { server: `http://127.0.0.1:${server.address().port}`, token: 'synthetic-only' }, data: { mediaDir, dump: async file => { fs.writeFileSync(file, 'synthetic-dump-not-a-real-database'); return { file, serverVersion: 'fixture' }; } }, release: async () => events.push('released') }) },
      admission: { hold: async () => ({ phase: 'held', capability: 'fixture-cap', generation: 1, boot: 'fixture' }), reopen: async () => events.push('reopened') },
      upstreamRef: () => 'fixture',
    });
    let counts = null, error = null;
    try { counts = (await exporter.exportProfile('fixture', destination)).manifest.counts; }
    catch (e) { error = { code: e.code || null, message: e.message }; }
    finally { await new Promise(resolve => server.close(resolve)); }
    assert.deepEqual(events, ['reopened', 'released']);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(storeDir, 'workspace.json'))).digest('hex'), sourceHash);
    const passed = c.refuse ? ['export_count', 'catalog_incomplete'].includes(error?.code) : !error && counts?.drafts === c.expected;
    results.push({ name: c.name, expected: c.refuse ? 'refuse incomplete/invalid count' : c.expected, passed, counts, error, requests, events, completedManifest: fs.existsSync(path.join(destination, 'manifest.json')), sourcePreserved: true, fixtureRoot: root });
  }
  const result = { at: new Date().toISOString(), source: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), moduleSha256: crypto.createHash('sha256').update(fs.readFileSync('app/main/profile-export.js')).digest('hex'), scope: 'Actual export and default HTTP counting; synthetic loopback query responses and stubbed preparation/admission/database dump. No real runtime/library/Mac transfer.', results };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  assert.ok(results.every(r => r.passed), 'Export must refuse incomplete or invalid counts before publishing a completed manifest');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
