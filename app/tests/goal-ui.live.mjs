// Real Electron goal component with an explicitly injected fixture service.
// This verifies UI controls/ownership, not persisted workspace or model integration.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-goal-ui-'));
const out=path.join(appDir,'test-results','goals');fs.mkdirSync(out,{recursive:true});
const app=await electron.launch({executablePath:require('electron'),args:[appDir, '--legacy',`--user-data=${profile}`],env:{...process.env,ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',BARKDOWN_PROVIDER:'api'}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1100,height:800});
 await page.locator('#bw-prompt').fill('Keep my main conversation draft.');
 await page.evaluate(()=>{
  const owner={profileId:'11111111-1111-4111-8111-111111111111',chatId:window.__barkdown.state.current,generation:1};
  let goals=[],notify;const calls=[];
  const service={list:async request=>{calls.push({method:'list',owner:request});return structuredClone(goals);},subscribe:(_owner,fn)=>{notify=fn;return()=>{notify=null;};},
   create:async(request,input)=>{calls.push({method:'create',owner:request,input});goals=[{id:'fixture-goal',objective:input.objective,status:'planned',deadline:Date.now()+input.durationMinutes*60000,tasks:input.assignments.map((a,i)=>({id:`task-${i+1}`,title:a.title,chatId:`worker-${i+1}`,prompt:a.prompt,dependsOn:i===2?['task-1']:[],status:'pending',context:{provider:'api',model:'test-model',effort:'high',folder:null},attempts:[]}))}];},
   command:async(request,id,action,payload)=>{calls.push({method:'command',owner:request,id,action,payload});const goal=goals[0];if(action==='start'){goal.status='active';goal.tasks.slice(0,2).forEach(t=>{t.status='running';t.attempts.push({id:'fixture-attempt-'+t.id,status:'running',progress:{text:'Observed fixture progress'}});});}if(action==='pause'){goal.status='paused';goal.tasks.filter(t=>t.status==='running').forEach(t=>{t.status='interrupted';t.attempts.at(-1).reason='Provider stopped; inspect effects before retry.';t.attempts.at(-1).stoppedAt=Date.now();});}if(action==='reviewTask'){goal.tasks.find(t=>t.id===payload.taskId).status=payload.accepted?'completed':'pending';}if(action==='cancel')goal.status='cancelled';},
  };
  window.__goalFixture={calls,service,owner,setAuthFailure:(provider='codex')=>{goals[0].status='paused';const t=goals[0].tasks[0];t.status='failed';t.attempts.at(-1).result={status:'failed',text:'Sign in to Codex to continue.',authProvider:provider};},open:()=>window.__barkdown.openGoalView({owner,service,...(goals[0]?.tasks[0].attempts.at(-1)?.result?.authProvider==='api'?{openAuthentication:(captured,provider)=>calls.push({method:'auth',owner:captured,provider})}:{}),openChat:(captured,id)=>calls.push({method:'open',owner:captured,id})}),notify:()=>notify?.(),setExpired:()=>{goals[0].status='expired';notify?.();}};
  window.__goalFixture.open();
 });
 const view=page.getByRole('dialog',{name:'Conversation goals'});await view.locator('[data-create]').waitFor();
 await view.getByLabel('Goal',{exact:true}).fill('Verify a durable three-worker delivery');
 await view.getByLabel('Planning',{exact:true}).selectOption('manual');
 for(let n=1;n<=3;n++)await view.getByLabel(`Worker ${n} assignment`).fill(['Inspect ownership boundaries','Exercise interruption recovery','Review the resulting evidence'][n-1]);
 await view.getByLabel('Time window in minutes').fill('120');await view.getByRole('button',{name:'Create planned goal'}).click();
 await view.getByText('Ready to start',{exact:true}).waitFor();assert.equal(await page.locator('#bw-prompt').inputValue(),'Keep my main conversation draft.');
 await view.getByRole('button',{name:'Start',exact:true}).click();await view.getByText('In progress',{exact:true}).waitFor();
 assert.equal(await view.getByText('Running',{exact:true}).count(),2);assert.equal(await view.getByText('Waiting for reviewed dependency').count(),1);
 await page.screenshot({path:path.join(out,'running.png')});
 await view.getByRole('button',{name:'Pause',exact:true}).click();await view.getByText('Paused',{exact:true}).waitFor();
 assert.equal(await view.getByText('Needs reconciliation',{exact:true}).count(),2);
 const review=view.locator('[data-task="task-1"] .bw-goal-review');await review.locator('summary').click();
 await review.getByLabel('What did you verify?').fill('The owned run stopped and its persisted output matches the assignment.');
 await review.getByLabel('Evidence references, one per line').fill('test-results/ownership.json\nrevision 4');
 await view.getByRole('button',{name:'Refresh',exact:true}).click();
 // A refresh preserves typed evidence even when focus moved to the button.
 await page.waitForTimeout(50);assert.match(await view.locator('[data-review="task-1"] textarea[name="note"]').inputValue(),/owned run stopped/);
 const refreshed=view.locator('[data-task="task-1"] .bw-goal-review');if(!await refreshed.evaluate(e=>e.open))await refreshed.locator('summary').click();
 await refreshed.getByRole('button',{name:'Accept verified work'}).click();await view.getByText('Reviewed',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:800});await page.screenshot({path:path.join(out,'narrow.png')});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1100,height:800});await page.evaluate(()=>window.__goalFixture.setExpired());await view.getByText('Time window ended').waitFor();
 assert.equal(await view.getByRole('button',{name:'Resume',exact:true}).count(),0);assert.equal(await view.getByRole('button',{name:'Reconciled; retry remaining work'}).count(),0);
 await page.screenshot({path:path.join(out,'expired.png')});
 await view.getByRole('button',{name:'Worker 2 ↗'}).click();assert.equal(await view.count(),0);
 const calls=await page.evaluate(()=>window.__goalFixture.calls);assert.ok(calls.every(c=>c.owner.profileId==='11111111-1111-4111-8111-111111111111'));
 const accepted=calls.find(c=>c.action==='reviewTask');assert.deepEqual(accepted.payload.evidence,['test-results/ownership.json','revision 4']);
 assert.equal(calls.at(-1).id,'worker-2');assert.deepEqual(errors,[]);
 await page.evaluate(()=>{window.__goalFixture.setAuthFailure();window.__goalFixture.open();});
 await view.getByRole('button',{name:'Sign-in help',exact:true}).click();
 await page.getByRole('dialog',{name:'Sign in to Codex',exact:true}).waitFor();
 assert.equal(await page.locator('#bw-prompt').inputValue(),'Keep my main conversation draft.');
 assert.equal((await page.evaluate(()=>window.__goalFixture.calls)).filter(c=>c.action==='start').length,1,'sign-in assistance does not resume a goal');
 await page.screenshot({path:path.join(out,'sign-in-assistance.png')});
 await page.locator('[data-login-close]').click();
 await page.evaluate(()=>{window.__goalFixture.setAuthFailure('api');window.__goalFixture.open();});
 await view.getByRole('button',{name:'Check API key',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.__goalFixture.calls.at(-1)),{method:'auth',owner:await page.evaluate(()=>window.__goalFixture.owner),provider:'api'});
 assert.equal(await page.locator('#bw-prompt').inputValue(),'Keep my main conversation draft.');
 console.log('Goal UI fixture passed: create, observed progress, dependency wait, pause, evidence review/draft preservation, deadline, owned full-chat link, narrow layout.');
}finally{await app.close();}


