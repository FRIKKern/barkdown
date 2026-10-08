// Diagnostic only: actual GoalService/driver registry and the exact main quit
// handler, with controlled provider completion and native/runtime adapters.
// This proves receipt/orchestration behavior, not native process loss.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../app/main/main.js', import.meta.url));
const { createProfileRegistry } = require('./profile-registry');
const { createProfileService } = require('./profile-service');
const { createGoalService } = require('./goal-service');
const agent = require('./agent'), runs = require('./providers/runs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise=new Promise(r=>resolve=r);return {promise,resolve}; };
function fixture() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-quit-backend-'));
 const registry=createProfileRegistry(path.join(root,'registry')), p=registry.createProfile({name:'Disposable backend'});registry.selectProfile(p.id);
 const profiles=createProfileService({registry,settingsFor:()=>({apiKey:'fixture-key',forceOnline:true})});
 const owner={...profiles.view(),chatId:'main'};
 profiles.save(owner,{version:1,chats:{main:{id:'main',title:'Backend quit',provider:'api',folder:null,draft:'Retained human draft',messages:[],tabs:[]}},order:['main'],current:'main'});
 return {root,registry,profiles,owner};
}
await test('a repeated goal close must wait for the existing driver drain', async()=>{
 const f=fixture(),gate=deferred();let launched=0,firstDone=false,secondDone=false,registryDone=false;
 agent.setClientFactory(()=>({messages:{stream(){launched++;return {on(){return this;},async finalMessage(){await gate.promise;return {stop_reason:'end_turn',usage:{},content:[{type:'text',text:'Controlled completion'}]};}};}}}));
 const service=createGoalService({...f,agent,heartbeatMs:0});
 const goal=service.create(f.owner,{objective:'Controlled close barrier',durationMinutes:5,assignments:[1,2,3].map(i=>({title:`Worker ${i}`,prompt:`Fixture ${i}`}))});
 let first,second,registryWait;
 try {
  await service.command(f.owner,goal.id,'start');const deadline=Date.now()+5000;while(launched<3){assert(Date.now()<deadline);await tick();}
  const owned=[...runs.runs.values()].filter(r=>r.scope.profileId===f.owner.profileId);
  assert.equal(owned.length,3);
  first=service.close().then(()=>{firstDone=true;});
  second=service.close().then(()=>{secondDone=true;});
  registryWait=Promise.all(owned.map(r=>agent.waitForRunFinish(r.id))).then(()=>{registryDone=true;});
  for(let i=0;i<10;i++)await tick();
  const observed={root:f.root,launched,firstDone,secondDone,registryDone,liveRuns:runs.runs.size};
  gate.resolve();await Promise.all([first,second,registryWait]);
  observed.afterRelease={firstDone,secondDone,registryDone,liveRuns:runs.runs.size,draft:f.profiles.load(f.owner).chats.main.draft};
  console.log(JSON.stringify({goalClose:observed}));
  assert.equal(observed.firstDone,false);assert.equal(observed.registryDone,false,'Main registry wait still protects active drivers');
  assert.equal(observed.afterRelease.draft,'Retained human draft');
  assert.equal(observed.secondDone,false,'A second close cannot acknowledge an unfinished drain');
 } finally {gate.resolve();await first;await second;await registryWait;await service.close();agent.setClientFactory(null);}
});
await test('main quit must refuse a resolved cleanup-failed driver receipt',async()=>{
 const f=fixture();const source=fs.readFileSync(path.resolve('app/main/main.js'),'utf8');
 const start=source.indexOf('let localQuitDone = false'),end=source.indexOf("app.on('will-quit'",start);assert(start>=0&&end>start);
 const receiptGate=deferred();let handler,quit=0,runtimeStops=0;const dialogs=[],sent=[];
 const app={on(name,fn){if(name==='before-quit')handler=fn;},quit(){quit++;},relaunch(){throw Error('Unexpected relaunch');}};
 let context;
 const win={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send(name,id){sent.push(name);if(name==='app:settle')queueMicrotask(()=>vm.runInContext(`quitSettlement.reply(${JSON.stringify(id)}, [])`,context));}}};
 context=vm.createContext({require,app,win,bootBusy:false,browserSessions:new Map(),session:{},providerLogin:null,terminal:{shutdown:async()=>{}},goalService:{close:async()=>{}},profilePool:{shutdown:async()=>{runtimeStops++;}},localRuntime:null,agent,dialog:{showMessageBox:async(_w,o)=>{dialogs.push(o);return {response:0};}},console,setTimeout,clearTimeout});
 vm.runInContext(source.slice(start,end),context);vm.runInContext('cookiesFlushed=true',context);
 const run=runs.createRun({chatId:'main',profileId:f.owner.profileId,storeDir:f.registry.storeFor(f.owner.profileId).storeDir,context:{chatId:'main',folder:null},provider:'api',send(){},onFinish:async()=>{await receiptGate.promise;throw Error('Controlled owned cleanup refusal');}});
 run.onCancel=()=>{runs.finish(run);};
 try {
  handler({preventDefault(){}});for(let i=0;i<10;i++)await tick();assert.equal(quit,0);assert.equal(runtimeStops,0,'Pending cleanup still blocks runtime stop');
  receiptGate.resolve();const receipt=await runs.waitForRunFinish(run.id);assert.equal(receipt.cleanupFailed,true);
  for(let i=0;i<10;i++)await tick();
  console.log(JSON.stringify({mainQuit:{root:f.root,receipt,runtimeStops,quit,dialogs:dialogs.map(d=>d.detail),sent,scope:'Exact main handler and actual registry; controlled native/runtime adapters, no real process or Electron exit.'}}));
  assert.equal(runtimeStops,0,'Explicit cleanup-failed must prevent runtime stop');assert.equal(quit,0,'Explicit cleanup-failed must keep the app open');
 }finally{receiptGate.resolve();await runs.finish(run);}
});
