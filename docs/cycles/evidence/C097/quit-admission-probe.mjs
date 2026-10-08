// Real owners and exact main handler; controlled shell/login/worker adapters.
// No native provider, child termination or Electron exit is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../../../../app/main/main.js',import.meta.url));
const {createProfileRegistry}=require('./profile-registry');
const {createProfileService}=require('./profile-service');
const {createProfileRuntimePool}=require('./profile-runtime');
const {createProviderAuthentication}=require('./provider-authentication');
const {createProviderLogin}=require('./provider-login');
const shell=require('./shell-environment'), runs=require('./providers/runs');
const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function until(predicate){const deadline=Date.now()+5000;while(!predicate()){assert(Date.now()<deadline,'Controlled checkpoint timed out');await tick();}}

for(const mode of ['environment-remote','environment-local','device-login']) await test(mode,async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-quit-admission-'));
 const registry=createProfileRegistry(root),profile=registry.createProfile({name:'Disposable admission'});registry.selectProfile(profile.id);
 const gate=deferred(),keeperGate=deferred(),loginFinished=deferred();
 let hydrationStarted=false,loginStarted=false,loginStops=0,loginMessage,runtimeStops=0,quit=0,shutdownEntered=false;
 const dialogs=[],dispatched=[];
 const local=mode==='environment-local',device=mode==='device-login';
 // Use the Windows hydrator itself, with a controlled registry-query child.
 const environment=shell.createShellEnvironment({platform:'win32',env:{PATH:''},home:root,exists:()=>false,timeoutMs:5000,spawnImpl(){
  hydrationStarted=true;const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
  gate.promise.then(()=>{child.stdout.emit('data','    Path    REG_SZ    C:\\fixture-tools\n');child.emit('close',0);});return child;
 }});
 shell.install(environment);if(device)gate.resolve();
 const login=createProviderLogin({storeDir:root,platform:'win32',launch:async options=>{
  loginMessage=options.onMessage;return {ready:Promise.resolve(),finished:loginFinished.promise,send(){loginStarted=true;},stop(){loginStops++;}};
 }});
 const authentication=createProviderAuthentication({checkLogin:provider=>login.check(provider)});
 const pool=createProfileRuntimePool({registry,allocate:async()=>({port:14331,pgPort:14332}),readSecrets:async()=>({password:'fixture-password',token:'fixture-token'}),createRuntime:()=>({async start(){},async ready(){},async stop(){runtimeStops++;}})});
 const agent={...runs,async start(options){const run=runs.createRun(options);dispatched.push(run);run.onCancel=()=>{runs.finish(run);};run.emit({type:'status',model:'fixture'});return {runId:run.id};}};
 const profiles=createProfileService({registry,agent,runtimePool:pool,assertAuthentication:authentication,settingsFor:()=>({apiKey:'fixture-key',barkpark:{local:{enabled:local,source:path.join(root,'fixture-source')}}})});
 const owner=profiles.view();profiles.save(owner,{version:1,chats:{main:{id:'main',title:'Pending launch',provider:device?'codex':'api',folder:null,draft:'Retained human draft',messages:[],tabs:[]}},order:['main'],current:'main'});
 // Scope.env is captured from the controlled hydrator, so real credentials are not read.
 const starting=profiles.start(owner,{chatId:'main',prompt:'Controlled pending launch'}).then(value=>({value}),error=>({error:error.message}));
 await until(()=>device?loginStarted:hydrationStarted);
 if(!device)for(let i=0;i<10;i++)await tick();
 assert.equal(dispatched.length,0);
 const keeper=runs.createRun({profileId:profile.id,storeDir:registry.storeFor(profile.id).storeDir,chatId:'keeper',provider:'api',context:{chatId:'keeper',folder:null},send(){},onFinish:()=>keeperGate.promise});
 keeper.onCancel=()=>{runs.finish(keeper);};
 let handler,context;
 const source=fs.readFileSync(new URL('../../../../app/main/main.js',import.meta.url),'utf8');
 const begin=source.indexOf('let localQuitDone = false'),end=source.indexOf("app.on('will-quit'",begin);assert(begin>=0&&end>begin);
 const win={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send(name,id){if(name==='app:settle')queueMicrotask(()=>vm.runInContext(`quitSettlement.reply(${JSON.stringify(id)}, [])`,context));}}};
 context=vm.createContext({require,app:{on(name,fn){if(name==='before-quit')handler=fn;},quit(){quit++;},relaunch(){throw Error('Unexpected relaunch');}},win,bootBusy:false,browserSessions:new Map(),session:{},providerLogin:login,terminal:{shutdown:async()=>{shutdownEntered=true;}},goalService:{close:async()=>{}},profileService:profiles,profilePool:pool,localRuntime:null,agent,dialog:{showMessageBox:async(_w,options)=>{dialogs.push(options.detail);return {response:0};}},console,setTimeout,clearTimeout});
 vm.runInContext(source.slice(begin,end),context);vm.runInContext('cookiesFlushed=true',context);
 try {
  handler({preventDefault(){}});await until(()=>shutdownEntered);assert.equal(quit,0);
  if(device){assert(loginStops>0);loginMessage({type:'result',state:'signed-in'});loginFinished.resolve();}
  else gate.resolve();
  const result=await starting;
  if(device){assert.match(result.error,/pending or could not be checked/);assert.equal(dispatched.length,0);}
  else {assert(result.value?.runId);assert.equal(dispatched.length,1);assert.equal(dispatched[0].cancelled,false);}
  keeperGate.resolve();await runs.waitForRunFinish(keeper.id);await until(()=>quit>0||dialogs.length>0);
  const observation={mode,root,quit,runtimeStops,dialogs,loginStops,dispatched:dispatched.length,lateRunLive:dispatched.some(run=>runs.runs.has(run.id)),lateRunCancelled:dispatched[0]?.cancelled||false,draft:profiles.load(owner).chats.main.draft};
  console.log(JSON.stringify(observation));
  assert.equal(observation.draft,'Retained human draft');
  if(device){assert.equal(quit,1);assert.equal(login.status('codex').state,'cancelled');}
  else {if(local)assert.match(dialogs[0],/active run leases/);assert.equal(quit,0,'Quit must not complete while the late owned run is live');}
 }finally{
  gate.resolve();keeperGate.resolve();loginFinished.resolve();await starting;await runs.finish(keeper);
  for(const run of dispatched){runs.cancel(run.id);await runs.finish(run);await profiles.wait(owner,run.id);}
  await login.shutdown();await pool.shutdown();shell.install(null,{hydrate:false});
 }
});
