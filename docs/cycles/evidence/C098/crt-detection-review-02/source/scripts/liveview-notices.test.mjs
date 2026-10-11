import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bindLiveViewNotices } from './liveview-notices.mjs';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-liveview-pin.json', import.meta.url)));
const originals = new URL('../docs/cycles/evidence/C098/liveview-review-01/', import.meta.url);
const read = file => fs.readFileSync(new URL(file.path.split('/').at(-1), originals));
const payload = () => ({ upstream: pin.provenance.upstream, asset: structuredClone(pin.asset) });
assert.equal(bindLiveViewNotices(undefined, {}, () => { throw Error('Unexpected read'); }), null);
const result = bindLiveViewNotices(pin.provenance, payload(), read);
assert.equal(result.notices.length, 2); assert.equal(result.attribution.packages.length, 2);
assert.equal(result.attribution.reproduction.inputs.length, 20);
assert.deepEqual(result.attribution.texts, pin.provenance.files.map(f => 'licenses/' + f.path));
for (const notice of result.notices) assert.deepEqual(notice.bytes, read(notice.file));
result.notices[0].file.path = '../escape'; result.notices[0].bytes.fill(0);
result.attribution.asset.sha256 = '0'.repeat(64); result.attribution.packages[0].sourceCommit = '0'.repeat(40);
result.attribution.reproduction.inputs[0].sha256 = '0'.repeat(64); result.attribution.limits.length = 0;
assert.equal(bindLiveViewNotices(pin.provenance, payload(), read).attribution.asset.sha256, pin.asset.sha256);
const suppliedBuffers = [];
const retained = bindLiveViewNotices(pin.provenance, payload(), file => {
  const bytes = read(file); suppliedBuffers.push(bytes); file.path = '../escape'; file.sha256 = 'mutated'; return bytes;
});
suppliedBuffers[0].fill(0); assert.deepEqual(retained.notices[0].bytes, read(retained.notices[0].file));
assert.equal(bindLiveViewNotices(pin.provenance, payload(), read).notices.length, 2);
let refusals = 0;
function refuse(value) { let reads = 0; assert.throws(() => bindLiveViewNotices(value, payload(), () => { reads++; }), /Unsupported\/changed/); assert.equal(reads, 0); refusals++; }
for (const value of [null, false, [], {}, [pin.provenance]]) refuse(value);
for (const change of [p => p.version++, p => p.component = 'other', p => p.upstream = 'a'.repeat(40),
  p => p.sourceRevision = 'b'.repeat(40), p => p.distributionReady = true, p => p.packages.pop(), p => p.packages.push(p.packages[0]),
  p => p.packages[0].sourceCommit = 'c'.repeat(40), p => p.packages[0].archiveSha256 = 'd'.repeat(64),
  p => p.packages[0].integrity = 'sha512:other', p => p.packages[0].packageJsonSha256 = 'e'.repeat(64),
  p => p.packages[0].name = 'other', p => p.packages[0].version = '1.1.32', p => p.packages[1].version = '2.7.7',
  p => p.reproduction.compiler.version = '0.25.12', p => p.reproduction.compiler.binarySha256 = 'f'.repeat(64),
  p => p.reproduction.options.tsconfigRaw = { compilerOptions: {} }, p => p.reproduction.options.target = 'es2017',
  p => p.reproduction.options.define.LV_VSN = '"1.1.32"', p => p.reproduction.inputs.pop(),
  p => p.reproduction.inputs.push(p.reproduction.inputs[0]), p => p.reproduction.inputs[0].sha256 = '0'.repeat(64),
  p => p.reproduction.inputs[0].bytes++, p => p.reproduction.inputs[0].component = 'other',
  p => p.files.pop(), p => p.files.push(p.files[0]), p => p.files[0].path = '../escape', p => p.files[0].path += ':stream',
  p => p.files[0].sha256 = '1'.repeat(64), p => p.files[0].bytes++, p => p.files[0].source = 'https://example.invalid',
  p => p.files[0].component = 'other', p => delete p.files[0].version, p => p.files[0].extra = 'unreviewed']) {
  const value = structuredClone(pin.provenance); change(value); refuse(value);
}
for (const change of [p => p.upstream = 'a'.repeat(40), p => p.asset.name = 'different.js', p => p.asset.bytes++,
  p => p.asset.sha256 = 'b'.repeat(64), p => p.asset.extra = true, p => p.asset = null]) {
  const value = payload(); change(value); let reads = 0;
  assert.throws(() => bindLiveViewNotices(pin.provenance, value, () => { reads++; }), /LiveView (upstream|asset bytes)/);
  assert.equal(reads, 0); refusals++;
}
for (const replace of [() => Buffer.from('different copyright'), () => null, () => 'not original bytes', () => Buffer.alloc(0)]) {
  assert.throws(() => bindLiveViewNotices(pin.provenance, payload(), replace), /Changed LiveView original|LiveView notice must/); refusals++;
}
console.log('LiveView notices: exact whole client/source/compiler recipe, 20 inputs/two original texts, old optional-input compatibility, callback/report/buffer alias isolation and '+refusals+' metadata/asset/source/original refusals pass.');
