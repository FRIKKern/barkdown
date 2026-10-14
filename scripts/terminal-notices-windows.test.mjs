import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { verifyTerminalNoticeInputs, terminalOriginalsPath } from './terminal-notices-windows.mjs';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-terminal-notices-pin.json', import.meta.url)));
const originals = new URL('../' + terminalOriginalsPath + '/', import.meta.url);
const input = () => ({ lock: structuredClone(pin.lock),
  manifest: { name: pin.component, version: pin.lock.version, license: pin.lock.license },
  nativeInventory: structuredClone(pin.native), readOriginal: file => fs.readFileSync(new URL(file, originals)) });

test('sealed native receipts and original raw texts retain independent buffers and attribution', () => {
  const args = input(), supplied = [];
  args.nativeInventory.reverse();
  args.readOriginal = file => { const bytes = fs.readFileSync(new URL(file, originals)); supplied.push(bytes); return bytes; };
  const result = verifyTerminalNoticeInputs(args);
  assert.equal(result.notices.length, 4); assert.equal(result.attribution.native.length, 22);
  assert.equal(result.attribution.complete, false);
  supplied[0].fill(0); result.attribution.native[0].sha256 = '0'.repeat(64);
  assert.deepEqual(result.notices[0].bytes, fs.readFileSync(new URL(result.notices[0].path, originals)));
  assert.equal(verifyTerminalNoticeInputs(input()).attribution.native[0].sha256, pin.native[0].sha256);
});

test('unknown, missing, duplicate and altered native receipts refuse before any notice read', () => {
  const changes = [a => a.nativeInventory.pop(), a => a.nativeInventory.push({...a.nativeInventory[0]}),
    a => a.nativeInventory[0].path = '../private.dll', a => a.nativeInventory[0].sha256 = '0'.repeat(64),
    a => a.nativeInventory[0].bytes++, a => a.nativeInventory[0].claimed = true,
    a => a.nativeInventory[0] = null];
  for (const change of changes) {
    const args = input(); change(args); let reads = 0;
    args.readOriginal = () => { reads++; throw Error('Unexpected notice read'); };
    assert.throws(() => verifyTerminalNoticeInputs(args), /Terminal native/); assert.equal(reads, 0);
  }
});

test('altered lock or package identity cannot borrow the known native roster', () => {
  for (const change of [a => a.lock.version = '99.0.0', a => a.lock.integrity += 'changed',
    a => a.lock.resolved = 'https://example.invalid/fake.tgz', a => a.manifest.name = 'borrowed-package',
    a => a.manifest.license = 'changed']) {
    const args = input(); change(args);
    assert.throws(() => verifyTerminalNoticeInputs(args), /Terminal dependency|Terminal package/);
  }
});

test('changed, missing, normalized or aliased original texts cannot become carried originals', () => {
  for (const target of pin.originals) {
    const args = input(), read = args.readOriginal;
    args.readOriginal = file => { const bytes = read(file); return file === target.path ? Buffer.concat([bytes, Buffer.from('changed')]) : bytes; };
    assert.throws(() => verifyTerminalNoticeInputs(args), /Terminal original differs/);
  }
  const args = input(), read = args.readOriginal;
  args.readOriginal = file => file === 'console.LICENSE' ? Buffer.from(read(file).toString().replaceAll('\r\n', '\n')) : read(file);
  assert.throws(() => verifyTerminalNoticeInputs(args), /Terminal original differs/);
  args.readOriginal = () => 'text without original bytes';
  assert.throws(() => verifyTerminalNoticeInputs(args), /Terminal original must be bytes/);
});
