import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createProviderAuthentication}=require('../main/provider-authentication');
const {createProfileRegistry}=require('../main/profile-registry');
const {createProfileService}=require('../main/profile-service');
const agent=require('../main/agent');
const runs=require('../main/providers/runs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('device authentication is allowed without opt-in, missing auth is a positive pre-dispatch refusal',async()=>{
  let calls=0;
  const check=createProviderAuthentication({checkLogin:async()=>{calls++;return {state:'signed-in'};}});
  await check('api',{apiKey:'synthetic-owned'},{env:{}});
  await check('api',{}, {env:{ANTHROPIC_API_KEY:'synthetic-device'}});
  await check('api',{}, {env:{ANTHROPIC_AUTH_TOKEN:'synthetic-device-token'}});
  await check('claude',{}, {env:{CLAUDE_CODE_OAUTH_TOKEN:'synthetic-device-token'}});
  await check('codex',{}, {env:{CODEX_API_KEY:'synthetic-device-key'}});
  assert.equal(calls,0);
  await check('codex');await check('claude');assert.equal(calls,2);
  await assert.rejects(check('api',{}, {env:{}}),e=>e.code==='BARKDOWN_SEND_NOT_STARTED'&&e.authProvider==='api');
  const signedOut=createProviderAuthentication({checkLogin:async()=>({state:'signed-out'})});
  await assert.rejects(signedOut('codex'),e=>e.authProvider==='codex');
  const unknown=createProviderAuthentication({checkLogin:async()=>({state:'timed-out'})});
  await assert.rejects(unknown('claude'),e=>!e.authProvider&&e.code==='BARKDOWN_SEND_NOT_STARTED');
});
test('actual API adapter uses its owned key before the captured device fallback; no B-to-A borrowing',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-auth-api-')),used=[];
  const old=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='synthetic-device';
  agent.setClientFactory(options=>{used.push(options);return {messages:{stream(){return {on(){return this;},async finalMessage(){return {stop_reason:'end_turn',content:[{type:'text',text:'synthetic completion'}],usage:{}};}};}}};});
  try {
    for(const [label,key] of [['A','synthetic-owned-A'],['B','']]) {
      const storeDir=path.join(root,label);require('../main/store').createStore(storeDir);
      const result=await agent.start({profileId:crypto.randomUUID(),storeDir,chatId:'same',context:{folder:null},connection:{enabled:false},provider:'api',messages:[{role:'user',content:'fixture'}],settings:{apiKey:key},send(){}});
      await agent.waitForRunFinish(result.runId);
    }
    assert.deepEqual(used.map(options=>options.apiKey),['synthetic-owned-A','synthetic-device']);
    assert.ok(used.every(options=>options.authToken===null));
  } finally {agent.setClientFactory(null);if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;}
});
function fixture(assertAuthentication) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-auth-owner-')),registry=createProfileRegistry(root),a=registry.createProfile({name:'A'}),b=registry.createProfile({name:'B'});registry.selectProfile(a.id);
  const dispatched=[];const driver={...runs,async start(options){dispatched.push(options);return {runId:'unexpected'};}};
  const service=createProfileService({registry,agent:driver,assertAuthentication});
  const ws={version:1,chats:{main:{id:'main',title:'Main',provider:'codex',folder:null,draft:'Keep this',draftImages:[],messages:[],tabs:[]},side:{id:'side',title:'Side',parent:'main',provider:'codex',folder:null,draft:'Keep side',messages:[],tabs:[]}},order:['main','side'],current:'main'};
  service.save(service.view(),ws);return {service,registry,a,b,dispatched};
}
test('ordinary main and side missing-auth refusals preserve durable drafts without transcript reservation',async()=>{
  const check=createProviderAuthentication({checkLogin:async()=>({state:'signed-out'})});const f=fixture(check),owner=f.service.view();
  for(const chatId of ['main','side'])await assert.rejects(f.service.start(owner,{chatId,prompt:'attempt',attemptId:crypto.randomUUID()}),e=>e.authProvider==='codex');
  const ws=f.service.load(owner);assert.equal(ws.chats.main.draft,'Keep this');assert.equal(ws.chats.side.draft,'Keep side');assert.equal(ws.chats.main.messages.length,0);assert.equal(ws.chats.side.messages.length,0);assert.equal(f.dispatched.length,0);
});
test('context changed while checking authentication refuses before ordinary or goal reservation',async()=>{
  const gate=deferred();const f=fixture(()=>gate.promise),owner=f.service.view();const resolved=await f.service.resolve(f.a.id,'side');
  const checking=resolved.assertAuthentication();const ws=f.service.load(owner);ws.chats.side.provider='claude';f.service.save(owner,ws);gate.resolve();
  await assert.rejects(checking,e=>e.code==='BARKDOWN_SEND_NOT_STARTED');await resolved.release();assert.equal(f.dispatched.length,0);
});

