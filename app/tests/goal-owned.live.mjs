// Explicit authenticated execution against synthetic, retained disposable files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {createProfileRegistry}=require('../main/profile-registry');
const {createProfileService}=require('../main/profile-service');
const {createGoalService}=require('../main/goal-service');
const {createGoalWorkerAgent}=require('../main/goal-worker-agent');
if(process.env.BARKDOWN_RUN_GOAL_LIVE!=='1') throw new Error('Set BARKDOWN_RUN_GOAL_LIVE=1 for authenticated disposable goal execution');
const repo=fileURLToPath(new URL('../..',import.meta.url));
const source={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),dirty:Boolean(execFileSync('git',['status','--porcelain','--','app'],{cwd:repo,encoding:'utf8'}).trim())};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-owned-goal-live-'));
const registry=createProfileRegistry(path.join(root,'registry')),profile=registry.createProfile({name:'Disposable goal proof'});
registry.selectProfile(profile.id);
const profiles=createProfileService({registry,settingsFor:()=>({provider:'codex'})});
const owner={...profiles.view(),chatId:'coordinator'};
profiles.save(owner,{version:1,chats:{coordinator:{id:'coordinator',title:'Disposable goal proof',provider:'codex',folder:null,messages:[],draft:'Retained human draft',tabs:[]}},order:['coordinator'],current:'coordinator'});
const runtime=createGoalWorkerAgent();
const service=createGoalService({registry,profiles,agent:runtime,verifyTermination:({request,runId})=>runtime.verifyTermination({request:{...request,storeDir:registry.storeFor(request.profileId).storeDir},runId})});
let peakRunning=0,peakAssigned=0;
try {
  const goal=service.create(owner,{objective:'Read three independent synthetic inputs and report their exact tokens',durationMinutes:5,
    assignments:[1,2,3].map(i=>({title:`Read input ${i}`,prompt:`Read input.txt in your working folder. Reply with the exact token from that file and a brief note that you read it. Do not edit files, launch services, create workers, or use other conversations. This is a bounded verification task.`}))});
  const ws=profiles.load(owner);
  goal.tasks.forEach((task,i)=>{const folder=path.join(root,`worker-${i+1}`);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'input.txt'),`BARKDOWN_GOAL_${i+1}_OWNED\n`);Object.assign(ws.chats[task.chatId],{folder,provider:'codex',effort:'low'});});
  profiles.save(owner,ws);
  console.log(JSON.stringify({phase:'starting',root,profileId:profile.id,goalId:goal.id}));
  await service.command(owner,goal.id,'start');
  const until=Date.now()+300000;
  let current;
  while(Date.now()<until) {
    current=service.list(owner)[0];peakRunning=Math.max(peakRunning,current.tasks.filter(t=>t.status==='running').length);
    const receipts=current.tasks.map(t=>{try{return JSON.parse(fs.readFileSync(path.join(registry.storeFor(profile.id).storeDir,'goal-processes',`${t.attempts.at(-1)?.id}.receipt.json`)));}catch{return null;}});
    peakAssigned=Math.max(peakAssigned,receipts.filter(r=>r?.phase==='assigned').length);
    if(current.tasks.every(t=>!['pending','running'].includes(t.status)))break;
    await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(current.tasks.every(t=>t.status==='review'),JSON.stringify(current.tasks.map(t=>({status:t.status,result:t.attempts.at(-1)?.result}))));
  assert.equal(peakRunning,3);assert.equal(peakAssigned,3);
  const saved=profiles.load(owner);assert.equal(saved.chats.coordinator.draft,'Retained human draft');
  for(const [i,task] of current.tasks.entries()) {
    assert.ok(saved.chats[task.chatId].messages.at(-1).text.includes(`BARKDOWN_GOAL_${i+1}_OWNED`));
    assert.equal(saved.chats[task.chatId].runId,null);
    await service.command(owner,goal.id,'reviewTask',{taskId:task.id,accepted:true,note:'Compared actual provider reply with synthetic input bytes',evidence:[path.join(saved.chats[task.chatId].folder,'input.txt'),saved.chats[task.chatId].messages.at(-1).id]});
  }
  await service.command(owner,goal.id,'complete',{note:'All three actual worker results match independently owned input files',evidence:['three exact token comparisons','three simultaneous assigned Windows jobs']});
  const result={ok:true,source,root,provider:'codex',transport:'authenticated',peakRunning,peakAssigned,goalId:goal.id,profileId:profile.id,completed:service.list(owner)[0].status};
  fs.writeFileSync(path.join(root,'proof.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await service.close();}
