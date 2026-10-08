// A runtime folder is a checkout or a packaged release; the release's keys are derived from
// the profile's database password, stable across boots and different per profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SourceDriver, toolchain, releaseOf, releaseSecrets, validate, RELEASE_MARK } = require('../main/local-barkpark-source');
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

test('Windows releases require matching metadata and carried PostgreSQL, never developer tools', {skip:process.platform !== 'win32'}, () => {
  const dir=folder(), put=(name,content='fixture')=>{fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),content);};
  put('bin/barkpark.bat');fs.mkdirSync(path.join(dir,'releases'));
  assert.equal(releaseOf(dir),null);
  const mark={version:1,platform:'win32',arch:process.arch,upstream:'a'.repeat(40),erts:'erts-16.4'};
  put(RELEASE_MARK,JSON.stringify(mark));assert.equal(releaseOf(dir),null,'carried Erlang must exist');
  put('erts-16.4/bin/erl.exe');assert.equal(releaseOf(dir).upstream,mark.upstream);
  assert.throws(()=>new SourceDriver({source:dir,port:5401,pgPort:5402},folder(),{}),/carried PostgreSQL/);
  const postgres={version:1,platform:'win32',arch:process.arch,postgres:'18.4'};
  put(RELEASE_MARK,JSON.stringify({...mark,postgres}));put('postgres/bin/pg_ctl.exe');put('postgres/bin/initdb.exe');
  const config={source:dir,port:5401,pgPort:5402,pgBin:'C:/ignored-developer-tools'};
  assert.equal(toolchain(config).pgBin,path.join(dir,'postgres/bin'));assert.equal(toolchain(config).mix,null);
  assert.deepEqual(releaseOf(dir).postgres,postgres);
  const driver=new SourceDriver(config,folder(),{});fs.mkdirSync(driver.pgData);fs.writeFileSync(path.join(driver.pgData,'PG_VERSION'),'17\n');
  assert.throws(()=>driver.assertDatabaseCompatible(),{code:'runtime_database_major'});assert.equal(fs.readFileSync(path.join(driver.pgData,'PG_VERSION'),'utf8'),'17\n');
  for(const invalid of [{platform:'darwin'},{arch:'wrong'},{version:2},{erts:'../escape'},{upstream:'invalid'}]) {
    put(RELEASE_MARK,JSON.stringify({...mark,postgres,...invalid}));assert.equal(releaseOf(dir),null);
  }
  put(RELEASE_MARK,JSON.stringify({...mark,postgres:{...postgres,platform:'darwin'}}));
  assert.throws(()=>new SourceDriver(config,folder(),{}),/carried PostgreSQL/);
});
