import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bindFrontendNotices, frontendFiles } from './frontend-notices.mjs';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-frontend-pin.json', import.meta.url)));
const originals = new URL('../docs/third-party/windows-runtime-inputs/944a57a1-frontend-original-17/', import.meta.url);
const read = file => fs.readFileSync(new URL(file.path, originals));
const payload = () => ({ upstream: pin.provenance.upstream, assets: structuredClone(pin.provenance.assets) });
assert.equal(bindFrontendNotices(undefined, {}, () => { throw Error('Unexpected read'); }), null);
assert.ok(Object.isFrozen(frontendFiles)); assert.deepEqual(frontendFiles, pin.provenance.assets.map(p => p.path));
const result = bindFrontendNotices(pin.provenance, payload(), read);
assert.equal(result.notices.length, 51); assert.equal(result.attribution.assets.length, 11);
assert.equal(result.attribution.editor.inputs.length, 347); assert.equal(result.attribution.editor.packages.length, 45);
const highlights = result.attribution.editor.packages.filter(p => p.name === 'highlight.js');
assert.deepEqual(highlights.map(p => p.version).sort(), ['11.11.2', '11.12.0']);
assert.equal(result.attribution.player.kind, 'published-dist-members');
for (const notice of result.notices) assert.deepEqual(notice.bytes, read(notice.file));
result.notices[0].file.path = '../escape'; result.notices[0].bytes.fill(0);
result.attribution.assets[0].sha256 = '0'.repeat(64); result.attribution.editor.inputs.length = 0;
result.attribution.editor.packages.length = 0; result.attribution.fonts.plex.sourceCommit = 'unknown';
result.attribution.player.kind = 'compiled-from-source'; result.attribution.limits.length = 0;
assert.deepEqual(bindFrontendNotices(pin.provenance, payload(), read).attribution.editor, pin.provenance.editor);
const supplied = [];
const kept = bindFrontendNotices(pin.provenance, payload(), file => {
  const bytes = read(file); supplied.push(bytes); file.path = '../escape'; file.sha256 = 'mutated'; return bytes;
});
supplied[0].fill(0); assert.deepEqual(kept.notices[0].bytes, read(kept.notices[0].file));
let refusals = 0;
function refuse(value) { let reads = 0; assert.throws(() => bindFrontendNotices(value, payload(), () => { reads++; }), /Unsupported\/changed/); assert.equal(reads, 0); refusals++; }
for (const value of [null, false, [], {}, [pin.provenance]]) refuse(value);
for (const change of [p => p.version++, p => p.component = 'other', p => p.upstream = 'a'.repeat(40),
  p => p.distributionReady = true, p => p.sourceRevision = 'b'.repeat(40),
  p => p.assets.pop(), p => p.assets.push(p.assets[0]), p => p.assets.reverse(),
  p => p.editor.lockSha256 = 'c'.repeat(64), p => p.editor.compiler.version = '0.20.2',
  p => p.editor.compiler.binarySha256 = 'd'.repeat(64), p => p.editor.options.tsconfigRaw.compilerOptions.target = 'es2021',
  p => p.editor.graphs.pop(), p => p.editor.graphs[0].inputs.pop(), p => p.editor.graphs[1].entry = 'other.css',
  p => p.editor.inputs.pop(), p => p.editor.inputs.push(p.editor.inputs[0]), p => p.editor.inputs[0].sha256 = 'e'.repeat(64),
  p => p.editor.inputs[0].packageRoot = 'node_modules/other', p => p.editor.packages.pop(),
  p => p.editor.packages.push(p.editor.packages[0]), p => p.editor.packages[0].version = '2.27.2',
  p => p.editor.packages[0].integrity = 'sha512:other', p => p.editor.packages[0].packageJsonSha256 = 'f'.repeat(64),
  p => p.editor.packages.find(p => p.path === 'node_modules/lowlight/node_modules/highlight.js').version = '11.12.0',
  p => p.fonts.releaseCommits.inter = '0'.repeat(40), p => p.fonts.archiveMatches[0].archiveSha256 = '1'.repeat(64),
  p => p.fonts.plex.sourceCommit = '2'.repeat(40), p => p.fonts.plex.fonttools = '4.60.2',
  p => p.fonts.plex.options.recalc_bounds = true, p => p.fonts.plex.unicodeSet = 'U+0000-FFFF',
  p => p.fonts.plex.inputs[0].sha256 = '3'.repeat(64), p => p.fonts.plex.outputs.pop(),
  p => p.player.kind = 'compiled-from-source', p => p.player.version = '3.9.0',
  p => p.player.archiveSha256 = '4'.repeat(64), p => p.player.inputs[0].path = 'package/other',
  p => p.player.sourceCommit = '5'.repeat(40), p => p.files.pop(), p => p.files.push(p.files[0]),
  p => p.files[0].path = '../escape', p => p.files[0].path += ':stream', p => p.files[0].sha256 = '6'.repeat(64),
  p => p.files[0].bytes++, p => p.files[0].source = 'https://example.invalid', p => p.files[0].sourceMember = 'package/other',
  p => p.files[0].component = 'other', p => delete p.files[0].version, p => p.files[0].extra = true]) {
  const value = structuredClone(pin.provenance); change(value); refuse(value);
}
for (let i = 0; i < pin.provenance.assets.length; i++) {
  const value = payload(); value.assets[i].sha256 = '7'.repeat(64); let reads = 0;
  assert.throws(() => bindFrontendNotices(pin.provenance, value, () => { reads++; }), /Frontend asset bytes/);
  assert.equal(reads, 0); refusals++;
}
for (const change of [p => p.upstream = '8'.repeat(40), p => p.assets.pop(), p => p.assets.push(p.assets[0]),
  p => p.assets[0].bytes++, p => p.assets[0].extra = true, p => p.assets.reverse()]) {
  const value = payload(); change(value); let reads = 0;
  assert.throws(() => bindFrontendNotices(pin.provenance, value, () => { reads++; }), /Frontend (upstream|asset bytes)/);
  assert.equal(reads, 0); refusals++;
}
for (const notice of pin.provenance.files) {
  assert.throws(() => bindFrontendNotices(pin.provenance, payload(), file => file.path === notice.path ? Buffer.from('changed copyright') : read(file)), /Changed frontend original/); refusals++;
}
for (const replace of [() => null, () => 'not bytes', () => Buffer.alloc(0)]) {
  assert.throws(() => bindFrontendNotices(pin.provenance, payload(), replace), /Changed frontend original|Frontend notice must/); refusals++;
}
console.log('Frontend notices: all11 whole assets, 347 selected source inputs,45 distinct package roots,51 complete originals, font/source/dist limits, old optional inputs, alias isolation and '+refusals+' metadata/asset/source/original refusals pass.');
