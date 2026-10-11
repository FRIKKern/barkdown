// Real SourceDriver with disposable profile data. No Electron or real library is used here.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { SourceDriver, releaseSecrets } = require('../main/local-barkpark-source');
const { LocalBarkpark } = require('../main/local-barkpark');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const { powershell, systemTool, systemRoot } = require('../main/windows-system-tools');
const bp = require('../main/barkpark');
const script = fileURLToPath(import.meta.url);
if (process.platform !== 'win32') throw new Error('Windows driver proof requires Windows');

if (process.argv[2] === '--host') {
  let driver, lifecycle;
  process.on('message', async message => {
    try {
      if (message.action === 'start') {
        driver = new SourceDriver(message.config, message.data, message.secrets);
        lifecycle = new LocalBarkpark(driver);
        lifecycle.on('status',status=>console.log(JSON.stringify({phase:status.phase,attempts:status.attempts,error:status.error})));
        await lifecycle.start();
        process.send({ ok:true, pgBin:driver.pgBin, mix:driver.mix, record:driver.processRecord.read(),lifecycle:lifecycle.status() });
      } else if (message.action === 'stop') {
        await lifecycle.stop();
        process.send({ok:true}, () => process.disconnect());
      } else if (message.action === 'status') {
        process.send({ok:true,lifecycle:lifecycle.status(),record:driver.processRecord.read()});
      } else throw new Error('Unknown proof action');
    } catch(error) {
      let cleanupError;
      if (driver?.lease) try { await driver.stop(); await driver.release(); } catch(e) { cleanupError=e.message; }
      process.send({ok:false,error:error.message,code:error.code,cleanupError}, () => process.disconnect());
    }
  });
} else {
  const [releaseArg,evidenceArg] = process.argv.slice(2);
  if (!releaseArg || !evidenceArg) throw new Error('Usage: node app/tests/runtime-release-windows-driver.live.mjs <complete release> <new evidence>');
  const evidence=path.resolve(evidenceArg);
  if (fs.existsSync(evidence)) throw new Error('Evidence already exists');
  fs.mkdirSync(evidence,{recursive:true});
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown Windows driver Chø '));
  const release=path.join(root,'Carried runtime'),data=path.join(root,'Owned data');fs.mkdirSync(data);
  fs.cpSync(path.resolve(releaseArg),release,{recursive:true,dereference:true,errorOnExist:true,force:false});
  const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});
  const config={source:release,port:await freePort(),pgPort:await freePort()};assert.notEqual(config.port,config.pgPort);
  const secrets={password:crypto.randomBytes(32).toString('hex'),token:'bp_admin_'+crypto.randomBytes(24).toString('base64url')};
  const redact=text=>[...Object.values(secrets),...Object.values(releaseSecrets(secrets.password))].reduce((s,key)=>s.split(key).join('[redacted]'),String(text));
  const hostEnv={...process.env,PATH:[systemTool(''),systemRoot()].join(';')};
  const report={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),root,host:`win32 ${os.release()} ${process.arch}`,path:hostEnv.PATH,checks:[],limits:['Actual application driver under Node, not Electron or installer','Disposable fresh PostgreSQL18 profile; no older-profile upgrade','Published reads retain upstream anonymous semantics','Non-ASCII runtime uses an existing verified Windows short path; other filesystems need separate proof']};
  const persist=()=>fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2)+'\n');
  const record=(name,details={})=>{report.checks.push({name,...details});persist();console.log(name);};persist();
  const hosts=new Set(),readyHosts=new Set();let sequence=0;
  const spawnHost=()=>{
    const child=fork(script,['--host'],{env:hostEnv,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});hosts.add(child);
    const log=path.join(evidence,`host-${++sequence}.log`);
    child.stdout.on('data',b=>fs.appendFileSync(log,redact(b)));child.stderr.on('data',b=>fs.appendFileSync(log,redact(b)));
    return child;
  };
  const request=(child,message)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Host operation timed out')),330000);
    const finish=(error,value)=>{clearTimeout(timer);child.off('message',reply);child.off('exit',exit);child.off('error',failure);error?reject(error):resolve(value);};
    const reply=value=>value.ok?finish(null,value):finish(Object.assign(new Error(value.error),{code:value.code,cleanupError:value.cleanupError}));
    const exit=(code,signal)=>finish(new Error(`Host exited during operation: ${code}/${signal}`));
    const failure=e=>finish(e);
    child.once('message',reply);child.once('exit',exit);child.once('error',failure);child.send(message,error=>{if(error)finish(error);});
  });
  const start=async()=>{const child=spawnHost();const ready=await request(child,{action:'start',config,data,secrets});const selected=fs.statSync(path.join(ready.pgBin,'postgres.exe'),{bigint:true}),carried=fs.statSync(path.join(release,'postgres/bin/postgres.exe'),{bigint:true});assert.equal(selected.ino,carried.ino);assert.equal(selected.dev,carried.dev);readyHosts.add(child);assert.equal(ready.mix,null);assert.equal(ready.record.hostPid,child.pid);assert.ok(ready.record.hostStartedAt);assert.ok(ready.record.startedAt);return {child,ready};};
  const stopped=async child=>{if(child.exitCode!==null)return;await request(child,{action:'stop'});};
  const waitGone=async child=>{if(child.exitCode!==null||child.signalCode)return;let timer;try{await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned host did not exit')),15000);})]);}finally{clearTimeout(timer);}};
  const http={server:`http://127.0.0.1:${config.port}`,token:secrets.token,dataset:'production',writes:true};
  try {
    let current=await start();record('actual Windows driver starts with carried tools and system-only PATH',{pgBin:current.ready.pgBin,record:current.ready.record});
    const bindings=JSON.parse(execFileSync(powershell(),['-NoProfile','-NonInteractive','-Command',`Get-NetTCPConnection -State Listen -LocalPort ${config.port} | Select-Object LocalAddress,OwningProcess | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));assert.equal(bindings.LocalAddress,'127.0.0.1');record('actual application release listener binds IPv4 loopback',{bindings});
    const before=fs.readFileSync(path.join(data,'runtime-process.json'));
    const contender=spawnHost();await assert.rejects(request(contender,{action:'start',config,data,secrets}),/another running Barkdown/);await waitGone(contender);assert.deepEqual(fs.readFileSync(path.join(data,'runtime-process.json')),before);record('second real host refuses ownership without changing the active record');
    await bp.request(http,'POST','/v1/data/mutate/production',{mutations:[{createOrReplace:{_id:'driver-proof',_type:'tag',title:'Driver proof'}},{publish:{id:'driver-proof',type:'tag'}}]});
    await bp.publish(http,{slug:'windows-driver-proof',title:'Windows driver proof',description:'Disposable carried Windows runtime and recovery proof.',tags:[{tag:'driver-proof',strength:90,rationale:'Disposable driver proof'}],blocks:[{type:'paragraph',content:[{type:'text',value:'Driver restart keeps Chø 🐕.'}]}]});
    const first=await bp.getPaper(http,'windows-driver-proof');assert.match(first.markdown,/Driver restart keeps Chø 🐕/);record('real Paper is acknowledged through the application HTTP adapter');
    await stopped(current.child);await waitGone(current.child);assert.equal(fs.existsSync(path.join(data,'runtime-process.json')),false);
    current=await start();const ordinary=await bp.getPaper(http,'windows-driver-proof');assert.equal(ordinary.markdown,first.markdown);assert.equal(ordinary.rev,first.rev);record('ordinary driver stop/restart preserves exact Paper revision and content');
    const running=JSON.parse(execFileSync(powershell(),['-NoProfile','-NonInteractive','-Command',`Get-NetTCPConnection -State Listen -LocalPort ${config.port} | Select-Object LocalAddress,OwningProcess | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));
    const beamStarted=createRuntimeRecord.real(running.OwningProcess);assert.ok(beamStarted);
    assert.equal(createRuntimeRecord.real(current.ready.record.pid),current.ready.record.startedAt);
    process.kill(current.ready.record.pid,'SIGKILL'); // Kill only the launcher: its Job must kill descendants.
    const goneDeadline=Date.now()+10000;
    while(createRuntimeRecord.real(running.OwningProcess)===beamStarted) {if(Date.now()>goneDeadline)throw new Error('BEAM survived launcher death outside the owned Job');await new Promise(resolve=>setTimeout(resolve,250));}
    record('kill-on-close Job removes BEAM when only the launcher is killed');
    const recoverDeadline=Date.now()+180000;let state;
    for(;;){state=await request(current.child,{action:'status'});if(state.lifecycle.phase==='ready'&&state.record?.pid!==current.ready.record.pid)break;if(state.lifecycle.phase==='failed'||Date.now()>recoverDeadline)throw new Error('Actual lifecycle did not recover launcher death: '+state.lifecycle.error);await new Promise(resolve=>setTimeout(resolve,500));}
    const automatic=await bp.getPaper(http,'windows-driver-proof');assert.equal(automatic.markdown,first.markdown);assert.equal(automatic.rev,first.rev);record('actual bounded lifecycle recovers launcher death and preserves Paper',{attempts:state.lifecycle.attempts});
    current.child.kill('SIGKILL');await waitGone(current.child);assert.equal(fs.existsSync(path.join(data,'runtime-process.json')),true);record('forced host death retains the ownership record for explicit reclaim');
    current=await start();const recovered=await bp.getPaper(http,'windows-driver-proof');assert.equal(recovered.markdown,first.markdown);assert.equal(recovered.rev,first.rev);record('new real host reclaims the private runtime and preserves acknowledged Paper');
    await stopped(current.child);await waitGone(current.child);
    const pgVersion=path.join(data,'pgdata/PG_VERSION'),original=fs.readFileSync(pgVersion);fs.writeFileSync(pgVersion,'17\n');
    try {const refused=spawnHost();await assert.rejects(request(refused,{action:'start',config,data,secrets}),{code:'runtime_database_major'});await waitGone(refused);assert.equal(fs.readFileSync(pgVersion,'utf8'),'17\n');record('incompatible PostgreSQL major refuses before startup and preserves version bytes');} finally {fs.writeFileSync(pgVersion,original);}
    const status = require('node:child_process').spawnSync(path.join(release,'postgres/bin/pg_ctl.exe'),['-D',path.join(data,'pgdata'),'status'],{env:hostEnv,encoding:'utf8',windowsHide:true});assert.equal(status.status,3);record('all owned hosts and private database stopped');report.status='passed';
  } catch(error) {
    report.status='failed';report.error=redact(error.message);report.cleanupError=redact(error.cleanupError||'');process.exitCode=1;
  } finally {
    for(const child of hosts) if(child.connected && readyHosts.has(child) && child.exitCode===null && !child.signalCode) try {await stopped(child);await waitGone(child);} catch(error) {report.status='failed';report.hostCleanupError=redact(error.message);process.exitCode=1;}
    for(const file of fs.readdirSync(data).filter(n=>n.endsWith('.log'))) fs.writeFileSync(path.join(evidence,file),redact(fs.readFileSync(path.join(data,file),'utf8')));
    report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);persist();console.log(JSON.stringify({status:report.status,error:report.error,evidence,elapsedMs:report.elapsedMs}));
  }
}
