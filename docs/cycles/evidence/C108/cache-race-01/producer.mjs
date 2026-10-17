import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import net from 'node:net';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fork,spawn,spawnSync,execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {inventory} from '../scripts/runtime-postgres-bundle.mjs';
import {observeWindowsMediaFile} from '../scripts/windows-media-file-observation.mjs';
import {validateMediaDeleteIntent} from '../scripts/media-delete-intent.mjs';
const require=createRequire(import.meta.url),{systemTool,systemRoot,powershell}=require('../app/main/windows-system-tools'),{releaseSecrets}=require('../app/main/local-barkpark-source'),{createRuntimeRecord}=require('../app/main/runtime-orphan');
const root='C:/Users/Frikk/Documents/GitHub/barkdown',source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',out=root+'/.git/C108-cache-race450';
const git=a=>execFileSync('git',a,{cwd:source,encoding:'utf8',windowsHide:true}).trim();assert.equal(git(['rev-parse','HEAD']),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(git(['status','--porcelain']),'');
const build=JSON.parse(fs.readFileSync(root+'/.git/C109-runtime304/result.json')),release=build.output,expected=JSON.parse(fs.readFileSync(root+'/.git/C109-runtime304/inventory.json'));assert.equal(build.status,'passed');assert.deepEqual(inventory(release),expected);
assert(!fs.existsSync(out));fs.mkdirSync(out);for(const [from,to] of [['media-cache-race450.mjs','producer.mjs'],['media-cache-race449.exs','fixture.exs'],['media-cache-receive434.exs','candidate.exs'],['C108-cache-derivation434.json','derivation.json'],['C108-cache-source-LICENSE434.txt','SOURCE-LICENSE.txt'],['media-s3-host400.cjs','host.cjs']])fs.copyFileSync(root+'/.git/'+from,out+'/'+to);
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown-cache-receive-')),data=path.join(fixture,'data'),device=path.join(fixture,'device');fs.mkdirSync(data);fs.mkdirSync(device);
const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),PATHEXT:'.COM;.EXE;.BAT;.CMD',USERPROFILE:device,APPDATA:device,LOCALAPPDATA:device,TEMP:fixture,TMP:fixture,PSModuleAnalysisCachePath:path.join(device,'ModuleCache')};
const free=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(e=>e?reject(e):resolve(port));});});
const config={source:release,port:await free(),pgPort:await free(),writeAdmission:{instanceId:'cache-receive-'+crypto.randomBytes(8).toString('hex')}};assert.notEqual(config.port,config.pgPort);
const secrets={password:crypto.randomBytes(32).toString('hex'),token:'bp_admin_'+crypto.randomBytes(24).toString('base64url')};const privateValues=[...Object.values(secrets),...Object.values(releaseSecrets(secrets.password))];const redact=s=>privateValues.reduce((v,k)=>v.split(k).join('[redacted]'),String(s));
fs.writeFileSync(out+'/config-private.json',JSON.stringify({pgPort:config.pgPort,password:secrets.password}));
const requests=[],pending=new Map(),payload=Buffer.from('Synthetic receive-first cache bytes');
const server=http.createServer((req,res)=>{const key=new URL(req.url,'http://127.0.0.1').pathname;
 if(key==='/control/allocate'){
  try {
   const mediaRoot=path.win32.normalize(path.resolve(out,'synthetic-fixture/media')),key='uploads/2026/10/delayed.svg',target=path.join(mediaRoot,key),bytes=Buffer.from('Synthetic native original allocated while receive waits');
   assert(!fs.existsSync(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
   const command="(Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\").VolumeSerialNumber";
   const volumeProbe=spawnSync(powershell(),['-NoProfile','-NonInteractive','-Command',command],{env,windowsHide:true,encoding:'utf8',timeout:20000});assert.equal(volumeProbe.status,0);assert.equal(volumeProbe.error,undefined);assert.equal(volumeProbe.signal,null);
   const volume=BigInt('0x'+volumeProbe.stdout.trim()).toString(),inode=fs.statSync(mediaRoot,{bigint:true}).ino.toString();
   const observed=observeWindowsMediaFile({version:1,root:mediaRoot,rootIdentity:{volume,inode},key,region:'original',maxBytes:bytes.length});assert.equal(observed.file.state,'readable');
   const request={version:1,operationId:crypto.randomUUID(),mediaId:crypto.randomUUID(),expectedKey:key,root:{path:mediaRoot,device:volume,inode},file:{bytes:bytes.length,sha256:observed.file.sha256,device:volume,inode:observed.file.identity.inode,links:1,observedAt:new Date().toISOString()}};validateMediaDeleteIntent(request);
   fs.writeFileSync(out+'/native-observation.json',JSON.stringify(observed,null,2));fs.writeFileSync(out+'/native-request.json',JSON.stringify(request,null,2));requests.push({control:'allocate',nativeObservation:true});res.writeHead(200);return res.end('allocated');
  }catch(e){report.allocationError=redact(e.stack);save();res.writeHead(500);return res.end('fixture allocation refused');}
 }
 if(key==='/control/release/delayed'){const p=pending.get('delayed');if(!p){res.writeHead(409);return res.end();}requests.push({control:'delayed'});p.writeHead(200,{'content-type':'application/octet-stream','content-length':payload.length});p.end(payload);pending.delete('delayed');res.writeHead(200);return res.end('released');}
 requests.push({method:req.method,path:key});if(req.method!=='GET'||!key.startsWith('/synthetic-receive/uploads/2026/10/')){res.writeHead(400);return res.end();}
 if(key.endsWith('/missing.svg')){res.writeHead(404);return res.end('synthetic missing');}if(key.endsWith('/transport.svg'))return req.socket.destroy();
 if(key.endsWith('/delayed.svg')){pending.set('delayed',res);fs.writeFileSync(out+'/delayed.arrived',JSON.stringify({at:new Date().toISOString()}));return;}
 res.writeHead(400);res.end();});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const endpoint='http://127.0.0.1:'+server.address().port;
const report={status:'running',startedAt:new Date().toISOString(),source:git(['rev-parse','HEAD']),app:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),release,fixture,data,endpoint,host:{platform:process.platform,arch:process.arch,osRelease:os.release()},orchestrator:{pid:process.pid,identity:createRuntimeRecord.real(process.pid)},checks:[],limits:['Test-only derived S3 module in a separate VM; existing release/source bytes remain exact. Actual SourceDriver boots only a fresh owned backend/PG. No real account/library, source patch or production repair.','Actual compiled LocalWrite/Repo/coordinator and real PG table-lock availability/conflict. No pending-delete reservation race, DB-loss/owner-death transition, HTTP503 adoption, NTFS identity/native-child/general caller coverage or recovery/cleanup authority.']};
const started=Date.now(),save=()=>fs.writeFileSync(out+'/process.json',JSON.stringify(report,null,2)+'\n');save();
const call=(child,message)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('Owned host request timed out')),330000);const onMessage=r=>r.ok?done(null,r):done(Error(redact(r.error+' '+(r.cleanupError||''))));const onExit=()=>done(Error('Owned host exited during request'));function done(e,r){clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);e?reject(e):resolve(r);}child.once('message',onMessage);child.once('exit',onExit);child.send(message);});
const waitExit=async child=>{if(child.exitCode!==null||child.signalCode)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Owned host did not exit')),15000);child.once('exit',()=>{clearTimeout(timer);resolve();});});};
let host,hostIdentity,ready=false,vm;
try{
 host=fork(root+'/.git/media-s3-host400.cjs',[],{env:{...env,C108_S3_ENDPOINT:endpoint},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});hostIdentity=createRuntimeRecord.real(host.pid);assert(hostIdentity);report.ownedHost={pid:host.pid,identity:hostIdentity};save();
 for(const stream of [host.stdout,host.stderr])stream.on('data',b=>{fs.appendFileSync(out+'/host.raw-private',b);fs.writeFileSync(out+'/host.log',redact(fs.readFileSync(out+'/host.raw-private').toString()));});
 await call(host,{action:'start',config,data,secrets});ready=true;report.checks.push('Owned compiled backend and fresh PostgreSQL boot');save();console.log(report.checks.at(-1));
 const dirs=fs.readdirSync(release+'/lib',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>release+'/lib/'+d.name+'/ebin').filter(d=>fs.existsSync(d));
 const args=['-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',...dirs,'-noshell','-s','elixir','start_cli','-extra',root+'/.git/media-cache-race449.exs',out,endpoint,out+'/config-private.json',out+'/candidate.exs'];
 const fd=fs.openSync(out+'/vm.raw-private','wx'),vmStart=Date.now();
 vm=spawn(release+'/erts-16.4/bin/erl.exe',args,{cwd:out,env:{...env,ERL_CRASH_DUMP:out+'/erl_crash.dump'},windowsHide:true,stdio:['ignore',fd,fd],timeout:90000});report.ownedVm={pid:vm.pid,identity:createRuntimeRecord.real(vm.pid)};save();
 const exited=await new Promise(resolve=>{let error;vm.once('error',e=>error=e.message);vm.once('close',(code,signal)=>resolve({exitCode:code,signal,error}));});fs.closeSync(fd);report.vm={...exited,elapsedMs:Date.now()-vmStart,identityAfter:createRuntimeRecord.real(vm.pid)};save();
 assert.equal(exited.error,undefined);assert.equal(exited.signal,null);assert.equal(exited.exitCode,0,redact(fs.readFileSync(out+'/vm.raw-private').toString().slice(-1800)));assert.equal(report.vm.identityAfter,'');
 const result=JSON.parse(fs.readFileSync(out+'/result.json'));assert.equal(result.status,'pending_prepare_race_observed');assert.equal(result.checks.length,3);assert.equal(requests.filter(r=>r.method).length,1);report.checks.push('Three actual SQL-preparation/cache race observations pass');
 await call(host,{action:'stop'});await waitExit(host);ready=false;assert.notEqual(createRuntimeRecord.real(host.pid),hostIdentity);assert.deepEqual(inventory(release),expected);assert.equal(git(['status','--porcelain']),'');report.status='candidate_observed';
}catch(e){report.status='failed';report.error=redact(e.stack);process.exitCode=1;}
finally{
 for(const res of pending.values())res.destroy();
 if(host&&host.exitCode===null&&!host.signalCode)try{const id=createRuntimeRecord.real(host.pid);if(id){assert.equal(id,hostIdentity);if(ready)await call(host,{action:'stop'});else host.kill();}await waitExit(host);}catch(e){report.cleanupError=redact(e.stack);report.status='failed';process.exitCode=1;}
 await new Promise(resolve=>server.close(resolve));
 if(fs.existsSync(path.join(data,'pgdata/PG_VERSION'))){const p=spawnSync(path.join(release,'postgres/bin/pg_ctl.exe'),['-D',path.join(data,'pgdata'),'status'],{env,encoding:'utf8',windowsHide:true,timeout:15000});report.finalPgStatus=p.status;if(p.status!==3||p.error||p.signal){report.status='failed';report.pgClosureError=p.error?.message||redact(p.stderr);process.exitCode=1;}}
 report.requests=requests;report.elapsedMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.privateDataRetained=true;save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,elapsedMs:report.elapsedMs,vm:report.vm,finalPgStatus:report.finalPgStatus,error:report.error,cleanupError:report.cleanupError}));
}
