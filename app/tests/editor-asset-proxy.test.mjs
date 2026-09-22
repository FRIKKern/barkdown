import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { startEditorAssetProxy, refusedEditorAssets } from './helpers/editor-asset-proxy.mjs';

test('refuses only editor assets; forwards real API/media bytes, auth and status', async () => {
  const seen = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seen.push({ url: req.url, method: req.method, auth: req.headers.authorization, body: Buffer.concat(chunks) });
    res.writeHead(207, { 'content-type': 'application/octet-stream', 'x-owned-test': 'yes' });
    res.end(Buffer.from([0, 255, 10, 13, 128]));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const proxy = await startEditorAssetProxy(`http://127.0.0.1:${upstream.address().port}`);
  try {
    for (const path of refusedEditorAssets) {
      const response = await fetch(proxy.url + path + '?cache=bust');
      assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(seen.length, 0);
    const bytes = Buffer.from([255, 0, 13, 10, 42]);
    for (const path of ['/api/papers/test/ops?rev=2', '/media/files/test', '/assets/bp-paper-mermaid.js', '/assets/bp-paper-editor.css.map', '/status.json']) {
      const response = await fetch(proxy.url + path, { method: 'POST', headers: { authorization: 'Bearer owned-test-only' }, body: bytes });
      assert.equal(response.status, 207); assert.equal(response.headers.get('x-owned-test'), 'yes');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0, 255, 10, 13, 128]));
      assert.deepEqual(seen.at(-1), { url: path, method: 'POST', auth: 'Bearer owned-test-only', body: bytes });
    }
    assert.equal(proxy.counts.forwarded, 5);
    assert.equal(JSON.stringify(proxy.counts).includes('Bearer'), false);
  } finally {
    await proxy.close(); await new Promise(resolve => upstream.close(resolve));
  }
});

test('cannot target a remote server or a URL with credentials/path', async () => {
  for (const url of ['http://example.com', 'https://127.0.0.1', 'http://127.0.0.1/x', 'http://user:secret@127.0.0.1']) {
    await assert.rejects(startEditorAssetProxy(url), /owned IPv4 loopback/);
  }
});

test('actual resolver selects existing vendor through refused assets with an empty cache', async () => {
  const require = createRequire(import.meta.url);
  const { resolve } = require('../main/canvas-bundle');
  const upstream = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"version":"owned-transport-fixture"}'); });
  await new Promise(done => upstream.listen(0, '127.0.0.1', done));
  const proxy = await startEditorAssetProxy(`http://127.0.0.1:${upstream.address().port}`);
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-fallback-transport-'));
  const vendorDir = path.resolve(import.meta.dirname, '../renderer/vendor');
  try {
    const selected = await resolve({ config: { server: proxy.url, viaCli: false, enabled: true }, cacheDir, vendorDir });
    assert.equal(selected.source, 'vendored');
    assert.equal(selected.sha, crypto.createHash('sha1').update(fs.readFileSync(path.join(vendorDir, 'bp-paper-editor.bundle.js'))).digest('hex'));
    assert.equal(fs.existsSync(path.join(cacheDir, 'current.json')), false);
    for (const asset of refusedEditorAssets) assert.ok(proxy.counts.refused[asset] > 0);
  } finally { await proxy.close(); await new Promise(done => upstream.close(done)); }
});
