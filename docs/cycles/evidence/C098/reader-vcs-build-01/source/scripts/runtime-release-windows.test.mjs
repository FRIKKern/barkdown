import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { batchPath, releaseInput } from './build-runtime-release-windows.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const character of ['%', '!', '"', '&', '|', '<', '>', '^', '\n', '\r']) assert.throws(()=>batchPath('C:/fixture'+character+'payload'),/Unsupported batch path/);
assert.equal(batchPath('a spaced path'),path.resolve('a spaced path'));
const checkout = fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-release-test-'));
fs.mkdirSync(path.join(checkout,'api'));
fs.writeFileSync(path.join(checkout,'api/mix.exs'),'fixture');
execFileSync('git',['init'],{cwd:checkout,stdio:'ignore'});
execFileSync('git',['add','.'],{cwd:checkout,stdio:'ignore'});
execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:checkout,stdio:'ignore'});
assert.throws(()=>releaseInput(checkout,path.join(checkout,'out')),/must match/);
assert.equal(fs.existsSync(path.join(checkout,'out')),false);
// Use the pinned checkout only for refusal checks: no dependency build or mutation occurs.
const pinned = path.resolve(root,'../barkpark-windows-return');
if (fs.existsSync(pinned) && execFileSync('git',['rev-parse','HEAD'],{cwd:pinned,encoding:'utf8'}).trim() === fs.readFileSync(path.join(root,'app/BARKPARK_REF'),'utf8').trim()) {
  const out=path.join(checkout,'existing');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'retained'),'failed attempt');
  assert.throws(()=>releaseInput(pinned,out),/already exists/);
  assert.equal(fs.readFileSync(path.join(out,'retained'),'utf8'),'failed attempt');
  const second=path.join(checkout,'fresh');fs.mkdirSync(second+'.build');
  assert.throws(()=>releaseInput(pinned,second),/already exists/);
  assert.equal(fs.existsSync(second),false);
}
console.log('Windows release shell-path, source-pin and output-preservation checks pass');
