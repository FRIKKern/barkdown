import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { attachPostgres } from '../scripts/runtime-postgres-bundle.mjs';
const require = createRequire(import.meta.url);
const { releaseSecrets } = require('../app/main/local-barkpark-source.js');
const bp = require('../app/main/barkpark.js');
const evidence = path.resolve('.git/windows-native-runtime-02');
if (fs.existsSync(evidence)) throw new Error('Evidence exists');
fs.mkdirSync(evidence);
const root = fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown Windows runtime '));
const release = path.join(root,'Carried runtime');
const data = path.join(root,'Owned data');
fs.mkdirSync(data);
fs.cpSync(path.resolve('.git/windows-release-probe-02/release'),release,{recursive:true,dereference:true,errorOnExist:true,force:false});
fs.writeFileSync(path.join(release,'barkdown-release.json'),JSON.stringify({version:1,platform:'win32',arch:'x64',upstream:'944a57a1e0b2a210d44e5215c13519a378d6efb8',purpose:'Windows preparation probe; supported Mix release configuration override'}));
const postgres = attachPostgres(release,path.resolve('runtime/postgres-18.4-win32-x64-final'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key])=> !/^(BARK|SECRET|DATABASE|PG|MIX|ELIXIR|ERL|RELEASE)/i.test(key) && key.toLowerCase()!=='path'));
const password=crypto.randomBytes(32).toString('hex'),token='bp_admin_'+crypto.randomBytes(24).toString('base64url'),keys=releaseSecrets(password);
env.PATH=path.join(process.env.SystemRoot,'System32')+';'+process.env.SystemRoot;
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});
const pgPort=await freePort(),httpPort=await freePort();
assert.notEqual(pgPort,httpPort);
Object.assign(env,keys,{PGPASSWORD:password,PGCLIENTENCODING:'UTF8',DATABASE_URL:`ecto://postgres:${password}@127.0.0.1:${pgPort}/barkdown`,POOL_SIZE:'3',RELEASE_DISTRIBUTION:'none',RELEASE_COOKIE:crypto.randomBytes(32).toString('hex'),RELEASE_TMP:path.join(data,'release-tmp'),ERL_CRASH_DUMP:path.join(data,'erl-crash.dump'),PORT:String(httpPort),PHX_PORT:String(httpPort),PHX_HOST:'127.0.0.1',PHX_SCHEME:'http',PHX_SERVER:'true',BARKPARK_PAPER_CANVAS:'1',BARKPARK_INGEST_TOKEN:token,BARKPARK_SEED_PROFILE:'clean',BARKPARK_SEED_ADMIN_TOKEN:token,BARKPARK_PLUGINS:'bulldocs,media',BARKPARK_MEDIA_DIR:path.join(data,'media'),BARKPARK_INDX_STATE_DIR:path.join(data,'indx'),BARKPARK_BUNDLE_SPILL_DIR:path.join(data,'bundles')});
const redact=s=>[password,token,...Object.values(keys),env.RELEASE_COOKIE].reduce((s,k)=>s.split(k).join('[redacted]'),String(s));
const report={status:'running',startedAt:new Date().toISOString(),root,upstream:'944a57a1e0b2a210d44e5215c13519a378d6efb8',path:env.PATH,pgPort,httpPort,checks:[],limits:['Private preparation harness, not application driver or installer','Loopback bootstrap explicitly overrides upstream production all-interface binding','Developer host, not clean Windows machine']};
const record=(name,detail={})=>{report.checks.push({name,...detail});console.log(name);};
const persist=()=>fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2)+'\n');
persist();
const pgData=path.join(data,'pgdata'),pwFile=path.join(data,'bootstrap-password');
fs.writeFileSync(pwFile,password,{flag:'wx'});
let server,pgStarted=false;
const pg=(tool,args,input)=>{
  const exe=path.join(postgres,'bin',tool+'.exe');
  if(tool==='pg_ctl') {const fd=fs.openSync(path.join(root,'pg-ctl.log'),'a');try{return execFileSync(exe,args,{env,windowsHide:true,timeout:60000,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}}
  return execFileSync(exe,args,{env,windowsHide:true,timeout:60000,encoding:'utf8',input});
};
const evaluate=expression=>{
  const fd=fs.openSync(path.join(root,'release-eval.log'),'a');
  try {const r=spawnSync(process.env.ComSpec,['/d','/s','/c','""'+path.join(release,'bin/barkpark.bat')+'" eval "'+expression+'""'],{env,cwd:root,windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore',fd,fd],timeout:600000});if(r.status!==0||r.error)throw new Error('Release eval failed: '+r.status+' '+(r.error?.message||''));}
  finally{fs.closeSync(fd);}
};
const boot=path.join(data,'private-loopback-boot.exs');
fs.writeFileSync(boot,`Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint, Keyword.merge(endpoint, server: true, http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]), persistent: true)
{:ok, _} = Application.ensure_all_started(:barkpark)
Process.sleep(:infinity)
`);
env.BARKDOWN_RELEASE_BOOT_SCRIPT=boot;
const start=async()=>{
  const fd=fs.openSync(path.join(root,'server.log'),'a');
  const cmd='""'+path.join(release,'bin/barkpark.bat')+'" eval "Code.require_file(System.get_env(Atom.to_string(:BARKDOWN_RELEASE_BOOT_SCRIPT)))""';
  try{server=spawn(process.env.ComSpec,['/d','/s','/c',cmd],{env,cwd:root,windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
  server.once('error',e=>{report.spawnError=e.message;});
  const deadline=Date.now()+180000;
  for(;;){if(server.exitCode!==null)throw new Error('Server exited '+server.exitCode);try{const r=await fetch(`http://127.0.0.1:${httpPort}/status.json`,{signal:AbortSignal.timeout(3000)});const b=await r.json();if(r.ok&&['database','migrations','plugins'].every(n=>b.components?.some(c=>c.name===n&&c.status==='operational')))return;}catch{}if(Date.now()>deadline)throw new Error('Server not ready within 180s');await new Promise(r=>setTimeout(r,500));}
};
const stopServer=async()=>{
  if(server?.pid&&server.exitCode===null){const exit=new Promise(resolve=>server.once('exit',resolve));const r=spawnSync(path.join(process.env.SystemRoot,'System32/taskkill.exe'),['/PID',String(server.pid),'/T','/F'],{windowsHide:true,encoding:'utf8',timeout:15000});if(r.status!==0&&server.exitCode===null)throw new Error('Owned server stop failed');await Promise.race([exit,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Owned server did not exit')),15000))]);}
};
try{
  pg('initdb',['-D',pgData,'-U','postgres','--pwfile='+pwFile,'--auth=scram-sha-256','-E','UTF8','--locale=C']);
  fs.writeFileSync(pwFile,'consumed');
  pgStarted=true;pg('pg_ctl',['-D',pgData,'-l',path.join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${pgPort}`,'-w','start']);
  pg('createdb',['-h','127.0.0.1','-p',String(pgPort),'-U','postgres','-w','barkdown']);
  record('fresh carried PostgreSQL initialized');persist();
  evaluate('Barkpark.Release.migrate()');record('actual production release migrations pass on PostgreSQL 18');persist();
  evaluate('Barkpark.Release.seed()');record('actual production release clean seed passes');persist();
  await start();record('relocated Windows production release serves operational status');persist();
  const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const bindings=JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`Get-NetTCPConnection -State Listen -LocalPort ${httpPort} | Select-Object LocalAddress,OwningProcess | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:15000}));
  assert.equal(bindings.LocalAddress,'127.0.0.1');record('HTTP listener is confined to IPv4 loopback',{bindings});
  const config={server:`http://127.0.0.1:${httpPort}`,token,dataset:'production',writes:true};
  assert.equal((await fetch(config.server+'/v1/data/query/production/paper?limit=1')).status,401);
  await bp.request(config,'POST','/v1/data/mutate/production',{mutations:[{createOrReplace:{_id:'packaging-probe',_type:'tag',title:'Packaging probe'}},{publish:{id:'packaging-probe',type:'tag'}}]});
  await bp.publish(config,{slug:'windows-release-proof',title:'Windows release proof',description:'Disposable Windows packaged runtime compatibility proof.',tags:[{tag:'packaging-probe',strength:90,rationale:'Private runtime probe'}],blocks:[{type:'paragraph',content:[{type:'text',value:'Preserved after restart: Chø 🐕.'}]}]});
  const first=await bp.getPaper(config,'windows-release-proof');assert.match(first.markdown,/Preserved after restart/);
  record('authenticated app HTTP adapter creates and reads real Paper');persist();
  await stopServer();await start();
  const again=await bp.getPaper(config,'windows-release-proof');assert.equal(again.markdown,first.markdown);assert.equal(again.rev,first.rev);
  record('real Paper content and revision survive server restart');persist();
  await stopServer();pg('pg_ctl',['-D',pgData,'-m','fast','-w','stop']);pgStarted=false;
  const stopped=spawnSync(path.join(postgres,'bin/pg_ctl.exe'),['-D',pgData,'status'],{env,windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(stopped.status,3);
  record('owned server and database stopped');report.status='passed';
}catch(error){report.status='failed';report.error=redact(error.message);process.exitCode=1;}
finally{
  try{await stopServer();}catch(e){report.serverCleanupError=redact(e.message);process.exitCode=1;}
  if(pgStarted){try{pg('pg_ctl',['-D',pgData,'-m','fast','-w','stop']);}catch(e){report.databaseCleanupError=redact(e.message);process.exitCode=1;}}
  fs.writeFileSync(pwFile,'consumed');report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);persist();
  for(const file of ['release-eval.log','server.log','postgres.log','pg-ctl.log'])if(fs.existsSync(path.join(root,file)))fs.writeFileSync(path.join(evidence,file),redact(fs.readFileSync(path.join(root,file),'utf8')));
  console.log(JSON.stringify({status:report.status,error:report.error,evidence,elapsedMs:report.elapsedMs}));
}
