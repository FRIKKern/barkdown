import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tinyPng } from './png.mjs';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-login-ui-'));
const out=path.join(appDir,'test-results/provider-login');fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Actual Electron main/preload/composer/settings and production login state machine. Controlled owned-process transport and Codex SDK; no real sign-in or provider network request.',frames:[],checks:[],passed:false,stopped:false};
let app,page;
report.dirtySource = Boolean(execFileSync('git',['status','--porcelain','--','app'],{encoding:'utf8'}).trim());
async function shot(name){await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:path.join(out,name+'.png')});report.frames.push(name+'.png');}
try {
  const install=({app})=>{
    const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js');
    const module=require('./provider-login'),original=module.createProviderLogin;
    global.loginProof={authenticated:false,starts:0,requests:0};
    module.createProviderLogin=options=>original({...options,platform:'win32',launch:async ({onMessage})=>{
      let finish;const finished=new Promise(r=>finish=r);
      return {ready:Promise.resolve(),finished,stop(){finish({});},send(message){
        if(message.operation==='status')onMessage({type:'result',state:global.loginProof.authenticated?'signed-in':'signed-out'});
        else {global.loginProof.starts++;global.completeLogin=()=>{global.loginProof.authenticated=true;onMessage({type:'result',state:'signed-in'});};}
      }};
    }});
    require('./providers/codex').setSdkLoader(async()=>({Codex:class {
      startThread(){return this.thread();}resumeThread(){return this.thread();}
      thread(){return {id:'controlled-login-thread',async runStreamed(){global.loginProof.requests++;if(global.loginProof.expired)throw Object.assign(new Error('Synthetic expired session'),{status:401});return {events:(async function*(){yield {type:'item.completed',item:{type:'agent_message',id:'response',text:'Verified explicit retry.'}};yield {type:'turn.completed',usage:{}};})()};}};}
    }}));
  };
  const boot=path.join(userData,'controlled-boot.cjs');
  fs.writeFileSync(boot,`const {app}=require('electron');app.setAppPath(${JSON.stringify(appDir)});(${install.toString()})({app});require(${JSON.stringify(path.join(appDir,'main/main.js'))});`);
  app=await electron.launch({executablePath:require('electron'),args:[boot, '--legacy','--user-data='+userData],env:{...process.env,BARKDOWN_PROVIDER:'codex',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',CODEX_API_KEY:''},recordVideo:{dir:out,size:{width:1400,height:900}}});
  page=await app.firstWindow();await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});

  const parent=await page.evaluate(()=>window.__barkdown.state.current);
  await page.locator('#bw-prompt').fill('Main draft remains');
  await page.locator('#bw-prompt').press('Enter');
  await page.getByRole('dialog',{name:'Sign in to Codex',exact:true}).waitFor();
  assert.equal(await page.locator('#bw-prompt').inputValue(),'Main draft remains');assert.equal(await app.evaluate(()=>global.loginProof.requests),0);
  assert.equal(await page.locator('[data-login-cancel]').isVisible(),false);await shot('01-main-needs-login');report.checks.push('Main refusal preserves draft without provider dispatch');
  await page.locator('[data-login-start]').click();await page.getByText('Complete sign-in in your browser. Your draft stays here.',{exact:true}).waitFor();
  await shot('02-browser-pending');assert.equal(await app.evaluate(()=>global.loginProof.starts),1);
  await page.locator('[data-login-cancel]').click();await page.getByText('Sign-in cancelled. Your draft is unchanged.',{exact:true}).waitFor();
  await shot('03-cancelled');await page.locator('[data-login-close]').click();assert.equal(await page.locator('#bw-prompt').inputValue(),'Main draft remains');report.checks.push('Cancelled login leaves draft intact');
  await page.locator('#bw-open-work').click();await page.locator('[data-new="chat"]').click();const side=page.locator('.bw-side-chat');await side.waitFor();
  await side.locator('[data-composer="attach-input"]').setInputFiles({name:'kept.png',mimeType:'image/png',buffer:tinyPng(4,4,[40,100,60])});await side.locator('.bw-attachment').waitFor();
  await side.locator('textarea').fill('Side draft with image');await side.locator('textarea').press('Enter');await page.getByRole('dialog',{name:'Sign in to Codex',exact:true}).waitFor();
  assert.equal(await side.locator('textarea').inputValue(),'Side draft with image');assert.equal(await side.locator('.bw-attachment').count(),1);assert.equal(await page.locator('#bw-prompt').inputValue(),'Main draft remains');
  await page.setViewportSize({width:760,height:900});await shot('04-side-narrow');await page.setViewportSize({width:1400,height:900});
  await page.locator('[data-login-start]').click();await page.getByText('Complete sign-in in your browser. Your draft stays here.',{exact:true}).waitFor();
  await app.evaluate(()=>global.completeLogin());await page.getByText('Signed in. Return to your conversation and send when you’re ready.',{exact:true}).waitFor();
  assert.equal(await app.evaluate(()=>global.loginProof.requests),0,'successful login never auto-sends');assert.equal(await page.locator('[data-login-start]').isVisible(),false);assert.equal(await page.locator('[data-login-cancel]').isVisible(),false);await shot('05-signed-in');await page.locator('[data-login-close]').click();
  await side.locator('textarea').press('Enter');await side.getByText('Verified explicit retry.',{exact:true}).waitFor();
  assert.equal(await app.evaluate(()=>global.loginProof.requests),1);assert.equal(await side.locator('textarea').inputValue(),'');assert.equal(await page.locator('#bw-prompt').inputValue(),'Main draft remains');
  await shot('06-retry-once');report.checks.push('Side text/image retained, no auto-send, explicit retry dispatches once');
  await app.evaluate(()=>global.loginProof.expired=true);
  await side.locator('textarea').fill('Preserve expired message');await side.locator('textarea').press('Enter');
  await side.getByRole('button',{name:'Copy message to empty draft',exact:true}).waitFor();
  await side.locator('textarea').fill('Newer work');
  await side.getByRole('button',{name:'Copy message to empty draft',exact:true}).click();
  assert.equal(await side.locator('textarea').inputValue(),'Newer work');
  await side.locator('textarea').fill('');
  await side.getByRole('button',{name:'Copy message to empty draft',exact:true}).click();
  assert.equal(await side.locator('textarea').inputValue(),'Preserve expired message');
  const requests=await app.evaluate(()=>global.loginProof.requests);
  await side.getByRole('button',{name:'Sign-in help',exact:true}).click();
  await page.getByRole('dialog',{name:'Sign in to Codex',exact:true}).waitFor();
  await page.locator('[data-login-close]').click();
  assert.equal(await app.evaluate(()=>global.loginProof.requests),requests,'recovery never resends');
  assert.equal(await side.locator('textarea').inputValue(),'Preserve expired message');
  await shot('10-expired-session');report.checks.push('Expired accepted turn offers help and explicit draft copy, protects newer input, never resends');
  await side.locator('textarea').fill('New side draft after login');await page.keyboard.press('Control+,');await page.getByRole('button',{name:'Assistant',exact:true}).click();
  const codex=page.locator('[data-provider="codex"]');await codex.locator('[data-login-check]').click();await codex.getByText('Signed in. Return to your conversation and send when you’re ready.',{exact:true}).waitFor();
  await shot('07-settings-status');assert.equal(await side.locator('textarea').inputValue(),'New side draft after login');assert.equal(await page.locator('#bw-prompt').inputValue(),'Main draft remains');
  report.checks.push('Settings recheck leaves both chat drafts intact');
  await page.getByRole('button',{name:'General',exact:true}).click();await page.locator('#theme [data-value="dark"]').click();
  await page.getByRole('button',{name:'Assistant',exact:true}).click();await shot('08-settings-dark');
  await page.locator('.bw-settings [data-act="save"]').click();await page.locator('.bw-settings').waitFor({state:'detached'});
  await page.locator('#bw-assistant').click();await page.getByRole('button',{name:'Sign-in help for Codex',exact:true}).click();
  await page.setViewportSize({width:390,height:800});await shot('09-login-dark-narrow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-login-close]').click();
  report.checks.push('Dark Settings and narrow sign-in dialog remain reachable without horizontal overflow');report.passed=true;
} catch(error){report.error=error.stack;throw error;}
finally {
  if(app)await app.close();report.stopped=true;
  if(page?.video())report.video=path.basename(await page.video().path());
  report.hashes=Object.fromEntries([...report.frames,...(report.video?[report.video]:[])].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex')]));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
