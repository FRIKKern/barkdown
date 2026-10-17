import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { verifyGnuSourceInputs, gnuOriginalsPath } from './prepare-gnu-sources.mjs';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-gnu-source-pin.json', import.meta.url)));
const originals = new URL('../' + gnuOriginalsPath + '/', import.meta.url);
const input = () => ({ provenance: JSON.parse(fs.readFileSync(new URL('provenance.json', originals))),
  archiveInventory: structuredClone(pin.sources.map(source => source.archive)),
  nativeInventory: structuredClone(pin.native.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))),
  markerInventory: [structuredClone(pin.postgresMarker)],
  readOriginal: file => fs.readFileSync(new URL(file, originals)) });

test('reviewed receipts/originals retain scoped attribution and isolate returned buffers/policy', () => {
  const args = input(), supplied = []; args.provenance.sources.reverse(); args.archiveInventory.reverse(); args.nativeInventory.reverse();
  args.readOriginal = file => { const bytes = fs.readFileSync(new URL(file, originals)); supplied.push(bytes); return bytes; };
  const result = verifyGnuSourceInputs(args); assert.equal(result.notices.length, 15); assert.equal(result.attribution.complete, false);
  assert(result.attribution.native.every(file => file.compiledSourceRevision === null && file.originalSourceVersion));
  supplied[0].fill(0); result.attribution.sources[0].archive.sha256 = '0'.repeat(64); result.attribution.limits.length = 0;
  assert.deepEqual(result.notices[0].bytes, fs.readFileSync(new URL(result.notices[0].path, originals)));
  assert.deepEqual(verifyGnuSourceInputs(input()).attribution.sources, pin.sources);
  assert.deepEqual(verifyGnuSourceInputs(input()).attribution.limits, pin.limits);
});

test('changed/unknown/duplicate/malformed source/archive/native receipts refuse before original reads', () => {
  const changes = [a => a.archiveInventory.pop(), a => a.archiveInventory.push({...a.archiveInventory[0]}),
    a => a.archiveInventory[0].path = '../borrowed.tar.gz', a => a.archiveInventory[0].sha256 = '0'.repeat(64),
    a => a.archiveInventory[0].bytes++, a => a.archiveInventory[0].claimed = true, a => a.archiveInventory[0] = null,
    a => a.nativeInventory[0].sha256 = '0'.repeat(64), a => a.nativeInventory[0].path = 'other.dll',
    a => a.nativeInventory.pop(), a => a.nativeInventory.push({...a.nativeInventory[0]}),
    a => a.provenance.sources[0].version = '1.19', a => a.provenance.sources[0].url = 'https://example.invalid',
    a => a.provenance.sources[0].files[0].sha256 = '0'.repeat(64), a => a.provenance.sources.push({...a.provenance.sources[0]}),
    a => a.provenance.sources[0] = null, a => a.provenance.distributionReady = true];
  for (const change of changes) { const args = input(); change(args); let reads = 0;
    args.readOriginal = () => { reads++; throw Error('Unexpected original read'); };
    assert.throws(() => verifyGnuSourceInputs(args), /GNU (?:source|archive|native|provenance)/); assert.equal(reads, 0); }
});

test('a changed or absent package marker refuses before any original read', () => {
  for (const change of [a => a.markerInventory[0].sha256 = '0'.repeat(64), a => a.markerInventory = []]) {
    const args = input(); change(args); let reads = 0;
    args.readOriginal = () => { reads++; throw Error('Unexpected original read'); };
    assert.throws(() => verifyGnuSourceInputs(args), /GNU package marker/); assert.equal(reads, 0);
  }
});

test('missing, changed and newline-normalized original notices cannot be carried', () => {
  for (const original of pin.sources.flatMap(source => source.originals)) {
    const args = input(), read = args.readOriginal;
    args.readOriginal = file => file === original.path ? Buffer.concat([read(file), Buffer.from('changed')]) : read(file);
    assert.throws(() => verifyGnuSourceInputs(args), /GNU original differs/);
  }
  const args = input(); args.readOriginal = () => 'text'; assert.throws(() => verifyGnuSourceInputs(args), /GNU original must be bytes/);
  const normalized = input(), read = normalized.readOriginal, target = pin.sources[0].originals[0].path;
  normalized.readOriginal = file => {
    const bytes = read(file); if (file !== target) return bytes;
    const text = bytes.toString('utf8'), changed = Buffer.from(text.includes('\r\n') ? text.replaceAll('\r\n', '\n') : text.replaceAll('\n', '\r\n'));
    assert.notDeepEqual(changed, bytes); return changed;
  };
  assert.throws(() => verifyGnuSourceInputs(normalized), /GNU original differs/);
});
