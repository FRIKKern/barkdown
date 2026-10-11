import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,execFileSync} from 'node:child_process';
const bundle=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked'),out=path.resolve('docs/cycles/evidence/C098/packaged-terminal-06');
fs.mkdirSync(out);const worker=path.resolve('.git/c098-packaged-terminal-worker-04.cjs');fs.copyFileSync(worker,path.join(out,'producer.cjs'));
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown Terminal Chø '))),store=path.join(root,'receipts'),folder=path.join(root,'working');fs.mkdirSync(store);fs.mkdirSync(folder);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=['Barkdown.exe','resources/app.asar','resources/app.asar.unpacked/main/goal-worker-host.ps1','resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/conpty.node'];
const before=files.map(file=>({file,sha256:hash(path.join(bundle,file))}));assert.equal(before[0].sha256,'4ab9c0100a23c8d0f0286f406eb02fcc58e0ff1b583291a096c23b00ac381a94');assert.equal(before[1].sha256,'4038182a43da8a9acd70f94f0be64c815acbf0e6c57cfe86c2e8822b51869635');
const env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];env.PATH=[path.join(env.SystemRoot,'System32'),env.SystemRoot,path.join(env.SystemRoot,'System32','WindowsPowerShell','v1.0')].join(';');env.ELECTRON_RUN_AS_NODE='1';
const report={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),bundle,root,inputs:before,producerSha256:hash(worker),limits:['Native service preparation only, not Electron GUI or distribution acceptance']};
fs.copyFileSync(new URL(import.meta.url),path.join(out,'driver.mjs'));const persist=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');persist();
const start=performance.now(),r=spawnSync(path.join(bundle,'Barkdown.exe'),[worker,bundle,out,store,folder],{env,windowsHide:true,timeout:110000,maxBuffer:2*1024*1024});
fs.writeFileSync(path.join(out,'stdout.bin'),r.stdout||Buffer.alloc(0));fs.writeFileSync(path.join(out,'stderr.bin'),r.stderr||Buffer.alloc(0));
report.exitCode=r.status;report.signal=r.signal;report.elapsedMs=Math.round(performance.now()-start);if(r.error)report.error={message:r.error.message,code:r.error.code};
report.finishedAt=new Date().toISOString();report.inputsUnchanged=before.every(x=>hash(path.join(bundle,x.file))===x.sha256);
try{const native=JSON.parse(fs.readFileSync(path.join(out,'native-result.json'),'utf8'));assert.equal(native.status,'passed');assert.equal(r.status,0);assert.equal(report.inputsUnchanged,true);report.status='passed';}catch(error){report.status='failed';report.failure=error.message;process.exitCode=1;}
persist();console.log(JSON.stringify({status:report.status,elapsedMs:report.elapsedMs,exitCode:r.status,error:report.error}));
