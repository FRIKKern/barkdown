import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bindClientNotices } from './client-notices.mjs';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-clients-pin.json', import.meta.url)));
const originals = new URL('../docs/third-party/windows-runtime-inputs/944a57a1-client-original-16/', import.meta.url);
const read = file => fs.readFileSync(new URL(file.path, originals));
const payload = () => ({ upstream: pin.provenance.upstream, assets: pin.provenance.clients.map(row => structuredClone(row.asset)) });
assert.equal(bindClientNotices(undefined, {}, () => { throw Error('Unexpected read'); }), null);
const result = bindClientNotices(pin.provenance, payload(), read);
assert.equal(result.notices.length, 3); assert.equal(result.attribution.clients.length, 2);
assert.equal(result.attribution.clients[0].packages[0].version, '1.8.5');
assert.equal(result.attribution.clients[0].correspondence.inputs.length, 11);
assert.equal(result.attribution.clients[1].packages.length, 2);
for (const notice of result.notices) assert.deepEqual(notice.bytes, read(notice.file));
result.notices[0].file.path = '../escape'; result.notices[0].bytes.fill(0);
result.attribution.clients[0].asset.sha256 = '0'.repeat(64); result.attribution.clients[1].packages[0].version = 'other';
result.attribution.clients[0].correspondence.inputs.length = 0; result.attribution.limits.length = 0;
assert.deepEqual(bindClientNotices(pin.provenance, payload(), read).attribution.clients, pin.provenance.clients);
const supplied = [];
const kept = bindClientNotices(pin.provenance, payload(), file => {
  const bytes = read(file); supplied.push(bytes); file.path = '../escape'; file.sha256 = 'mutated'; return bytes;
});
supplied[0].fill(0); assert.deepEqual(kept.notices[0].bytes, read(kept.notices[0].file));
assert.equal(bindClientNotices(pin.provenance, payload(), read).notices.length, 3);
let refusals = 0;
function refuse(value) { let reads = 0; assert.throws(() => bindClientNotices(value, payload(), () => { reads++; }), /Unsupported\/changed/); assert.equal(reads, 0); refusals++; }
for (const value of [null, false, [], {}, [pin.provenance]]) refuse(value);
for (const change of [p => p.version++, p => p.component = 'other', p => p.upstream = 'a'.repeat(40),
  p => p.sourceRevision = 'b'.repeat(40), p => p.distributionReady = true, p => p.clients.pop(), p => p.clients.push(p.clients[0]),
  p => p.clients[0].id = 'other', p => p.clients[0].asset.sha256 = 'c'.repeat(64),
  p => p.clients[0].packages[0].version = '1.8.9', p => p.clients[1].packages[0].version = '5.4.0',
  p => p.clients[1].packages[1].version = '0.9.0', p => p.clients[1].packages.pop(),
  p => p.clients[0].packages[0].archiveSha256 = 'd'.repeat(64), p => p.clients[0].packages[0].integrity = 'sha512:other',
  p => p.clients[0].packages[0].tarball = 'https://example.invalid', p => p.clients[0].packages[0].packageJsonSha256 = 'e'.repeat(64),
  p => p.clients[0].correspondence.compiler.version = '0.28.2', p => p.clients[0].correspondence.compiler.binarySha256 = 'f'.repeat(64),
  p => p.clients[0].correspondence.options.supported['optional-catch-binding'] = true,
  p => p.clients[0].correspondence.inputs.pop(), p => p.clients[0].correspondence.inputs[0].sha256 = '0'.repeat(64),
  p => p.clients[1].correspondence.separator = '\n', p => p.clients[1].correspondence.kind = 'compiled-from-source',
  p => p.clients[1].correspondence.inputs[0].sha256 = '1'.repeat(64), p => p.clients[1].correspondence.inputs[1].bytes++,
  p => p.files.pop(), p => p.files.push(p.files[0]), p => p.files[0].path = '../escape', p => p.files[0].path += ':stream',
  p => p.files[0].sha256 = '2'.repeat(64), p => p.files[0].bytes++, p => p.files[0].source = 'https://example.invalid',
  p => p.files[0].archiveMember = 'package/other', p => p.files[0].component = 'other', p => delete p.files[0].version,
  p => p.files[0].extra = 'unreviewed']) { const value = structuredClone(pin.provenance); change(value); refuse(value); }
for (const change of [p => p.upstream = 'a'.repeat(40), p => p.assets.pop(), p => p.assets.push(p.assets[0]),
  p => p.assets[0].name = 'other.js', p => p.assets[0].bytes++, p => p.assets[0].sha256 = 'b'.repeat(64),
  p => p.assets[1].sha256 = 'c'.repeat(64), p => p.assets[1].extra = true, p => p.assets = null, p => p.assets.reverse()]) {
  const value = payload(); change(value); let reads = 0;
  assert.throws(() => bindClientNotices(pin.provenance, value, () => { reads++; }), /Client (upstream|asset bytes)/);
  assert.equal(reads, 0); refusals++;
}
for (const replace of [() => Buffer.from('different copyright'), () => null, () => 'not original bytes', () => Buffer.alloc(0)]) {
  assert.throws(() => bindClientNotices(pin.provenance, payload(), replace), /Changed client original|Client notice must/); refusals++;
}
console.log('Client notices: exact Phoenix/xterm assets, three package identities/originals, source-reproduction versus dist-input limits, old optional inputs, callback/report/buffer alias isolation and '+refusals+' metadata/asset/source/original refusals pass.');
