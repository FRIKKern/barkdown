import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { verifyNpmNoticeInputs, npmOriginalsPath } from './npm-notices-windows.mjs';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-npm-notices-pin.json', import.meta.url)));
const originalRoot = new URL('../' + npmOriginalsPath + '/', import.meta.url);
const input = (packaged = false) => ({ packaged, packages: pin.packages.map(pkg => ({
  name: pkg.name, lock: structuredClone(pkg.lock), manifest: structuredClone(pkg.manifest),
  files: structuredClone(packaged ? pkg.files : pkg.installedFiles) })),
  readOriginal: file => fs.readFileSync(new URL(file, originalRoot)) });

test('installed and packaged receipts carry scoped originals with independent buffers and incomplete attribution', () => {
  for (const packaged of [false, true]) {
    const args = input(packaged), supplied = [];
    args.packages.reverse(); args.packages.forEach(pkg => pkg.files.reverse());
    args.readOriginal = file => { const b = fs.readFileSync(new URL(file, originalRoot)); supplied.push(b); return b; };
    const result = verifyNpmNoticeInputs(args);
    assert.equal(result.notices.length, 3); assert.equal(result.attribution.complete, false);
    assert.equal(result.notices.reduce((n, f) => n + f.bytes.length, 0), 12256);
    assert.equal(result.attribution.packages[1].originals[0].path, 'libraries/LICENSE');
    supplied[0].fill(0); result.attribution.packages[0].files[0].sha256 = '0'.repeat(64);
    assert.deepEqual(result.notices[0].bytes, fs.readFileSync(new URL(result.notices[0].path, originalRoot)));
    assert.deepEqual(verifyNpmNoticeInputs(input()).attribution.packages, pin.packages);
  }
});

test('changed package identities, code, metadata, missing/duplicate/extra receipts refuse before original reads', () => {
  const changes = [a => a.packages.pop(), a => a.packages[0].name = 'other',
    a => a.packages[0].manifest.version = '99.0.0', a => a.packages[1].manifest.main = './other.js',
    a => a.packages[0].files.pop(), a => a.packages[0].files.push({...a.packages[0].files[0]}),
    a => a.packages[1].files[0].sha256 = '0'.repeat(64), a => a.packages[1].files[0].bytes++,
    a => a.packages[0].files[0].path = '../private.js', a => a.packages[0].files[0].claimed = true,
    a => a.packages[0].files[0] = null];
  for (const packaged of [false, true]) for (const change of changes) {
    const args = input(packaged); change(args); let reads = 0;
    args.readOriginal = () => { reads++; throw Error('Unexpected original read'); };
    assert.throws(() => verifyNpmNoticeInputs(args), /Npm package|Npm file/); assert.equal(reads, 0);
  }
});

test('wrong publisher/version/integrity/license refuses known files', () => {
  for (const pkg of [0, 1]) for (const key of ['version', 'resolved', 'integrity', 'license']) {
    const args = input(); args.packages[pkg].lock[key] += 'changed';
    assert.throws(() => verifyNpmNoticeInputs(args), /Npm dependency lock/);
  }
});

test('changed or missing raw texts and repository-license substitution refuse', () => {
  for (const pkg of pin.packages) for (const original of pkg.originals) {
    const args = input(), read = args.readOriginal;
    args.readOriginal = file => file === original.storedPath ? Buffer.concat([read(file), Buffer.from('changed')]) : read(file);
    assert.throws(() => verifyNpmNoticeInputs(args), /Npm original differs/);
  }
  const args = input(), read = args.readOriginal;
  args.readOriginal = file => file === 'standardwebhooks-LICENSE.txt' ? fs.readFileSync(new URL('webhooks-repository-LICENSE.txt', originalRoot)) : read(file);
  assert.throws(() => verifyNpmNoticeInputs(args), /Npm original differs/);
  args.readOriginal = () => 'original text'; assert.throws(() => verifyNpmNoticeInputs(args), /Npm original must be bytes/);
});
