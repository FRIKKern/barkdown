import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createProfileRegistry}=require('../main/profile-registry');
const {createProfileService}=require('../main/profile-service');
const {createGoalService}=require('../main/goal-service');
const {createGoalWorkerAgent}=require('../main/goal-worker-agent');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('real host crash reopens paused goal, trusted default verifier reconciles, explicit retry completes saved worker', {timeout:30000},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-goal-recover-'));
  const child=spawn(process.execPath,[fileURLToPath(new URL('./fixtures/goal-service-crash.cjs',import.meta.url)),root],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',b=>stderr+=b);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});assert.equal(code,23,stderr);
  const {profileId,goalId}=JSON.parse(fs.readFileSync(path.join(root,'owner.json')));
  const registry=createProfileRegistry(path.join(root,'registry')),profiles=createProfileService({registry});
  const owner={...profiles.view(),chatId:'main'};assert.equal(owner.profileId,profileId);
  const service=createGoalService({registry,profiles,heartbeatMs:0});
  try {
    const recovered=service.list(owner)[0];assert.equal(recovered.status,'paused');assert.equal(recovered.tasks[0].status,'interrupted');
    await assert.rejects(service.command(owner,goalId,'start'),/Reconcile/);
    const review={taskId:'task-1',accepted:false,retry:true,note:'Read partial persisted reply; assignment still remains',evidence:['persisted assistant reply','owned job shutdown receipt']};
    await assert.rejects(service.command(owner,goalId,'reviewTask',review),/termination|still has a run/);
    let reconciled=false;
    for(let i=0;i<20&&!reconciled;i++) {try{await service.command(owner,goalId,'reconcileTermination',{taskId:'task-1'});reconciled=true;}catch(error){if(!/not been established/.test(error.message))throw error;await delay(100);}}
    assert.equal(reconciled,true);await service.command(owner,goalId,'reviewTask',review);
    assert.equal(service.list(owner)[0].tasks[0].status,'pending');assert.equal(profiles.load(owner).chats.main.draft,'Human draft before crash');
  } finally {await service.close();}
  const agent=createGoalWorkerAgent({script:fileURLToPath(new URL('./fixtures/goal-worker-protocol.cjs',import.meta.url))});
  const resumed=createGoalService({registry,profiles,agent,sendProviderEvent(event){if(event.type==='approval')agent.respondApproval(event.runId,event.approvalId,true);}});
  try {
    await resumed.command(owner,goalId,'start');
    let goal;
    for(let i=0;i<100;i++){goal=resumed.list(owner)[0];if(goal.tasks[0].status==='review')break;await delay(50);}
    assert.equal(goal.tasks[0].status,'review');assert.equal(goal.tasks[0].attempts.length,2);
    const worker=profiles.load(owner).chats[goal.tasks[0].chatId];assert.equal(worker.messages.length,4);assert.match(worker.messages.at(-1).text,/approved/);
    assert.equal(worker.messages[1].streaming,false);assert.equal(worker.runId,null);
    await resumed.command(owner,goalId,'pause');
  }finally{await resumed.close();}
});
