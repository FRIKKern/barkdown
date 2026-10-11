import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const out='.git/c098-crt-static-preflight-02',candidate=JSON.parse(fs.readFileSync(out+'/result.json')).candidate,tool='C:/Users/Frikk/scoop/apps/7zip/26.01/7z.exe';
if(crypto.createHash('sha256').update(fs.readFileSync(candidate.path)).digest('hex')!==candidate.sha256)throw Error('Candidate changed');
const start=Date.now(),r=spawnSync(tool,['e','-so',candidate.path,'0'],{windowsHide:true,maxBuffer:2e6,timeout:30000});
fs.writeFileSync(out+'/manifest-stderr.log',r.stderr||Buffer.alloc(0),{flag:'wx'});
if(r.stdout)fs.writeFileSync(out+'/manifest.xml.txt',r.stdout,{flag:'wx'});
fs.writeFileSync(out+'/manifest-result.json',JSON.stringify({status:r.status===0&&!r.error?'passed':'failed',exitCode:r.status,error:r.error?String(r.error):null,elapsedMs:Date.now()-start,bytes:r.stdout?.length||0,sha256:r.stdout?crypto.createHash('sha256').update(r.stdout).digest('hex'):null,candidateSha256:candidate.sha256,scope:'Static first attached CAB entry 0 only. Redistributable is never run; no installation or license acceptance inferred.'},null,2)+'\n',{flag:'wx'});fs.copyFileSync('.git/c098-crt-manifest-preflight-01.mjs',out+'/manifest-producer.mjs');if(r.status!==0||r.error)process.exitCode=1;
