import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const runtime = 'runtime/barkpark-944a57a1-win32-x64-full-01';
const original = JSON.parse(fs.readFileSync('.git/c098-language-byte-provenance.json', 'utf8'));
const audit = JSON.parse(fs.readFileSync('docs/third-party/windows-runtime-inputs/944a57a1-01/audit/audit.json', 'utf8'));
function chunks(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 4).toString() !== 'FOR1' || b.subarray(8, 12).toString() !== 'BEAM' || b.readUInt32BE(4) !== b.length - 8) throw Error('Invalid BEAM');
  let at = 12; const out = {};
  while (at + 8 <= b.length) {
    const id = b.subarray(at, at + 4).toString(), bytes = b.readUInt32BE(at + 4);
    if (out[id] || at + 8 + bytes > b.length) throw Error('Invalid BEAM chunk');
    out[id] = { bytes, sha256: hash(b.subarray(at + 8, at + 8 + bytes)) };
    at += 8 + Math.ceil(bytes / 4) * 4;
  }
  if (at !== b.length) throw Error('Invalid BEAM tail');
  return out;
}
for (const file of original.beam) {
  const app = file.path.split('/')[1].replace(/-[0-9].*$/, '');
  const source = file.group === 'erlang-otp' ? path.join('C:/Users/Frikk/scoop/apps/erlang/current', file.path) : path.join('C:/Users/Frikk/scoop/apps/elixir/current/lib', app, 'ebin', path.basename(file.path));
  const a = chunks(path.join(runtime, file.path)), b = chunks(source);
  file.installedSha256 = hash(fs.readFileSync(source));
  file.retainedChunks = Object.entries(a).map(([id, value]) => ({ id, ...value, identicalInstalled: JSON.stringify(value) === JSON.stringify(b[id]) }));
  file.droppedChunks = Object.keys(b).filter(id => !a[id]);
  if (file.retainedChunks.some(c => !c.identicalInstalled)) throw Error('Changed retained chunk: ' + file.path);
}
original.nativeNif = [];
for (const file of audit.native.filter(x => /lib\/(expty|argon2_elixir)-/.test(x.path))) {
  const parts = file.path.split('/'), name = parts[1].replace(/-[0-9].*$/, '');
  const source = path.join('runtime/barkpark-944a57a1-win32-x64-01.build/prod/lib', name, ...parts.slice(2));
  if (hash(fs.readFileSync(source)) !== file.sha256) throw Error('Native build bytes differ: ' + file.path);
  original.nativeNif.push({ ...file, identicalBuild: true, buildPath: source.split(path.sep).join('/') });
}
original.limits.push('All retained BEAM chunks match installed originals; whole-file differences reflect stripping and chunk ordering, not whole-file equality. No legal completeness claim.');
const dest = 'docs/cycles/evidence/C098/notice-audit-01';
fs.writeFileSync(dest + '/language-provenance.json', JSON.stringify(original, null, 2) + '\n', { flag: 'wx' });
const dumpbin = 'C:/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC/14.50.35717/bin/Hostx64/x64/dumpbin.exe';
const native = audit.native.map(file => {
  const output = execFileSync(dumpbin, ['/nologo', '/dependents', path.resolve(runtime, file.path)], { encoding: 'utf8', maxBuffer: 4e6 });
  return { ...file, imports: [...new Set([...output.matchAll(/^\s{4,}([^\s]+\.dll)\s*$/gim)].map(m => m[1]))].sort() };
});
const names = [...new Set(native.flatMap(f => f.imports))].sort();
const msvc = names.filter(n => /^(MSVCP|MSVCR|VCRUNTIME|CONCRT)/i.test(n));
fs.writeFileSync(dest + '/pe-imports.json', JSON.stringify({ tool: dumpbin, toolSha256: hash(fs.readFileSync(dumpbin)), files: native, distinctImports: names, msvcImports: msvc, limits: ['Static PE import inventory only; delay/runtime-loaded dependencies and complete redistribution requirements remain separate', 'No system DLL is copied and no clean-machine or dependency completeness is claimed'] }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ languageBeamFiles: original.beam.length, allRetainedChunksIdentical: true, identicalOtpNativeFiles: original.native.length, identicalNifNativeFiles: original.nativeNif.length, scannedNativeBinaries: native.length, msvcImports: msvc }));
