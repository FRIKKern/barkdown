import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {observeWindowsMediaFile} from '../scripts/windows-media-file-observation.mjs';
const require=createRequire(path.resolve('app/package.json'));
const {powershell,systemRoot,systemTool,nativePath}=require('../app/main/windows-system-tools');
const {createRuntimeRecord}=require('../app/main/runtime-orphan');
const source=path.resolve('../barkpark-windows-media-delete');
const out='docs/cycles/evidence/C105/integration-sql-05';
fs.mkdirSync(out);
fs.copyFileSync('.git/c105-integration-sql-05.mjs',out+'/producer.mjs');
const pkg=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/pty-package-build-01/result.json'));
const bin=nativePath(path.join(pkg.out,'win-unpacked/resources/runtime/postgres/bin'));
assert.match(bin,/^[\x20-\x7e]+$/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown C105 current SQL '));
const pgData=path.join(root,'pgdata'),mediaRoot=path.join(root,'Owned Chø media');
fs.mkdirSync(mediaRoot);fs.mkdirSync(path.join(mediaRoot,'2026'));
const key='2026/original.bin',original=path.join(mediaRoot,key),bytes=Buffer.from('owned Windows integration bytes');fs.writeFileSync(original,bytes);
const password=crypto.randomBytes(24).toString('hex'),pwfile=path.join(root,'password');fs.writeFileSync(pwfile,password);
const env={...process.env,PATH:[systemTool(''),systemRoot()].join(';'),PGPASSWORD:password,PGCLIENTENCODING:'UTF8'};
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});
const redact=t=>String(t).replaceAll(password,'[redacted]');
const report={status:'running',startedAt:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),integrationBase:execFileSync('git',['rev-parse','origin/main'],{cwd:source,encoding:'utf8'}).trim(),root,checks:[],limits:['Actual Windows PostgreSQL and native-observed file; synthetic current14-column media table','SQL owner/reservation/schema checks only; no full server build or app adoption','Native physical cleanup, full writer fencing and portable pending recovery remain unfinished']};
const save=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');
const check=(name)=>{report.checks.push({name});save();console.log(name);};
let n=0,running=false,owner;
function tool(name,args,input,pass=true){const fd=fs.openSync(out+'/command-'+(++n)+'-'+name+'.log','wx');let r;try{r=spawnSync(path.join(bin,name+'.exe'),args,{env,input,windowsHide:true,stdio:['pipe',fd,fd],timeout:30000});}finally{fs.closeSync(fd);}assert.equal(r.error,undefined);assert.equal(r.signal,null);if(pass)assert.equal(r.status,0,fs.readFileSync(out+'/command-'+n+'-'+name+'.log','utf8'));else assert.notEqual(r.status,0);return fs.readFileSync(out+'/command-'+n+'-'+name+'.log','utf8').trim();}
function sql(q,pass=true){return tool('psql',['-X','-q','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],q,pass);}
function start(){tool('pg_ctl',['-D',pgData,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','-t','20','start']);running=true;const pid=Number(fs.readFileSync(path.join(pgData,'postmaster.pid'),'utf8').split('\n')[0]);owner={pid,startedAt:createRuntimeRecord.real(pid)};assert.ok(owner.startedAt);}
function stop(mode='fast'){assert.equal(createRuntimeRecord.real(owner.pid),owner.startedAt);tool('pg_ctl',['-D',pgData,'-m',mode,'-w','-t','20','stop']);running=false;assert.notEqual(createRuntimeRecord.real(owner.pid),owner.startedAt);}
const literal=v=>"convert_from(decode('"+Buffer.from(v).toString('hex')+"','hex'),'UTF8')";
const exact=()=>assert.deepEqual(fs.readFileSync(original),bytes);
const schema=`CREATE TABLE media_files (id uuid PRIMARY KEY,filename varchar,original_name varchar,path varchar,mime_type varchar,size int4,dataset varchar,inserted_at timestamp,updated_at timestamp,workspace_id uuid,project_id uuid,dataset_id uuid,object_key varchar,sha1 text);`;
const insert=(id,k)=>`INSERT INTO media_files(id,filename,original_name,path,object_key,mime_type,size,dataset,sha1,inserted_at,updated_at) VALUES('${id}','original.bin','Chø original',${literal(k)},${literal(k)},'application/octet-stream',${bytes.length},'production','${'a'.repeat(40)}',now(),now());`;
save();const started=Date.now();
try{
  tool('initdb',['-D',pgData,'-U','postgres','--no-clean','--auth=scram-sha-256','--pwfile='+pwfile,'-E','UTF8','--locale=C']);start();
  const sqlFile=path.join(source,'api/priv/media/delete_operations_v1.sql'),sourceSql=fs.readFileSync(sqlFile,'utf8');
  report.sqlSha256=crypto.createHash('sha256').update(sourceSql).digest('hex');fs.writeFileSync(out+'/delete_operations_v1.sql',sourceSql);
  sql(schema);
  const inherited=['/media/legacy-before.png','2026/Chø-before.png','2026/shared-before.bin','2026/shared-before.bin'].map(key=>({id:crypto.randomUUID(),key}));
  for(const row of inherited)sql(insert(row.id,row.key));
  const before=sql('SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM media_files m;');
  sql('BEGIN;\n'+sourceSql+'\nCOMMIT;');
  assert.equal(sql('SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM media_files m;'),before);
  assert.equal(sql('SELECT count(*) FROM media_object_reservations_v1;'),'3');
  assert.equal(sql('SELECT count(*) FROM media_object_reservations_v1 WHERE cardinality(media_ids)=2;'),'1');
  check('migration preserves all pre-existing legacy, Unicode and ordinary co-owned rows exactly');
  for(const row of inherited)sql(`DELETE FROM media_files WHERE id='${row.id}';`);
  assert.equal(sql('SELECT count(*) FROM media_object_reservations_v1;'),'0');
  check('current14-column schema and complete reservation migration install');
  for(const k of ['/media/legacy.png','2026/Chø.png']){const id=crypto.randomUUID();sql(insert(id,k));assert.equal(sql(`SELECT count(*) FROM media_object_reservations_v1 WHERE '${id}'=ANY(media_ids);`),'1');sql(`DELETE FROM media_files WHERE id='${id}';`);assert.equal(sql(`SELECT count(*) FROM media_object_reservations_v1 WHERE '${id}'=ANY(media_ids);`),'0');}
  check('legacy absolute and Unicode rows insert and cascade-delete without stray reservations');
  const serial=spawnSync(powershell(),['-NoProfile','-NonInteractive','-Command',"(Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\").VolumeSerialNumber"],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(serial.status,0);
  const rootIdentity={volume:BigInt('0x'+serial.stdout.trim()).toString(),inode:fs.statSync(mediaRoot,{bigint:true}).ino.toString()};
  const observation=observeWindowsMediaFile({version:1,root:mediaRoot,key,rootIdentity,region:'original',maxBytes:bytes.length});
  assert.equal(observation.file.state,'readable');fs.writeFileSync(out+'/native-observation.json',JSON.stringify(observation,null,2)+'\n');
  const id=crypto.randomUUID(),operation=crypto.randomUUID();sql(insert(id,key));
  const request={version:1,operationId:operation,mediaId:id,expectedKey:key,root:{path:mediaRoot,device:rootIdentity.volume,inode:rootIdentity.inode},file:{bytes:bytes.length,links:1,device:rootIdentity.volume,inode:observation.file.identity.inode,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),observedAt:new Date().toISOString()}};
  const prepare=`SELECT prepare_media_delete_v1(${literal(JSON.stringify(request))}::jsonb);`;
  const coOwner=crypto.randomUUID();sql(insert(coOwner,key));assert.equal(sql(`SELECT cardinality(media_ids) FROM media_object_reservations_v1 WHERE address=public.media_object_address_v1('${key}');`),'2');sql(prepare,false);sql(`DELETE FROM media_files WHERE id='${coOwner}';`);assert.equal(sql(`SELECT cardinality(media_ids) FROM media_object_reservations_v1 WHERE address=public.media_object_address_v1('${key}');`),'1');check('ordinary co-owners remain valid; ambiguous intent refuses until one claimant remains');
  const parsed=JSON.parse(sql(prepare));assert.equal(parsed.rawRow.sha1,'a'.repeat(40));assert.equal(parsed.state,'prepared');exact();check('native-observed intent captures current SHA-1 and exact original without physical effects');
  sql(`BEGIN;UPDATE media_object_reservations_v1 SET operation_id='${operation}' WHERE '${id}'=ANY(media_ids);DELETE FROM media_files WHERE id='${id}';UPDATE media_delete_operations_v1 SET state='pending_cleanup' WHERE operation_id='${operation}';ROLLBACK;`);
  assert.equal(sql(`SELECT count(*) FROM media_files WHERE id='${id}';`),'1');assert.equal(sql(`SELECT state FROM media_delete_operations_v1 WHERE operation_id='${operation}';`),'prepared');exact();check('outer rollback restores row and address ownership');
  sql(`BEGIN;UPDATE media_object_reservations_v1 SET operation_id='${operation}' WHERE '${id}'=ANY(media_ids);DELETE FROM media_files WHERE id='${id}';UPDATE media_delete_operations_v1 SET state='pending_cleanup' WHERE operation_id='${operation}';COMMIT;`);
  const snapshot=sql(`SELECT to_jsonb(o) FROM media_delete_operations_v1 o WHERE operation_id='${operation}';`);
  sql(insert(crypto.randomUUID(),key.toUpperCase()),false);check('committed pending operation refuses raw case-alias insertion');
  stop('immediate');start();assert.equal(sql(`SELECT to_jsonb(o) FROM media_delete_operations_v1 o WHERE operation_id='${operation}';`),snapshot);assert.equal(JSON.parse(sql(prepare)).state,'pending_cleanup');exact();check('abrupt database restart preserves exact pending receipt, retry and original bytes');
  sql('ALTER TABLE media_files ADD COLUMN unexpected_schema integer;');sql(prepare,false);sql('ALTER TABLE media_files DROP COLUMN unexpected_schema;');check('unexpected schema still refuses rather than silently broadening the contract');
  assert.equal(fs.statSync(original,{bigint:true}).ino.toString(),observation.file.identity.inode);report.status='passed';
}catch(error){report.status='failed';report.error=redact(error.stack);process.exitCode=1;}finally{
  if(running){try{stop();}catch(error){report.cleanupError=redact(error.stack);report.status='failed';process.exitCode=1;}}
  report.elapsedMs=Date.now()-started;report.finishedAt=new Date().toISOString();report.privateDataRetained=true;save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,elapsedMs:report.elapsedMs,error:report.error}));
}
