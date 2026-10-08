// Actual renderer Send/IPC and Electron quit; delayed environment adapter, no provider dispatched.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),appRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const {createProfileRegistry}=require('../main/profile-registry'),{createStore}=require('../main/store');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-admission-quit-'));
const out=path.resolve(process.argv[2]||path.join(appRoot,'test-results/admission-quit'),new Date().toISOString().replace(/[:.]/g,'-')+'-admission-quit');fs.mkdirSync(out,{recursive:true});
const registry=createProfileRegistry(path.join(root,'profile-data')),profile=registry.createProfile({name:'Disposable pending launch'});registry.selectProfile(profile.id);
const store=registry.storeFor(profile.id),audit=path.join(root,'quit-audit.json');
store.writeJson('workspace.json',{version:1,chats:{main:{id:'main',title:'Pending launch',provider:'api',messages:[],tabs:[],events:[],draft:'',closedTargets:[]}},order:['main'],current:'main',favorites:[],pages:null});
store.writeJson('settings.json',{theme:'dark',provider:'api',barkpark:{decided:true,enabled:false,local:{enabled:false}}});
createStore(path.join(root,'app-settings')).writeJson('appearance.json',{theme:'dark'});
const draft='Human draft survives a pending launch at quit';
const report={status:'running',root,out,platform:process.platform,images:[],assertions:[],scope:'Actual Send/IPC/quit/restart with controlled environment wait; no dispatched provider, remote connection or native worker.'};
const persist=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');persist();
let app,page;
async function launch(){app=await electron.launch({executablePath:require('electron'),args:[appRoot,'--profiles',`--user-data=${root}`],env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:''}});page=await app.firstWindow();await page.waitForFunction(()=>window.__barkdown?.state.loaded);}
async function wait(predicate){const end=Date.now()+15000;while(!await predicate()){assert(Date.now()<end,'Native checkpoint timed out');await new Promise(r=>setTimeout(r,50));}}
async function awaitClose(closed){let timer;try{await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Quit did not finish')),15000);})]);}finally{clearTimeout(timer);}}
try{
 await launch();
 await app.evaluate(({app},audit)=>{
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js');
  let release;const gate=new Promise(r=>{release=r;});globalThis.__admission={waiting:0,released:false,release(){this.released=true;release();}};
  require('./shell-environment').install({hydrate(){globalThis.__admission.waiting++;return gate;},current(){return {PATH:process.env.PATH};}});
  app.on('will-quit',()=>require('node:fs').writeFileSync(audit,JSON.stringify({released:globalThis.__admission.released,liveRuns:require('./providers/runs').runs.size})));
 },audit);
 await page.locator('textarea').first().fill(draft);await page.locator('textarea').first().press('Enter');
 await wait(()=>app.evaluate(()=>globalThis.__admission.waiting>1));
 assert.equal(Object.keys(store.readJson('workspace.json').ownership?.attempts||{}).length,0);
 await page.screenshot({path:path.join(out,'pending-send.png')});report.images.push('pending-send.png');
 await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0);});
 await page.waitForFunction(()=>document.body.inert);
 await new Promise(r=>setTimeout(r,400));assert.equal(page.isClosed(),false);assert.equal(fs.existsSync(audit),false,'Quit must wait for the pending ordinary ticket');
 const dimensions=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());win.setContentSize(720,760);return win.getContentSize();});assert.deepEqual(dimensions,[720,760]);
 await page.screenshot({path:path.join(out,'quit-waiting.png')});report.images.push('quit-waiting.png');
 assert.equal(store.readJson('workspace.json').chats.main.draft,draft);
 const closed=new Promise(resolve=>app.once('close',resolve));await app.evaluate(()=>globalThis.__admission.release());await awaitClose(closed);app=null;
 report.audit=JSON.parse(fs.readFileSync(audit,'utf8'));assert.equal(report.audit.released,true);assert.equal(report.audit.liveRuns,0);
 assert.equal(Object.keys(store.readJson('workspace.json').ownership?.attempts||{}).length,0,'No late reservation or dispatch');
 assert.equal(store.readJson('profile-launch-admission.json',null),null,'Quit does not persist a migration closure');
 report.assertions.push('Actual quit waits for the pending Send ticket, then exits with zero runs and no durable attempt/migration closure');
 await launch();assert.equal(await page.locator('textarea').first().inputValue(),draft);
 await page.screenshot({path:path.join(out,'reopened.png')});report.images.push('reopened.png');
 const normalClose=new Promise(resolve=>app.once('close',resolve));await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0);});await awaitClose(normalClose);app=null;
 report.assertions.push('Fresh host restores the saved human draft and quits normally');report.status='passed';persist();console.log(JSON.stringify(report));
}catch(error){report.status='failed';report.error=error.stack;persist();throw error;}
finally{if(app){const closed=new Promise(resolve=>app.once('close',resolve));await app.evaluate(({app})=>{globalThis.__admission?.release();setTimeout(()=>app.exit(1),0);}).catch(()=>app.process().kill());await closed;}}
