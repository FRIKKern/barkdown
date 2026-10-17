import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateMediaDeleteIntent} from './media-delete-intent.mjs';
import {validateWindowsFileRequest,observeWindowsMediaFile} from './windows-media-file-observation.mjs';
const require=createRequire(import.meta.url),{powershell,systemRoot,systemTool}=require('../app/main/windows-system-tools');
const script=fileURLToPath(new URL('./windows-media-custody.ps1',import.meta.url));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join('\0')!==[...keys].sort().join('\0'))throw Error('Unsupported custody shape');}
export function validateWindowsMediaCustody(request){
  exact(request,['version','intent','quarantine']);if(request.version!==1)throw Error('Unsupported custody version');validateMediaDeleteIntent(request.intent);exact(request.quarantine,['path','device','inode']);
  const i=request.intent,q=request.quarantine;validateWindowsFileRequest({version:1,root:q.path,rootIdentity:{volume:q.device,inode:q.inode},key:i.operationId+'/prepared.json',region:'original',maxBytes:65536});
  if(q.device!==i.root.device)throw Error('Custody must stay on the same volume');const a=i.root.path.toLowerCase(),b=q.path.toLowerCase();if(a===b||a.startsWith(b+'\\')||b.startsWith(a+'\\'))throw Error('Custody roots overlap');return request;
}
function launchEnvironment(){if(process.platform!=='win32')throw Error('Native Windows custody is unavailable');const executionRoot=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown C108 native '));return {executionRoot,env:{PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:executionRoot,APPDATA:executionRoot,LOCALAPPDATA:executionRoot,TEMP:executionRoot,TMP:executionRoot}};}
function limits(result){return {...result,logicalDeletionCommitted:null,physicalDeletionSettled:false,runtimeFenced:false,deletionAllowed:false,recoveryAllowed:false,limitations:['Internal unadopted one-file NTFS custody, not a production cleanup operation','Caller declarations do not establish a committed server intent or complete runtime writer lease','No purge/restore, historical-orphan claim, whole-tree inventory or power-loss durability acceptance','Read-only recovery observations are bounded checks, not an atomic global snapshot or authorization']};}
// Hooks represent the controller boundaries around the native move. They do not
// waive binding checks or grant server authority. The child is always owned here.
export async function quarantineWindowsMediaFile(input,{onPrepared,onRenamed,timeoutMs=90000}={}){
  validateWindowsMediaCustody(input);if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>90000)throw Error('Unsupported custody timeout');const request=structuredClone(input),{executionRoot,env}=launchEnvironment(),events=[];
  const child=spawn(powershell(),['-NoProfile','-NonInteractive','-File',script],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stderr='',total=0,timer,exited=false;
  child.stderr.on('data',b=>{stderr+=b;if(stderr.length>65536)child.kill();});child.stdin.on('error',()=>{});const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{exited=true;resolve({code,signal});});});
  const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});child.stdin.write(JSON.stringify(request)+'\n');
  try{
    return await Promise.race([(async()=>{for await(const line of lines){total+=Buffer.byteLength(line);if(total>65536)throw Error('Native custody output exceeded bound');const event=JSON.parse(line);events.push(event);if(event.stage==='refused')break;
      const expected=['prepared','renamed','recorded'][events.length-1];if(event.stage!==expected)throw Error('Unexpected native custody transition');
      if(event.stage==='prepared'){if(onPrepared)await onPrepared({event,request:structuredClone(request),pid:child.pid});if(!exited)child.stdin.write('move\n');}
      if(event.stage==='renamed'){const r=event.result;assert.equal(r.bytes,request.intent.file.bytes);assert.equal(r.sha256,request.intent.file.sha256);assert.deepEqual(r.identity,{device:request.intent.file.device,inode:request.intent.file.inode,links:1});assert.equal(r.finalPath,'\\\\?\\'+path.win32.join(request.quarantine.path,request.intent.operationId,'original.bin'));if(onRenamed)await onRenamed({event,request:structuredClone(request),pid:child.pid});if(!exited)child.stdin.write('record\n');}
    }const ended=await exit;if(ended.code!==0||events.at(-1)?.stage!=='recorded')return limits({status:'refused',reason:events.at(-1)?.reason||'Owned worker ended before recorded custody',events,ended,stderr,executionRoot});return limits({status:'quarantined',events,ended,stderr,executionRoot});})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native custody timed out; inspect retained operation')),timeoutMs);})]);
  }finally{clearTimeout(timer);child.stdin.end();if(!exited)child.kill();await Promise.race([exit.catch(()=>{}),new Promise(resolve=>{const t=setTimeout(resolve,5000);t.unref();})]);lines.close();}
}
function readRecord(request){const {executionRoot,env}=launchEnvironment(),r=spawnSync(powershell(),['-NoProfile','-NonInteractive','-File',script],{input:JSON.stringify({mode:'inspect',request})+'\n',env,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:262144});if(r.status!==0)throw Error('Native custody record unavailable: '+r.stdout.trim());const event=JSON.parse(r.stdout);if(event.stage!=='record')throw Error('Unsupported native custody record');const bytes=Buffer.from(event.result.base64,'base64');if(bytes.toString('base64')!==event.result.base64)throw Error('Invalid custody record encoding');const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));exact(record,['version','request','operationDirectory','selectedFile','at']);assert.equal(record.version,1);assert.deepEqual(record.request,request);assert.deepEqual(record.operationDirectory,event.result.operationDirectory);assert.deepEqual(record.selectedFile,{device:request.intent.file.device,inode:request.intent.file.inode,links:1});return {record,sha256:hash(bytes),executionRoot};}
export function inspectWindowsMediaCustody(input){
  validateWindowsMediaCustody(input);const request=structuredClone(input),first=readRecord(request),i=request.intent;
  const observe=(root,identity,key)=>observeWindowsMediaFile({version:1,root,rootIdentity:{volume:identity.device,inode:identity.inode},key,region:'original',maxBytes:Math.max(i.file.bytes,1)});
  const source=observe(i.root.path,i.root,i.expectedKey),target=observe(request.quarantine.path,request.quarantine,i.operationId+'/original.bin'),last=readRecord(request);assert.equal(last.sha256,first.sha256);assert.deepEqual(last.record.operationDirectory,first.record.operationDirectory);
  const matches=o=>o.file.state==='readable'&&o.file.bytes===i.file.bytes&&o.file.sha256===i.file.sha256&&o.file.identity.device===i.file.device&&o.file.identity.inode===i.file.inode&&o.file.identity.links===1;
  let state='uncertain';if(matches(target)&&source.file.state==='absent')state='quarantined';else if(matches(target)&&source.file.state==='readable'&&!matches(source))state='quarantined-with-replacement';else if(matches(source)&&target.file.state==='absent')state='not-moved';
  return limits({status:'observed',state,preparedRecordSha256:first.sha256,operationDirectory:first.record.operationDirectory,source:source.file,target:target.file,executionRoots:[first.executionRoot,source.executionRoot,target.executionRoot,last.executionRoot]});
}
