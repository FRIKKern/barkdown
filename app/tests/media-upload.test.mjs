import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { uploadMedia } = require('../main/barkpark');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-upload-shapes-'));
const file = path.join(root, 'fixture.png'); fs.writeFileSync(file, 'fixture');
const originalFetch = global.fetch;
try {
  for (const [response, expected] of [
    [{ url: '/media/files/fixture.png', assetDocId: 'asset-A' }, { src: 'http://127.0.0.1:53123/media/files/fixture.png', id: 'asset-A' }],
    [{ result: { absoluteUrl: 'https://cdn.example.test/image.png', asset: { _publishedId: 'asset-B', fileInfo: { width: 32, height: 16 }, altText: 'Fixture' } } }, { src: 'https://cdn.example.test/image.png', id: 'asset-B', width: 32 }],
    [{ result: { asset: { fileInfo: { url: '/media/files/asset.png' } } } }, { src: 'http://127.0.0.1:53123/media/files/asset.png', id: null }],
  ]) {
    global.fetch = async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:53123/media/upload');
      assert.equal(options.headers.authorization, 'Bearer fixture-token-A');
      assert.equal(options.body.get('dataset'), 'production');
      return { ok: true, text: async () => JSON.stringify(response) };
    };
    const actual = await uploadMedia({ server: 'http://127.0.0.1:53123', token: 'fixture-token-A', dataset: 'production' }, { filePath: file, mime: 'image/png' });
    for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value);
  }
  global.fetch = async () => ({ ok: true, text: async () => '{}' });
  await assert.rejects(uploadMedia({ server: 'http://127.0.0.1:53123' }, { filePath: file }), /no url/);
  console.log('PASS dataset-less and v1 upload shapes resolve relative media against captured server; missing URL fails');
} finally { global.fetch = originalFetch; }