test('actual CLI adapters retain captured device authentication through delayed SDK loading',async()=>{
  const {captureScope}=require('../main/providers/run-scope');
  for(const provider of ['claude','codex']) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-auth-cli-')),profileId=crypto.randomUUID();require('../main/store').createStore(root);
    const base=captureScope({profileId,storeDir:root,context:{chatId:'side',folder:null},connection:{enabled:false}});
    const env=Object.freeze({...base.env,ANTHROPIC_API_KEY:'synthetic-device-A',ANTHROPIC_AUTH_TOKEN:'synthetic-token-A',CODEX_API_KEY:'synthetic-codex-A',CODEX_HOME:path.join(root,'codex'),CLAUDE_CONFIG_DIR:path.join(root,'claude')});
    const scope=Object.freeze({...base,env}),transport=require('../main/providers/'+provider),gate=deferred(),events=[];let observed;
    transport.setSdkLoader(()=>gate.promise);
    try {
      const started=await agent.start({profileId,storeDir:root,scope,chatId:'side',context:scope.context,provider,prompt:'synthetic request',messages:[],settings:{apiKey:'profile-api-must-not-reach-cli'},send:e=>events.push(e)});
      const sdk=provider==='claude'?{query({options}){observed=options.env;return(async function*(){yield{type:'result',subtype:'success',result:'synthetic completion'};})();}}:{Codex:class{constructor(options){observed=options.env;}startThread(){return{id:'fixture-session',async runStreamed(){return{events:(async function*(){yield{type:'item.completed',item:{id:'text',type:'agent_message',text:'synthetic completion'}};yield{type:'turn.completed',usage:{}};})()};}};}}};
      gate.resolve(sdk);await agent.waitForRunFinish(started.runId);
      for(const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CODEX_API_KEY','CODEX_HOME','CLAUDE_CONFIG_DIR'])assert.equal(observed[key],env[key]);
      assert.ok(events.every(e=>e.profileId===profileId&&e.chatId==='side'));
      assert.doesNotMatch(JSON.stringify(events),/synthetic-device-A|synthetic-token-A|synthetic-codex-A|profile-api-must-not-reach-cli/);
    } finally {transport.setSdkLoader(null);}
  }
});

test('production child worker protocol preserves A/B credentials through native owned jobs', {skip:process.platform!=='win32',timeout:60000},async()=>{
  const {captureScope}=require('../main/providers/run-scope'),{createGoalWorkerAgent}=require('../main/goal-worker-agent');
  const script=path.join(import.meta.dirname,'fixtures/goal-auth-worker.cjs');
  for(const provider of ['api','claude','codex']) for(const label of ['A','B']) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-auth-child-')),profileId=crypto.randomUUID();require('../main/store').createStore(root);
    const base=captureScope({profileId,storeDir:root,context:{chatId:'worker',folder:null},connection:{enabled:false}});
    const expected=label==='A'?'synthetic-owned-A':'synthetic-shared-device';
    const scope=Object.freeze({...base,env:Object.freeze({...base.env,ANTHROPIC_API_KEY:'synthetic-shared-device',ANTHROPIC_AUTH_TOKEN:'',CLAUDE_CODE_OAUTH_TOKEN:'synthetic-captured-oauth',CODEX_API_KEY:'synthetic-captured-codex',BARKDOWN_FIXTURE_EXPECTED_API:expected})});
    const events=[],runtime=createGoalWorkerAgent({script});
    const run=await runtime.start({profileId,chatId:'worker',provider,scope,attemptId:crypto.randomUUID(),settings:{apiKey:label==='A'?'synthetic-owned-A':'',goalWorker:true},messages:[{role:'user',content:'fixture'}],prompt:'fixture',images:[],send:e=>events.push(e)});
    const result=await runtime.waitForRunFinish(run.runId);
    assert.equal(result.status,'completed');assert.ok(events.some(e=>e.type==='text_delta'&&e.text==='Captured worker credentials verified'));
    assert.ok(events.every(e=>e.profileId===profileId&&e.chatId==='worker'));
    assert.doesNotMatch(JSON.stringify(events),/synthetic-owned-A|synthetic-shared-device|synthetic-captured-oauth|synthetic-captured-codex/);
  }
});

test('actual CLI failures preserve captured owner and only authentication failures offer recovery',async()=>{
  const {captureScope}=require('../main/providers/run-scope');
  for(const provider of ['claude','codex']) for(const authentication of [true,false]) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-expired-')),profileId=crypto.randomUUID();require('../main/store').createStore(root);
    const scope=captureScope({profileId,storeDir:root,context:{chatId:'saved-side',folder:null},connection:{enabled:false}}),events=[];
    const transport=require('../main/providers/'+provider);
    transport.setSdkLoader(async()=>provider==='claude'?{query(){return(async function*(){yield{type:'assistant',error:authentication?'authentication_failed':'rate_limit',message:{content:[]}};yield{type:'result',subtype:'error_during_execution',usage:{}};})();}}:{Codex:class{startThread(){return{id:'expired-thread',async runStreamed(){return{events:(async function*(){yield{type:'turn.failed',error:{status:authentication?401:429,message:authentication?'private provider detail':'Rate limited'}};})()};}};}}});
    try {
      const run=await agent.start({profileId,storeDir:root,scope,chatId:'saved-side',context:scope.context,provider,prompt:'Keep my message',messages:[],settings:{},send:event=>events.push(event)});
      await agent.waitForRunFinish(run.runId);
      assert.ok(events.every(event=>event.profileId===profileId&&event.chatId==='saved-side'));
      assert.equal(events.some(event=>event.authProvider===provider),authentication);
      if(authentication){assert.equal(events.some(event=>event.type==='done'),false);assert.doesNotMatch(JSON.stringify(events),/private provider detail/);}
    } finally {transport.setSdkLoader(null);}
  }
});
