// A runtime folder is a checkout or a packaged release; the release's keys are derived from
// the profile's database password, stable across boots and different per profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { releaseOf, releaseSecrets, validate, RELEASE_MARK } = require('../main/local-barkpark-source');
const folder = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-release-unit-')));
test('a packaged release is recognised by its launcher and its releases folder, and names its commit', () => {
  const dir = folder();
  assert.equal(releaseOf(dir), null);
  fs.mkdirSync(path.join(dir, 'bin')); fs.writeFileSync(path.join(dir, 'bin', 'barkpark'), '#!/bin/sh\n');
  assert.equal(releaseOf(dir), null, 'a launcher alone is not a release');
  fs.mkdirSync(path.join(dir, 'releases'));
  assert.deepEqual(releaseOf(dir), { bin: path.join(dir, 'bin', 'barkpark'), upstream: null }, 'an unstamped release has no version');
  fs.writeFileSync(path.join(dir, RELEASE_MARK), JSON.stringify({ version: 1, upstream: 'a'.repeat(40) }));
  assert.equal(releaseOf(dir).upstream, 'a'.repeat(40));
  fs.writeFileSync(path.join(dir, RELEASE_MARK), JSON.stringify({ upstream: 'not-a-commit' }));
  assert.equal(releaseOf(dir).upstream, null);
  assert.equal(releaseOf('relative/path'), null);
  assert.equal(validate({ source: dir, port: 5001, pgPort: 5002 }).source, dir);
  assert.throws(() => validate({ source: folder(), port: 5001, pgPort: 5002 }), /checkout .* or a packaged Barkpark release/);
});
test('release keys are stable for one password, differ between passwords, and meet the lengths the server demands', () => {
  const one = releaseSecrets('password-one'), again = releaseSecrets('password-one'), two = releaseSecrets('password-two');
  assert.deepEqual(one, again);
  for (const key of Object.keys(one)) assert.notEqual(one[key], two[key], key);
  assert.ok(Buffer.byteLength(one.SECRET_KEY_BASE) >= 64);
  assert.equal(Buffer.from(one.BARKPARK_CLOAK_KEY, 'base64').length, 32); assert.equal(Buffer.from(one.BARKPARK_KEK, 'base64').length, 32);
  assert.ok(one.BARKPARK_RELEASE_CAPTURE_HMAC_SECRET.length >= 32); assert.ok(one.PREVIEW_JWT_SECRET.length >= 32);
  assert.equal(new Set(Object.values(one)).size, 5, 'no key is reused for another purpose');
});
