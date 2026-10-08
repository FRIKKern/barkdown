import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { auditWindowsNotices } from './audit-runtime-notices-windows.mjs';
import { parseDependents, peArchitecture, classifyImports, auditWindowsImports } from './audit-windows-imports.mjs';

// macOS commonly aliases /var to /private/var. Use the real temp parent so the
// deliberate junction refusal tests the fixture link, not the host's temp spelling.
const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'barkdown-notices-Chø-'));
const runtime = path.join(fixture, 'runtime'), checkout = path.join(fixture, 'checkout'), provenance = path.join(fixture, 'texts');
const write = (p, bytes) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, bytes); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
write(path.join(checkout, 'api/mix.lock'), 'fixture lock\n');
write(path.join(checkout, 'LICENSE'), 'Original upstream copyright\r\nLicense fixture\r\n');
write(path.join(checkout, 'api/deps/example/hex_metadata.config'), '{<<"name">>,<<"example">>}.\n{<<"version">>,<<"1.0.0">>}.\n{<<"GitHub">>,<<"https://github.com/fixture/example">>}.\n');
execFileSync('git', ['init'], { cwd: checkout, stdio: 'ignore' });
execFileSync('git', ['add', '.'], { cwd: checkout, stdio: 'ignore' });
execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'], { cwd: checkout, stdio: 'ignore' });
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const release = { platform: 'win32', arch: 'x64', upstream, mixLockSha256: sha(fs.readFileSync(path.join(checkout, 'api/mix.lock'))), postgres: { licenses: ['license.txt'], sourceUrl: 'https://example.invalid/pinned.zip', sourceSha256: 'f'.repeat(64) } };
write(path.join(runtime, 'barkdown-release.json'), JSON.stringify(release));
write(path.join(runtime, 'lib/example-1.0.0/ebin/example.beam'), 'fixture beam');
write(path.join(runtime, 'lib/barkpark-0.1.0/ebin/barkpark.beam'), 'fixture private beam');
write(path.join(runtime, 'postgres/license.txt'), 'Original vendor copyright\r\nTerms\r\n');
write(path.join(runtime, 'postgres/bin/postgres.exe'), Buffer.from([0, 1, 2, 3]));
const original = Buffer.from('Original package authors\r\nUnchanged license declaration\r\n');
write(path.join(provenance, 'example-README.md'), original);
const source = { name: 'example', version: '1.0.0', repo: 'fixture/example', commit: 'a'.repeat(40), tag: 'v1.0.0', files: [{ path: 'example-README.md', sha256: sha(original), bytes: original.length, url: 'https://raw.githubusercontent.com/fixture/example/' + 'a'.repeat(40) + '/README.md' }] };
const saveSource = row => write(path.join(provenance, 'result.json'), JSON.stringify({ results: [row] }));
saveSource(source);
const options = output => ({ runtime, checkout, provenance, output: path.join(fixture, output) });
const report = auditWindowsNotices(options('audit'));
assert.equal(report.distributionReady, false);
assert.equal(report.status, 'incomplete-preparation');
assert.equal(report.native.length, 1);
assert.equal(report.applications.length, 2);
assert.ok(report.gaps.some(g => g.component === 'native/static code'));
assert.deepEqual(fs.readFileSync(path.join(fixture, 'audit/licenses/retained/example-README.md')), original);
assert.deepEqual(fs.readFileSync(path.join(provenance, 'example-README.md')), original);
assert.throws(() => auditWindowsNotices(options('audit')), /already exists/);
assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'audit/audit.json'), 'utf8')).distributionReady, false);
saveSource({ ...source, tag: 'main' });
assert.throws(() => auditWindowsNotices(options('branch')), /exact version tag/);
assert.equal(fs.existsSync(path.join(fixture, 'branch')), false);
saveSource({ ...source, files: [{ ...source.files[0], url: 'https://raw.githubusercontent.com/fixture/example/main/README.md' }] });
assert.throws(() => auditWindowsNotices(options('mutable')), /immutable commit/);
saveSource(source);
write(path.join(provenance, 'example-README.md'), 'changed text');
assert.throws(() => auditWindowsNotices(options('tampered')), /Changed retained/);
write(path.join(provenance, 'example-README.md'), original);
saveSource({ ...source, files: [{ ...source.files[0], path: '../outside.txt' }] });
assert.throws(() => auditWindowsNotices(options('escape')), /Unsafe relative/);
saveSource({ ...source, repo: 'other/example', files: [{ ...source.files[0], url: 'https://raw.githubusercontent.com/other/example/' + source.commit + '/README.md' }] });
assert.throws(() => auditWindowsNotices(options('wrong-repo')), /package repository/);
saveSource(source);
write(path.join(runtime, 'barkdown-release.json'), JSON.stringify({ ...release, mixLockSha256: 'b'.repeat(64) }));
assert.throws(() => auditWindowsNotices(options('wrong-lock')), /Lock does not match/);
write(path.join(runtime, 'barkdown-release.json'), JSON.stringify(release));
fs.symlinkSync(runtime, path.join(fixture, 'linked-runtime'), process.platform === 'win32' ? 'junction' : 'dir');
assert.throws(() => auditWindowsNotices({ ...options('linked'), runtime: path.join(fixture, 'linked-runtime') }), /Linked input/);
saveSource({ ...source, files: [] });
const missing = auditWindowsNotices(options('missing'));
assert.equal(missing.distributionReady, false);
assert.ok(missing.gaps.some(g => g.component === 'example'));
console.log('Windows notice preparation: exact tags/commits, original bytes, missing provenance, lock/repository/tamper/escape/link refusals and existing output preservation passed.');

