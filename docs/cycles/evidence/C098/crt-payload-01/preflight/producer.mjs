import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const out='.git/c098-crt-static-preflight-02';fs.mkdirSync(out);fs.copyFileSync('.git/c098-crt-static-preflight-02.mjs',out+'/producer.mjs');
const candidate='C:/Program Files/Microsoft Visual Studio/18/Community/VC/Redist/MSVC/14.50.35710/vc_redist.x64.exe',tool='C:/Users/Frikk/scoop/apps/7zip/26.01/7z.exe';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/crt-candidate-01/metadata.json'));if(sha(candidate)!==original.sha256)throw Error('Candidate changed');
const start=Date.now(),r=spawnSync(tool,['l','-slt',candidate],{windowsHide:true,encoding:'utf8',timeout:30000});
fs.writeFileSync(out+'/listing.log',(r.stdout||'')+(r.stderr||''),{flag:'wx'});
fs.writeFileSync(out+'/result.json',JSON.stringify({status:r.status===0&&!r.error?'passed':'failed',exitCode:r.status,error:r.error?String(r.error):null,elapsedMs:Date.now()-start,candidate:{path:candidate,sha256:original.sha256,bytes:fs.statSync(candidate).size},tool:{path:tool,sha256:sha(tool)},scope:'Read-only static archive listing of previously inspected SDK candidate. Redistributable was not copied, loaded or executed; host prerequisites and carried payloads unchanged. Private preparation, not delivered closure.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({exitCode:r.status,elapsedMs:Date.now()-start,listingBytes:fs.statSync(out+'/listing.log').size}));if(r.status!==0||r.error)process.exitCode=1;
