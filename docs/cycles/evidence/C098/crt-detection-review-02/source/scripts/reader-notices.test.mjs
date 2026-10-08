import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bindReaderNotices } from './reader-notices.mjs';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-reader-pin.json', import.meta.url)));
const originals = new URL('../docs/cycles/evidence/C098/reader-notice-preparation-03/', import.meta.url);
const read = file => fs.readFileSync(new URL(file.path.slice('reader/'.length), originals));
const payload = artifact => ({ upstream: pin.provenance.source.upstream, files: structuredClone(artifact.files),
  readerAssets: { goVersion: pin.provenance.source.goVersion, compilerSha256: pin.provenance.source.compilerSha256,
    sourceArchiveSha256: pin.provenance.source.sourceArchiveSha256, files: structuredClone(artifact.files) } });
assert.equal(bindReaderNotices(undefined, {}, () => { throw Error('Unexpected read'); }), null);
for (const artifact of pin.artifacts) {
  const result = bindReaderNotices(structuredClone(pin.provenance), payload(artifact), read);
  assert.equal(result.notices.length, 19); assert.equal(result.attribution.modules.length, 16);
  assert.equal(result.attribution.artifact, artifact.name);
  for (const notice of result.notices) assert.deepEqual(notice.bytes, read(notice.file));
  result.attribution.source.upstream = '0'.repeat(40); result.attribution.modules[0].sum = 'h1:forged';
  result.attribution.assets[0].sha256 = '0'.repeat(64); result.notices[0].file.path = 'mutated'; result.notices[0].bytes.fill(0);
  assert.equal(bindReaderNotices(pin.provenance, payload(artifact), read).attribution.source.upstream, pin.provenance.source.upstream);
}
bindReaderNotices(pin.provenance, payload(pin.artifacts[0]), file => { const bytes = read(file); file.sha256 = 'mutated'; file.path = '../escape'; return bytes; });
assert.equal(bindReaderNotices(pin.provenance, payload(pin.artifacts[0]), read).notices.length, 19);
const suppliedBuffers = [];
const retained = bindReaderNotices(pin.provenance, payload(pin.artifacts[0]), file => {
  const bytes = read(file); suppliedBuffers.push(bytes); return bytes;
});
suppliedBuffers[0].fill(0);
assert.deepEqual(retained.notices[0].bytes, read(retained.notices[0].file));
let refusals = 0;
function refusePrepared(value) { let reads = 0; assert.throws(() => bindReaderNotices(value, payload(pin.artifacts[0]), () => { reads++; }), /Unsupported\/changed/); assert.equal(reads, 0); refusals++; }
for (const value of [null, false, [], {}, [pin.provenance]]) refusePrepared(value);
for (const change of [p => p.version++, p => p.component = 'other', p => p.source.upstream = 'a'.repeat(40),
  p => p.source.compilerSha256 = 'b'.repeat(64), p => p.source.sourceArchiveSha256 = 'c'.repeat(64),
  p => p.source.goVersion = '1.26.7', p => p.source.sourceRevision = 'd'.repeat(40),
  p => p.source.module = 'other', p => p.source = null, p => p.modules.pop(), p => p.modules.push(p.modules[0]),
  p => p.modules[0].sum = 'h1:other', p => p.modules[0].version = 'v0.0.0', p => p.modules[0].path = 'other',
  p => p.modules[0].importedPackages.pop(), p => p.files.pop(), p => p.files.push(p.files[0]),
  p => p.files[0].path = '../escape', p => p.files[0].path += ':stream', p => p.files[0].bytes++,
  p => p.files[0].sha256 = 'f'.repeat(64), p => p.files[0].component = 'another copyright',
  p => p.files[0].extra = 'unknown', p => delete p.files[0].version]) { const value = structuredClone(pin.provenance); change(value); refusePrepared(value); }
for (const change of [p => p.upstream = 'a'.repeat(40), p => p.files.pop(), p => p.files.push(p.files[0]),
  p => p.files[0].name = 'other.wasm', p => p.files[0].bytes++, p => p.files[0].sha256 = 'b'.repeat(64),
  p => p.readerAssets.goVersion = '1.26.7', p => p.readerAssets.compilerSha256 = 'c'.repeat(64),
  p => p.readerAssets.sourceArchiveSha256 = 'd'.repeat(64), p => p.readerAssets.files[0].sha256 = 'e'.repeat(64),
  p => p.readerAssets = null, p => p.readerAssets.extra = 'unreviewed']) { const value = payload(pin.artifacts[0]); change(value); let reads = 0; assert.throws(() => bindReaderNotices(pin.provenance, value, () => { reads++; }), /Reader (upstream|asset bytes|release stamp)/); assert.equal(reads, 0); refusals++; }
for (const replace of [() => Buffer.from('changed copyright'), () => null, () => 'same text is not original bytes', () => Buffer.alloc(0)]) { assert.throws(() => bindReaderNotices(pin.provenance, payload(pin.artifacts[0]), replace), /Reader notice must|Changed reader original/); refusals++; }
for (const artifact of pin.artifacts) {
  const mixed = payload(artifact);
  mixed.readerAssets.files = structuredClone(pin.artifacts.find(other => other !== artifact).files);
  assert.throws(() => bindReaderNotices(pin.provenance, mixed, read), /release stamp differs/); refusals++;
}
console.log('Reader notices: both whole-artifact variants, 16 locked modules, 19 exact original texts, old input compatibility, report/callback alias isolation and '+refusals+' malformed/tampered/forged-source refusals pass.');
