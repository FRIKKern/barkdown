import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { programs, licenses, copyWindowsPayload, attachPostgres, unusedDestination, sha256 } from './runtime-postgres-bundle.mjs';
import { checkArchive } from './build-runtime-postgres-windows.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-pg-bundle-test-'));
const put = (file, bytes = 'fixture') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const source = path.join(root, 'archive');
for (const name of [...programs.map(n => `bin/${n}.exe`), ...licenses, 'bin/libpq.dll', 'bin/icu.dll', 'bin/unused.exe', 'data/private', 'server.log', ...['citext','pg_trgm','pgcrypto'].flatMap(n => [`lib/${n}.dll`, `share/extension/${n}.control`, `share/extension/${n}--1.0.sql`])]) put(path.join(source, name), name);
const output = path.join(root, 'new bundle');
const files = copyWindowsPayload(source, output);
assert.equal(fs.readFileSync(path.join(output, 'bin/icu.dll'), 'utf8'), 'bin/icu.dll');
for (const n of ['bin/unused.exe', 'data', 'server.log']) assert.equal(fs.existsSync(path.join(output,n)), false);
for (const name of licenses) assert.ok(files.some(f => f.path === name && f.sha256 === sha256(path.join(source,name))));
assert.ok(files.some(f => f.path === 'share/extension/pgcrypto--1.0.sql'));
assert.throws(() => copyWindowsPayload(source, output), /already exists/);
assert.equal(fs.readFileSync(path.join(output, 'bin/icu.dll'), 'utf8'), 'bin/icu.dll');
const invalidArchive = path.join(root, 'wrong.zip'); put(invalidArchive);
assert.throws(() => checkArchive(invalidArchive), /SHA256/);
fs.renameSync(path.join(source, licenses[0]), path.join(source, 'retained-license'));
const invalidOutput = path.join(root, 'missing-license');
assert.throws(() => copyWindowsPayload(source, invalidOutput), /ENOENT|missing/);
assert.equal(fs.existsSync(invalidOutput), false);

// Junctions work on Windows without developer-mode symlink privileges.
const link = path.join(root, 'linked');
fs.symlinkSync(output, link, process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => unusedDestination(path.join(link, 'nested', 'output')), /link/);
assert.throws(() => unusedDestination(link), /already exists/);
const dangling = path.join(root, 'dangling');
fs.symlinkSync(path.join(root, 'absent'), dangling, process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => unusedDestination(dangling), /already exists/);

const mark = (dir, name, platform, arch = 'x64') => put(path.join(dir, name), JSON.stringify({ version: 1, platform, arch }));
mark(output, 'barkdown-postgres.json', 'win32');
put(path.join(output, 'bin/unused.exe'));
const release = path.join(root, 'Windows release'); mark(release, 'barkdown-release.json', 'win32');
const attached = attachPostgres(release, output);
assert.equal(fs.readFileSync(path.join(attached, 'bin/icu.dll'), 'utf8'), 'bin/icu.dll');
assert.equal(fs.existsSync(path.join(attached, 'bin/unused.exe')), false);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(release, 'barkdown-release.json'))).postgres.programs, programs);
assert.throws(() => attachPostgres(release, output), /already exists/);
for (const [platform, arch] of [['darwin', 'x64'], ['win32','arm64']]) {
  const mismatch = path.join(root, platform + arch); mark(mismatch, 'barkdown-release.json', platform, arch);
  assert.throws(() => attachPostgres(mismatch, output), /does not match/);
  assert.equal(fs.existsSync(path.join(mismatch, 'postgres')), false);
}
const mac = path.join(root, 'mac'); mark(mac, 'barkdown-postgres.json', 'darwin');
const invalidMark = path.join(root, 'invalid-mark');
mark(invalidMark, 'barkdown-release.json', 'win32');
put(path.join(invalidMark, 'barkdown-release.json'), JSON.stringify({ platform: 'win32', arch: 'x64' }));
assert.throws(() => attachPostgres(invalidMark, output), /Unsupported runtime metadata/);
assert.equal(fs.existsSync(path.join(invalidMark, 'postgres')), false);
for (const name of [...programs, 'unused']) put(path.join(mac, 'bin',name));
put(path.join(mac, 'lib/libpq.dylib'));
const macRelease = path.join(root, 'mac-release'); mark(macRelease, 'barkdown-release.json', 'darwin');
const macAttached = attachPostgres(macRelease, mac);
assert.equal(fs.existsSync(path.join(macAttached, 'bin/unused')), false);
assert.equal(fs.existsSync(path.join(macAttached, 'lib/libpq.dylib')), true);
console.log(JSON.stringify({ status: 'passed', retainedFixtures: root, coverage: ['archive hash refusal','license refusal before output','existing and linked output preservation','no data/log copy','Windows DLLs and extension resources','platform and arch refusal','Mac attachment regression'] }));
