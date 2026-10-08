// Exact main quit + real profile/owned-agent/native Windows job, controlled dispatch delay.
// This is a Node/VM integration probe, not actual Electron exit or a provider run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const repo=process.cwd(),require=createRequire(path.join(repo,'app/main/main.js'));
assert.equal(process.platform,'win32');
const {createProfileRegistry}=require('./profile-registry');
const {createProfileService}=require('./profile-service');
const {createOwnedWorkerAgent}=require('./goal-worker-agent');
const {launchOwnedWorker,verifyOwnedWorker}=require('./goal-process');
const runs=require('./providers/runs'),shell=require('./shell-environment');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-native-quit-'));
const env={SystemRoot:process.env.SystemRoot,TEMP:root,TMP:root,USERPROFILE:root,PATH:path.dirname(process.execPath)};
shell.install({current:()=>env},{hydrate:false});
const registry=createProfileRegistry(root),profile=registry.createProfile({name:'Disposable native quit'});registry.selectProfile(profile.id);
let releaseDispatch,dispatchEntered=false,host,registered,quit=0,handler,context,quitObservation,terminalEntered=false;
const dispatchGate=new Promise(resolve=>releaseDispatch=resolve),dialogs=[];
const owned=createOwnedWorkerAgent({script:path.join(import.meta.dirname,'native-quit-worker.cjs'),launch:async options=>{host=await launchOwnedWorker(options);return host;}});
const agent={...owned,async start(options){dispatchEntered=true;await dispatchGate;registered=await owned.start(options);return registered;}};
const profiles=createProfileService({registry,agent,settingsFor:()=>({barkpark:{local:{enabled:false}}})});
const owner=profiles.view();profiles.save(owner,{version:1,chats:{main:{id:'main',title:'Native quit',provider:'api',folder:null,draft:'Native late-launch draft',messages:[],tabs:[]}},order:['main'],current:'main'});
async function until(predicate,label){const end=Date.now()+30000;while(!predicate()){assert(Date.now()<end,label);await new Promise(resolve=>setTimeout(resolve,10));}}
const source=fs.readFileSync(path.join(import.meta.dirname,'native-quit-baseline-main.txt'),'utf8');const start=source.indexOf('let localQuitDone = false'),end=source.indexOf("app.on('will-quit'",start);assert(start>=0&&end>start);
const win={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send(name,id){if(name==='app:settle')queueMicrotask(()=>vm.runInContext(`quitSettlement.reply(${JSON.stringify(id)}, [])`,context));}}};
context=vm.createContext({require,app:{on(name,fn){if(name==='before-quit')handler=fn;},quit(){quit++;quitObservation={liveRuns:runs.runs.size,receipt:host?JSON.parse(fs.readFileSync(host.receiptPath,'utf8')):null};},relaunch(){throw Error('Unexpected relaunch');}},win,bootBusy:false,browserSessions:new Map(),session:{},profileService:profiles,profilePool:null,localRuntime:null,providerLogin:null,terminal:{shutdown:async()=>{terminalEntered=true;}},goalService:null,agent,dialog:{showMessageBox:async(_window,options)=>{dialogs.push(options.detail);return {response:0};}},console,setTimeout,clearTimeout});
vm.runInContext(source.slice(start,end),context);vm.runInContext('cookiesFlushed=true',context);
const pending=profiles.start(owner,{chatId:'main',prompt:'Controlled native job'});
try {
 await until(()=>dispatchEntered,'start reached controlled driver delay');
 assert.equal(runs.runs.size,0);assert.equal(host,undefined);
 handler({preventDefault(){}});
 await until(()=>terminalEntered,'quit accepted renderer settlement');
 await new Promise(resolve=>setTimeout(resolve,150));
 assert.equal(quit,0,'quit waits for pending ticket despite empty driver snapshot');
 assert.equal(host,undefined,'no native helper exists at the snapshot');
 releaseDispatch();const result=await pending;
 await until(()=>quit||dialogs.length,'native late job settled');
 assert.deepEqual(dialogs,[]);assert.equal(quit,1);
 assert.equal(quitObservation.liveRuns,0);
 assert.equal(quitObservation.receipt.phase,'stopped');assert.equal(quitObservation.receipt.activeProcesses,0);
 assert(quitObservation.receipt.childPid>0,'a real native child was assigned');
 assert.equal(quitObservation.receipt.containment,'job-list-v1');
 assert.equal(await verifyOwnedWorker({storeDir:registry.storeFor(profile.id).storeDir,profileId:profile.id,attemptId:result.attemptId}),true);
 const completion=await profiles.wait(owner,result.runId);assert.equal(completion.runId,result.runId);assert.equal(completion.profileId,profile.id);assert.notEqual(completion.cleanupFailed,true);
 const draft=profiles.load(owner).chats.main.draft;assert.equal(draft,'Native late-launch draft');
 profiles.launchAdmission.assertOpen(profile.id);
 console.log(JSON.stringify({passed:'late real Windows job drained before exact main quit callback',root,result,quitObservation,completion,draft,limits:['Controlled dispatch delay','Node/VM main handler, no Electron exit','No provider, real library, or descendant-tree claim']}));
}finally{
 releaseDispatch();await pending.catch(()=>{});
 if(registered){owned.cancel(registered.runId);await owned.waitForRunFinish(registered.runId).catch(()=>{});}
 if(host){host.stop();await host.finished.catch(()=>{});}
 shell.install(null,{hydrate:false});
}
