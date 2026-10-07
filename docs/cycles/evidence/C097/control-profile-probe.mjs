// Controlled ownership diagnostic: real bridge socket, main appTool function, control gate,
// renderer command and refresh. The active profile is a fixture variable, not native activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root=process.cwd(),require=createRequire(path.join(root,'app/package.json'));
const {createControl}=require('./main/control.js'),{createBrowserBridge}=require('./main/browser-tools.js');
const baseline=process.env.BARKDOWN_CONTROL_PROFILE_BASELINE || null;
const sourceOf=relative=>baseline?execFileSync('git',['show',`${baseline}:${relative}`],{encoding:'utf8'}):fs.readFileSync(path.join(root,relative),'utf8');
if(baseline)for(const file of ['app/main/control.js','app/main/browser-tools.js'])assert.equal(sourceOf(file),fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),'Baseline bridge/gate source must match');
async function renderer(relative){
 if(!baseline)return import(pathToFileURL(path.join(root,relative)));
 const text=sourceOf(relative).replace(/from '(\.[^']+)'/g,(_all,local)=>`from '${pathToFileURL(path.resolve(root,path.dirname(relative),local))}'`);
 return import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
}
const {mountControl}=await renderer('app/renderer/src/control.js');
const {createLibraryRefresh}=await renderer('app/renderer/src/library-refresh.js');
const source=sourceOf('app/main/main.js');
const exact=source.slice(source.indexOf('async function appTool('),source.indexOf('// Every run, whichever path starts it'));
assert(exact.startsWith('async function appTool('));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bd-control-owner-'));
const state={profileId:'profile-A',generation:1,documents:[],barkparkDocs:[],settings:{barkpark:{enabled:true,server:'http://fixture.invalid',dataset:'production'}}};
let invoke,nextId=0;const answers=new Map();
const api={docs:{list:async()=>[]},barkpark:{list:async()=>[{id:'same-slug',title:state.profileId+' private note'}]},control:{onInvoke(fn){invoke=fn;},result:async answer=>{answers.set(answer.id,answer);}}};
const refreshLibrary=createLibraryRefresh({state,api,render(){},report(){}});
mountControl({state,api,refreshLibrary,controllers:new Map(),DIRECT:'direct'});
const control=createControl({userDataDir:dir,pointerDir:path.join(dir,'pointers'),fullYolo:()=>false,toWindow:async(command,args,_timeout,context)=>{
 const id=++nextId;await invoke({id,command,args,context});const answer=answers.get(id);
 if(!answer.ok)throw Object.assign(new Error(answer.error),{code:answer.code});return answer.result;
}});
const appTool=vm.runInNewContext('('+exact+')',{control});
const bridge=createBrowserBridge({call:(tool,args)=>appTool(tool,args)});
const original=bridge.serverSpec('main');
async function read(spec){return new Promise((resolve,reject)=>{
 const socket=net.createConnection(spec.env.BARKDOWN_BROWSER_SOCKET);let text='';const timer=setTimeout(()=>{socket.destroy();reject(Error('probe socket timeout'));},3000);
 socket.once('error',reject);socket.once('connect',()=>socket.write(JSON.stringify({id:1,token:spec.env.BARKDOWN_BROWSER_TOKEN,chatId:spec.env.BARKDOWN_BROWSER_CHAT,tool:'app',args:{command:'note.list'}})+'\n'));
 socket.on('data',chunk=>{text+=chunk;if(text.includes('\n')){clearTimeout(timer);socket.end();resolve(JSON.parse(text.split('\n')[0]));}});
});}
try{
 await test('captured assistant bridge must not borrow a newly selected profile',async()=>{
  const before=await read(original);assert.equal(before.ok,true);assert.equal(before.result[0].title,'profile-A private note');
  state.profileId='profile-B';state.generation++;state.settings.barkpark.server='http://other-fixture.invalid';state.barkparkDocs=[];
  const after=await read(original);
  console.log(JSON.stringify({baseline,scope:'Actual bridge/control/renderer with exact main appTool, controlled active-profile change; no native switch or real provider',mainFunctionSha256:crypto.createHash('sha256').update(exact).digest('hex'),before,after,bridgeEnvironmentNames:Object.keys(original.env)}));
  assert.equal(after.ok,false,'The profile-A bridge must refuse instead of reading profile-B notes');
 });
}finally{bridge.close();control.close();}
