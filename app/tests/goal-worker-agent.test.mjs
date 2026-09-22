import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {createGoalWorkerAgent}=require('../main/goal-worker-agent');
const {captureScope}=require('../main/providers/run-scope');
const {verifyOwnedWorker}=require('../main/goal-process');
const script=fileURLToPath(new URL('./fixtures/goal-worker-protocol.cjs',import.meta.url));
test('verified settled completion retention is bounded without dropping unresolved proof', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-worker-retention-')),profileId=randomUUID();
  const scope=captureScope({profileId,storeDir:root,context:{chatId:'worker'},connection:{enabled:false}});
  let calls=0;
  const runtime=createGoalWorkerAgent({launch:async ({onMessage})=>{
    if(++calls===1)throw new Error('Uncertain launch fixture');
    onMessage({type:'event',event:{profileId,chatId:'worker',provider:'api',type:'done'}});onMessage({type:'complete'});
    return {ready:Promise.resolve(),finished:Promise.resolve({}),send(){},stop(){}};
  },verify:async()=>true});
  const options=()=>({profileId,chatId:'worker',provider:'api',scope,attemptId:randomUUID(),settings:{},messages:[],images:[],send(){}});
  const unresolvedOptions=options(),uncertain=await runtime.start(unresolvedOptions);await assert.rejects(runtime.waitForRunFinish(uncertain.runId),/Uncertain launch/);
  let first;
  for(let i=0;i<202;i++){const r=await runtime.start(options());first ||= r;await runtime.waitForRunFinish(r.runId);}
  await assert.rejects(runtime.waitForRunFinish(first.runId),/Unknown|unknown|not found|unavailable/);
  await assert.rejects(runtime.waitForRunFinish(uncertain.runId),/Uncertain launch/);
  const identity=require('../main/providers/runs').runs.get(uncertain.runId);
  assert.ok(identity,'unproven registry entry retained');
  assert.equal(await runtime.verifyTermination({request:{profileId,storeDir:root,attemptId:unresolvedOptions.attemptId},runId:uncertain.runId}),true);
});
test('real job-owned worker bridges exact owner, approvals, sessions and finalization', {skip:process.platform!=='win32',timeout:30000}, async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-worker-bridge-')),profileId=randomUUID(),attemptId=randomUUID();
  const scope=captureScope({profileId,storeDir:root,context:{chatId:'worker',folder:null},connection:{enabled:false}});
  const runtime=createGoalWorkerAgent({script});const events=[];let released=0,approvalReady;
  const approval=new Promise(r=>approvalReady=r);
  const started=await runtime.start({profileId,chatId:'worker',provider:'codex',scope,goalAttemptId:attemptId,settings:{},images:[],messages:[],prompt:'fixture',
    onFinish(){released++;},send(e){events.push(e);if(e.type==='approval')approvalReady(e);}});
  const request=await approval;
  assert.equal(request.runId,started.runId);assert.notEqual(request.approvalId,'child-approval');assert.equal(released,0);
  assert.equal(runtime.respondApproval(started.runId,request.approvalId,true),true);
  const finished=await runtime.waitForRunFinish(started.runId);
  assert.equal(finished.status,'completed');assert.equal(released,1);assert.equal(events.find(e=>e.type==='done').session,'owned-session');
  assert.ok(events.every((e,i)=>e.profileId===profileId&&e.chatId==='worker'&&e.runId===started.runId&&e.sequence===i+1));
  assert.equal(await verifyOwnedWorker({storeDir:root,profileId,attemptId}),true);
});
test('cancelling an approval-held real worker waits for job drain and releases lease once', {skip:process.platform!=='win32',timeout:30000}, async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-worker-cancel-')),profileId=randomUUID();
  const scope=captureScope({profileId,storeDir:root,context:{chatId:'worker',folder:null},connection:{enabled:false}});
  const runtime=createGoalWorkerAgent({script});let ready, released=0;
  const approval=new Promise(r=>ready=r);
  const started=await runtime.start({profileId,chatId:'worker',provider:'codex',scope,goalAttemptId:randomUUID(),settings:{},images:[],messages:[],prompt:'fixture',onFinish(){released++;},send(e){if(e.type==='approval')ready();}});
  await approval;runtime.cancel(started.runId);assert.equal(released,0);
  const finished=await runtime.waitForRunFinish(started.runId);assert.equal(finished.cancelled,true);assert.equal(released,1);
});
test('20MiB image descriptor and6MiB history cross the real bridge in both directions without truncation', {skip:process.platform!=='win32',timeout:30000},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-worker-large-')),profileId=randomUUID(),imagePath=path.join(root,'attachment.png');
  fs.writeFileSync(imagePath,Buffer.alloc(20*1024*1024));
  const scope=captureScope({profileId,storeDir:root,context:{chatId:'worker',folder:null},connection:{enabled:false}});
  const runtime=createGoalWorkerAgent({script}),events=[],history='x'.repeat(6*1024*1024);
  const started=await runtime.start({profileId,chatId:'worker',provider:'api',scope,goalAttemptId:randomUUID(),settings:{},images:[{id:'image',path:imagePath,mime:'image/png'}],messages:[{role:'user',content:history}],prompt:'large fixture',send(e){events.push(e);if(e.type==='approval')runtime.respondApproval(e.runId,e.approvalId,true);}});
  assert.equal((await runtime.waitForRunFinish(started.runId)).status,'completed');
  const observed=JSON.parse(events.find(e=>e.type==='text_delta').text);
  assert.equal(observed.imageBytes,20*1024*1024);assert.equal(observed.historyLength,history.length);assert.deepEqual(observed.imageDescriptorKeys,['id','path','mime']);
  assert.equal(events.find(e=>e.type==='done').history[0].content,history);
});
test('malformed post-handshake message overrides an earlier success and persists failed completion', {skip:process.platform!=='win32',timeout:30000},async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-worker-protocol-')),profileId=randomUUID();
  const scope=captureScope({profileId,storeDir:root,context:{chatId:'worker',folder:null},connection:{enabled:false}});
  const runtime=createGoalWorkerAgent({script}),events=[];
  const started=await runtime.start({profileId,chatId:'worker',provider:'codex',scope,goalAttemptId:randomUUID(),settings:{},images:[],messages:[],prompt:'malformed-after-completion',send:e=>events.push(e)});
  assert.equal((await runtime.waitForRunFinish(started.runId)).status,'failed');assert.equal(events.at(-1).type,'error');
});
