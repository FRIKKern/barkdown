import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {inventory,sha256,unusedDestination} from '../scripts/runtime-postgres-bundle.mjs';
const base='docs/cycles/evidence/C098/', out=base+'pty-runtime-driver-review-01';
fs.mkdirSync(unusedDestination(out));
fs.copyFileSync('.git/c098-pty-runtime-driver-01.mjs',out+'/producer.mjs');
const release=path.resolve('runtime/C098 PTY Chø runtime 06');
const expected=JSON.parse(fs.readFileSync(base+'pty-runtime-overlay-01/after.json'));
assert.deepEqual(inventory(release),expected);
const native=JSON.parse(fs.readFileSync(base+'pty-runtime-native-01/result.json'));
assert.equal(native.status,'passed');assert.equal(native.argon2Verified,true);
const old=JSON.parse(fs.readFileSync(base+'driver-native-07/source/manifest.json'));
fs.mkdirSync(out+'/source');
const files=old.files.map(r=>{assert.equal(sha256(r.file),r.sha256);const dest='source/'+r.snapshot;fs.copyFileSync(r.file,out+'/'+dest);return {...r,bytes:fs.statSync(r.file).size,snapshot:dest};});
const report={status:'running',startedAt:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),release,files,limits:['Private preserving runtime overlay; no product adoption, Electron, installer or fresh visual acceptance','Synthetic fresh PostgreSQL18 data only; not a real-library migration or Mac transfer']};
const persist=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');persist();
const stdout=fs.openSync(out+'/stdout.bin','wx'),stderr=fs.openSync(out+'/stderr.bin','wx');
const child=spawn(process.execPath,['app/tests/runtime-release-windows-driver.live.mjs',release,base+'pty-runtime-driver-01'],{windowsHide:true,stdio:['ignore',stdout,stderr]});
let execution;
try{execution=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
assert.equal(execution.code,0);assert.equal(execution.signal,null);
const result=JSON.parse(fs.readFileSync(base+'pty-runtime-driver-01/result.json'));assert.equal(result.status,'passed');
assert.deepEqual(inventory(release),expected);const copied=path.join(result.root,'Carried runtime');assert.deepEqual(inventory(copied),expected);
for(const r of files)assert.equal(sha256(r.file),r.sha256);
report.status='passed';report.execution=execution;report.driverElapsedMs=result.elapsedMs;report.checks=result.checks.length;report.originalCandidateUnchanged=true;report.actualDriverCopyExact=true;report.filesUnchanged=true;
}catch(error){report.status='failed';report.error=error.message;report.execution=execution;process.exitCode=1;}
finally{fs.closeSync(stdout);fs.closeSync(stderr);report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);persist();console.log(JSON.stringify({status:report.status,error:report.error,elapsedMs:report.elapsedMs,checks:report.checks}));}
