import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const out='.git/c098-crt-symbol-preflight-01';fs.mkdirSync(out);
const scan=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/import-scan-06/audit/imports.json'));
const minimum=JSON.parse(fs.readFileSync('.git/c098-crt-minimum-files-01/result.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(scan.tool.path)),scan.tool.sha256);
const samples=[{operation:'imports',file:path.join(scan.bundle,scan.dependencies.find(d=>d.name==='msvcp140.dll').importers[0].path)},...minimum.files.filter(f=>['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll'].includes(f.name)).map(f=>({operation:'exports',file:path.resolve('.git/c098-crt-minimum-files-01',f.name)}))];
const rows=[];
for(const [i,row] of samples.entries()){
 const before=sha(fs.readFileSync(row.file)),start=Date.now();
 const result=spawnSync(scan.tool.path,['/nologo','/'+row.operation,row.file],{windowsHide:true,timeout:10000,maxBuffer:8e6});
 for(const s of ['stdout','stderr'])fs.writeFileSync(out+'/'+i+'-'+s+'.txt',result[s]||Buffer.alloc(0),{flag:'wx'});
 const after=sha(fs.readFileSync(row.file));
 rows.push({...row,before,after,elapsedMs:Date.now()-start,exitCode:result.status,error:result.error?String(result.error):null});
 assert.equal(result.status,0);assert.equal(before,after);
}
fs.copyFileSync('.git/c098-crt-symbol-preflight-01.mjs',out+'/producer.mjs');
fs.writeFileSync(out+'/result.json',JSON.stringify({observedAt:new Date().toISOString(),tool:scan.tool,rows},null,2)+'\n');
console.log(JSON.stringify(rows));