// The previous DLL-only regex dropped real postgres.exe, WINSPOOL.DRV and
// bthprops.cpl imports. Preserve both loader stages, including non-DLL names.
const dump = `Dump of file fixture.exe

File Type: EXECUTABLE IMAGE

  Image has the following dependencies:

    postgres.exe
    VCRUNTIME140.dll

  Image has the following delay load dependencies:

    WINSPOOL.DRV
    bthprops.cpl
    VCRUNTIME140.dll

  Summary

        1000 .data
`;
assert.deepEqual(parseDependents(dump.replaceAll('\n', '\r\n')), {
  direct: ['VCRUNTIME140.dll', 'postgres.exe'], delayed: ['VCRUNTIME140.dll', 'WINSPOOL.DRV', 'bthprops.cpl']
});
assert.throws(() => parseDependents('unknown tool output'), /Unrecognized/);
assert.throws(() => parseDependents(dump.replace('  Summary', '  Incomplete')), /incomplete/);
assert.throws(() => parseDependents(dump.replace('postgres.exe', '../postgres.exe')), /Unrecognized import/);
assert.throws(() => parseDependents(dump.replace('    postgres.exe', 'unexpected import format')), /Unrecognized import/);
assert.deepEqual(parseDependents('File Type: DLL\n\n  Summary\n'), { direct: [], delayed: [] });
const image = Buffer.alloc(128);
image.write('MZ'); image.writeUInt32LE(64, 0x3c); image.writeUInt32LE(0x4550, 64); image.writeUInt16LE(0x8664, 68);
assert.equal(peArchitecture(image), 'x64');
image.writeUInt16LE(0xaa64, 68); assert.equal(peArchitecture(image), 'arm64');
image.writeUInt16LE(0x14c, 68); assert.equal(peArchitecture(image), 'x86');
image.writeUInt16LE(0xffff, 68); assert.throws(() => peArchitecture(image), /Unsupported PE machine/);
image.writeUInt32LE(120, 0x3c); assert.throws(() => peArchitecture(image), /Invalid PE header/);
assert.throws(() => peArchitecture(Buffer.from('MZ')), /complete DOS header/);
const classified = classifyImports([
  { path: 'runtime/lib/probe.dll', arch: 'x64', sha256: 'a'.repeat(64), imports: { direct: ['POSTGRES.EXE', 'VCRUNTIME140.dll', 'KERNEL32.dll', 'api-ms-win-crt-heap-l1-1-0.dll'], delayed: ['ucrtbased.dll', 'MSVCRTD.dll', 'winpty.dll'] } },
  { path: 'runtime/bin/postgres.exe', arch: 'x64', sha256: 'b'.repeat(64), imports: { direct: [], delayed: [] } },
  { path: 'other-arch/winpty.dll', arch: 'arm64', sha256: 'c'.repeat(64), imports: { direct: [], delayed: [] } }
]);
const dependency = name => classified.find(row => row.name === name);
assert.equal(dependency('postgres.exe').category, 'packaged-candidate');
assert.equal(dependency('postgres.exe').lackingSameArchitectureCandidate.length, 0);
assert.equal(dependency('winpty.dll').lackingSameArchitectureCandidate.length, 1);
assert.equal(dependency('vcruntime140.dll').category, 'visual-c-runtime');
assert.equal(dependency('ucrtbased.dll').category, 'forbidden-debug-crt');
assert.equal(dependency('msvcrtd.dll').category, 'forbidden-debug-crt');
assert.equal(dependency('kernel32.dll').category, 'external-unclassified');
assert.equal(dependency('api-ms-win-crt-heap-l1-1-0.dll').category, 'windows-api-set');
assert.equal(dependency('winpty.dll').importers[0].kind, 'delayed');
assert.throws(() => auditWindowsImports({ bundle: runtime, dumpbin: 'missing-tool', output: options('audit').output }), /Output already exists/);
assert.throws(() => auditWindowsImports({ bundle: path.join(fixture, 'linked-runtime'), dumpbin: 'missing-tool', output: path.join(fixture, 'pe-link-refusal') }), /Linked audit input/);
assert.equal(fs.existsSync(path.join(fixture, 'pe-link-refusal')), false);
assert.deepEqual(fs.readFileSync(path.join(options('audit').output, 'licenses/retained/example-README.md')), original);
console.log('Windows PE prerequisites: ordinary/delayed non-DLL imports, architecture and malformed-output refusals, candidate-only classification, Debug CRT, linked inputs and output preservation passed.');
