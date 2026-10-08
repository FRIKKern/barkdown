import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { readReaderAssets, attachReaderAssets, readerFiles, readerLoader } from './runtime-wasm-assets.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-reader-assets-'));
const wasm = Buffer.from('0061736d01000000', 'hex');
function fixture(name) {
  const source = path.join(root, name, 'source'), target = path.join(root, name, 'target');
  fs.mkdirSync(source, { recursive: true }); fs.mkdirSync(target);
  fs.writeFileSync(path.join(source, readerFiles[0]), wasm);
  fs.writeFileSync(path.join(source, readerFiles[1]), zlib.gzipSync(wasm));
  for (const dir of [source, target]) fs.writeFileSync(path.join(dir, readerLoader), 'fixture loader\n');
  return { source, target };
}
function noCopiedFiles(target) { for (const file of readerFiles) assert.equal(fs.existsSync(path.join(target, file)), false); }

const good = fixture('good');
assert.ok(readReaderAssets(good.source).wasm.equals(wasm));
assert.equal(attachReaderAssets(good.source, good.target).length, 3);
assert.ok(fs.readFileSync(path.join(good.target, readerFiles[0])).equals(wasm));
assert.ok(zlib.gunzipSync(fs.readFileSync(path.join(good.target, readerFiles[1]))).equals(wasm));
assert.throws(() => attachReaderAssets(good.source, good.target), /already exists/);

const missing = fixture('missing');
// A partial build cannot be copied and represented as a complete runtime.
fs.renameSync(path.join(missing.source, readerFiles[1]), path.join(missing.source, 'retained-gzip'));
assert.throws(() => attachReaderAssets(missing.source, missing.target), /ENOENT/); noCopiedFiles(missing.target);
const badWasm = fixture('bad-wasm');
fs.writeFileSync(path.join(badWasm.source, readerFiles[0]), 'not WebAssembly');
assert.throws(() => attachReaderAssets(badWasm.source, badWasm.target), /Invalid reader WebAssembly/); noCopiedFiles(badWasm.target);
const badGzip = fixture('bad-gzip');
fs.writeFileSync(path.join(badGzip.source, readerFiles[1]), zlib.gzipSync(Buffer.from('different bytes')));
assert.throws(() => attachReaderAssets(badGzip.source, badGzip.target), /gzip does not match/); noCopiedFiles(badGzip.target);
const badLoader = fixture('bad-loader');
fs.writeFileSync(path.join(badLoader.target, readerLoader), 'different loader');
assert.throws(() => attachReaderAssets(badLoader.source, badLoader.target), /loader does not match/); noCopiedFiles(badLoader.target);
const partial = fixture('partial-target');
fs.writeFileSync(path.join(partial.target, readerFiles[1]), 'retained failed attempt');
assert.throws(() => attachReaderAssets(partial.source, partial.target), /already exists/);
assert.equal(fs.existsSync(path.join(partial.target, readerFiles[0])), false);
assert.equal(fs.readFileSync(path.join(partial.target, readerFiles[1]), 'utf8'), 'retained failed attempt');
const linked = fixture('linked');
const alias = path.join(root, 'linked-source');
fs.symlinkSync(linked.source, alias, process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => attachReaderAssets(alias, linked.target), /cannot traverse links/); noCopiedFiles(linked.target);
const targetAlias = path.join(root, 'linked-target');
fs.symlinkSync(linked.target, targetAlias, process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => attachReaderAssets(linked.source, targetAlias), /cannot traverse links/); noCopiedFiles(linked.target);
console.log('Reader asset identity/gzip/loader, missing/corrupt input, links and retained-output refusal checks pass');
