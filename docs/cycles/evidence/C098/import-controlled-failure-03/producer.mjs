import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { auditWindowsImports } from '../scripts/audit-windows-imports.mjs';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const out = 'docs/cycles/evidence/C098/import-controlled-failure-03';
fs.mkdirSync(out, { recursive: false });
fs.copyFileSync(fileURLToPath(import.meta.url), out + '/producer.mjs', fs.constants.COPYFILE_EXCL);
const original = path.resolve('runtime/C098 PE controlled corrupt Chø 01/corrupt.dll'), before = sha(original);
assert.throws(() => auditWindowsImports({ bundle: path.dirname(original), dumpbin: 'C:/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC/14.50.35717/bin/Hostx64/x64/dumpbin.exe', output: out + '/malformed-refusal' }), /Incomplete PE image headers/);
assert.equal(fs.existsSync(out + '/malformed-refusal'), false);
assert.equal(sha(original), before);
// Fault injection uses a byte-identical, explicitly labelled copy of where.exe.
// It rejects dumpbin's arguments; no forged executable or installer is executed.
const fixture = path.resolve('runtime/C098 PE controlled command Chø 03');
fs.mkdirSync(fixture, { recursive: false });
for (const name of ['bundle', 'tools']) fs.mkdirSync(path.join(fixture, name));
const candidate = path.join(fixture, 'bundle', 'probe.dll');
const source = path.resolve('app/release/C098 Packaged Chø 02/win-unpacked/resources/runtime/postgres/lib/citext.dll');
const faultSource = path.join(process.env.SystemRoot, 'System32', 'where.exe'), faultTool = path.join(fixture, 'tools', 'dumpbin.exe');
fs.copyFileSync(source, candidate, fs.constants.COPYFILE_EXCL);
fs.copyFileSync(faultSource, faultTool, fs.constants.COPYFILE_EXCL);
const result = auditWindowsImports({ bundle: path.dirname(candidate), dumpbin: faultTool, output: out + '/audit' });
assert.equal(result.status, 'failed'); assert.equal(result.distributionReady, false);
assert.equal(result.candidateCount, 1); assert.equal(result.files.length, 0); assert.ok(result.failure);
const raw = fs.readdirSync(out + '/audit/raw');
assert.equal(raw.length, 2); assert.equal(result.failure.exitCode, 2);
assert.equal(sha(source), sha(candidate)); assert.equal(sha(faultSource), sha(faultTool));
const reportHash = sha(out + '/audit/imports.json'), rawHash = sha(out + '/audit/raw/' + raw[0]);
assert.throws(() => auditWindowsImports({ bundle: path.dirname(candidate), dumpbin: faultTool, output: out + '/audit' }), /Output already exists/);
assert.equal(sha(out + '/audit/imports.json'), reportHash); assert.equal(sha(out + '/audit/raw/' + raw[0]), rawHash);
fs.writeFileSync(out + '/result.json', JSON.stringify({ status: 'passed-controlled-refusal', elapsedMs: result.elapsedMs,
  malformedHeaderRefused: true, malformedBytesUnchanged: true, originalToolFailureRetained: true, outputReuseRefused: true,
  fixture, faultTool: { original: faultSource, sha256: sha(faultTool), kind: 'where.exe copy used only as explicit command-failure injection, not actual dumpbin' },
  source: { path: source, sha256: sha(source) }, failure: result.failure }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed-controlled-refusal', elapsedMs: result.elapsedMs }));
