import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createCredentialDurability } = require('../main/credential-durability');
function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-key-gate-'));
  const file = path.join(root, 'Local State');
  const write = () => fs.writeFileSync(file, JSON.stringify({ os_crypt: { encrypted_key: Buffer.concat([Buffer.from('DPAPI'), Buffer.alloc(32)]).toString('base64') } }));
  const gate = createCredentialDurability({ safeStorage: { isEncryptionAvailable: () => true }, sessionData: () => root, platform: 'win32', ...options });
  return { root, file, write, gate };
}
test('new ciphertext cannot be saved until actual protected key appears and is synced', async () => {
  let rounds = 0, syncs = 0, f;
  f = fixture({ delay: async () => { if (++rounds === 3) f.write(); }, io: { ...fs, fsyncSync(fd) { syncs++; fs.fsyncSync(fd); } } });
  assert.throws(() => f.gate.assertReady(), /not ready/);
  await Promise.all([f.gate.prepare(), f.gate.prepare()]);
  assert.equal(rounds, 3); assert.equal(syncs, 1); f.gate.assertReady();
});
test('missing file never becomes success from elapsed time', async () => {
  let clock = 0;
  const f = fixture({ now: () => clock, timeoutMs: 20, delay: async () => { clock += 10; } });
  await assert.rejects(f.gate.prepare(), /not reached disk/);
  assert.throws(() => f.gate.assertReady(), /not ready/);
  f.write(); await f.gate.prepare(); f.gate.assertReady();
});
test('malformed key, sync failure and unavailable encryption refuse readiness', async () => {
  const malformed = fixture(); fs.writeFileSync(malformed.file, '{}');
  await assert.rejects(malformed.gate.prepare(), /protected key/);
  assert.throws(() => malformed.gate.assertReady(), /not ready/);
  const failed = fixture({ io: { ...fs, fsyncSync() { throw new Error('flush failed'); } } }); failed.write();
  await assert.rejects(failed.gate.prepare(), /flush failed/);
  assert.throws(() => failed.gate.assertReady(), /not ready/);
  const unavailable = fixture({ safeStorage: { isEncryptionAvailable: () => false } }); unavailable.write();
  await assert.rejects(unavailable.gate.prepare(), /unavailable/);
});
test('atomic replacement during flush must verify the current file on another pass', async () => {
  let replacements = 0, rounds = 0, f;
  f = fixture({ delay: async () => { rounds++; }, io: { ...fs, fsyncSync(fd) {
    fs.fsyncSync(fd);
    if (!replacements++) { fs.renameSync(f.file, f.file + '.old'); f.write(); }
  } } }); f.write();
  await f.gate.prepare(); assert.equal(rounds, 1); assert.equal(replacements, 2);
});
test('later saves revalidate persistence instead of relying on cached readiness', async () => {
  const f = fixture(); f.write(); await f.gate.prepare();
  fs.writeFileSync(f.file, '{}');
  await assert.rejects(f.gate.prepare(), /protected key/);
  assert.throws(() => f.gate.assertReady(), /not ready/);
});
test('truncated or malformed tagged blobs fail closed, including an existing file without a key', async () => {
  for (const key of [undefined, 'RFBBUEk=', Buffer.from('DPAPIshort').toString('base64'), 'not base64!', Buffer.alloc(64).toString('base64')]) {
    const f = fixture();
    fs.writeFileSync(f.file, JSON.stringify({ os_crypt: { encrypted_key: key } }));
    await assert.rejects(f.gate.prepare(), /protected key/);
    assert.throws(() => f.gate.assertReady(), /not ready/);
  }
});
