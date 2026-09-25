// Readiness probe, not a migration activation test. Run from the repository root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createRequire} = require('node:module');
const req = createRequire(path.join(process.cwd(), 'app/main/profile-service.js'));
const {createProfileRegistry} = req('./profile-registry');
const {createProfileService} = req('./profile-service');
const {controller} = req('./writer-admission');
const {createStore} = req('./store');
const deferred = () => { let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve}; };
(async () => {
  const results=[];
  for (const boundary of ['runtime-acquire', 'authentication']) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-run-drain-probe-'));
    const registry=createProfileRegistry(root), a=registry.createProfile({name:'A'}), b=registry.createProfile({name:'B'});
    registry.selectProfile(a.id);
    const entered=deferred(), gate=deferred(); let released=0, dispatched=0, settled=false;
    const profiles=createProfileService({registry, agent:{async start(){dispatched++; throw new Error('Unexpected SDK dispatch');}},
      settingsFor:()=>({provider:'api',barkpark:{local:{enabled:true,source:root}}}),
      runtimePool:{async acquire(){if(boundary==='runtime-acquire'){entered.resolve();await gate.promise;} return {connection:{enabled:false},release:async()=>{released++;}};}},
      assertAuthentication:async()=>{if(boundary==='authentication'){entered.resolve();await gate.promise;}}
    });
    const owner=profiles.view(); profiles.save(owner,{version:1,chats:{same:{id:'same',title:'Probe',folder:null,provider:'api',messages:[],tabs:[]}},order:['same'],current:'same'});
    const pending=profiles.start(owner,{chatId:'same',prompt:'Delayed turn'}).then(()=>({unexpected:true}),e=>({error:e.message,code:e.code})).finally(()=>{settled=true;});
    await entered.promise;
    const fence=controller(createStore(registry.storeFor(a.id).storeDir, {create:false})), token=fence.quiesce(fence.capture());
    const reported=fence.assertQuiescent(token);
    assert.equal(reported.quiescent,true); assert.equal(settled,false); assert.equal(released,0);
    // This establishes the missing coordinator boundary: writer drain alone does
    // not wait for a pending ordinary start or release its captured runtime lease.
    gate.resolve(); const outcome=await pending;
    assert.ok(outcome.error); assert.equal(dispatched,0); assert.equal(released,1);
    const other=controller(createStore(registry.storeFor(b.id).storeDir, {create:false})); assert.equal(other.inspect().phase,'open');
    results.push({boundary,writerDrainReportedQuiescentWhileStartPending:true,releaseCountAtDrain:0,releaseCountAfterSettlement:released,sdkDispatches:dispatched,outcome,otherProfilePhase:'open'});
  }
  const report={at:new Date().toISOString(),source:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Actual profile service, workspace and writer controller with deferred runtime/auth adapters; no live provider or child termination claim.',results,next:'Profile-specific new-turn closure must track pending resolve/auth/dispatch before admitting migration preparation; retain writer admission until transcript and owned child cleanup settle.'};
  fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
