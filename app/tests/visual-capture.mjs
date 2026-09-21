// Isolated Electron fixtures. Never reads the user's profile or calls a provider/server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {root,inputs,hash,write,safe} from '../../scripts/visual-core.mjs';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),{GIFEncoder,quantize,applyPalette}=require('gifenc');
const run=new Date().toISOString().replace(/[:.]/g,'-'),dir=`docs/visual/runs/${run}`;fs.mkdirSync(safe(dir),{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-visual-'));
const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'app'),`--user-data=${profile}`],env:{...process.env,ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',BARKDOWN_PROVIDER:'api'}});
const errors=[],shots=[],hashes={};
try{
 const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.__barkdown?.state.loaded);await p.setViewportSize({width:1100,height:740});
 // Initial sign-in notices are delayed; let them appear and expire rather than masking UI.
 await p.waitForTimeout(1000);await p.locator('.bw-toast').waitFor({state:'hidden',timeout:15000});
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('agent:start');ipcMain.handle('agent:start',()=>{throw Error('Visual fixtures must not invoke providers');});});
 // Stable fixture values, never machine login status or a random temporary path in pictures.
 await p.evaluate(()=>{const s=window.__barkdown.state;s.settings.userData='C:/Barkdown visual fixture/data';s.settings.providers={claude:{loggedIn:false,effort:'high'},codex:{loggedIn:false,effort:'medium'}};window.__barkdown.render();});
 await p.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 const settled=async()=>{await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(250);};
 const tour=async(area,caption,actions)=>{
  const frames=[];for(const [step,act] of actions){await act();await p.mouse.move(1090,5);await settled();const file=`${dir}/${area}-${frames.length}.png`;
   const geometry=await p.evaluate(()=>[...document.querySelectorAll('button,input,textarea,[role="separator"],.bw-sidebar,.bw-side-chat')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,label:e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent.trim().slice(0,60),box:[r.x,r.y,r.width,r.height].map(Math.round)};}));
   await p.screenshot({path:safe(file),animations:'disabled',caret:'hide'});hashes[file]=hash(fs.readFileSync(safe(file)));frames.push({file,step,geometry});
  }
  const gif=GIFEncoder();for(const f of frames){const png=PNG.sync.read(fs.readFileSync(safe(f.file)));
   // A narrow viewport is letterboxed, not composited over stale pixels from the wide view.
   const width=1100,height=740,data=Buffer.alloc(width*height*4,235);for(let i=3;i<data.length;i+=4)data[i]=255;
   for(let y=0;y<png.height;y++)png.data.copy(data,y*width*4,y*png.width*4,(y+1)*png.width*4);
   const palette=quantize(data,256,{format:'rgba4444'});gif.writeFrame(applyPalette(data,palette,'rgba4444'),width,height,{palette,delay:1300,repeat:0});}gif.finish();
  const file=`${dir}/${area}.gif`;fs.writeFileSync(safe(file),Buffer.from(gif.bytes()));hashes[file]=hash(fs.readFileSync(safe(file)));shots.push({area,caption,file,frames});
 };
 await tour('workspace','Real desktop navigation with disposable local notes; no cloud or provider.',[
  ['default',async()=>{}],['quick-open',()=>p.keyboard.press('Control+k')],['dismiss',()=>p.keyboard.press('Escape')],
  ['narrow',()=>p.setViewportSize({width:740,height:740})],['restore',()=>p.setViewportSize({width:1100,height:740})]
 ]);
 await tour('chat','Shared main composer: draft, provider chooser and model chooser. No message is sent.',[
  ['draft',()=>p.locator('#bw-prompt').fill('Help me think through this note.')],['provider',()=>p.locator('#bw-provider').click()],['dismiss',()=>p.keyboard.press('Escape')],['model',()=>p.locator('#bw-model').click()],['ready',()=>p.keyboard.press('Escape')]
 ]);
 await tour('side-chat','A real saved side conversation and its independent composer, using disposable fixture state.',[
  ['open',async()=>{await p.locator('#bw-open-work').click();await p.locator('[data-new="chat"]').click();await p.locator('.bw-side-chat').waitFor();}],
  ['draft',()=>p.locator('.bw-side-chat textarea').fill('Explore this separately.')],['provider',()=>p.locator('.bw-side-chat [data-composer="provider"]').click()],['ready',()=>p.keyboard.press('Escape')]
 ]);
 await tour('documents','Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.',[
  ['open',async()=>{await p.locator('#bw-pages .bw-page-row').first().click();}],['dark',()=>p.emulateMedia({colorScheme:'dark'})],['light',()=>p.emulateMedia({colorScheme:'light'})]
 ]);
 await tour('settings','Real Settings navigation. No server connection or credential is configured.',[
  ['general',()=>p.locator('#bw-settings').click()],['assistant',()=>p.locator('.bw-settings-nav [data-pane="assistant"]').click()],['barkpark',()=>p.locator('.bw-settings-nav [data-pane="barkpark"]').click()],['shortcuts',()=>p.locator('.bw-settings-nav [data-pane="shortcuts"]').click()]
 ]);
 await p.keyboard.press('Escape');
 await tour('goals','Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.',[
  ['planned',async()=>{await p.evaluate(()=>{
   const ui=window.__barkdown,parent=ui.state.current,profileId='11111111-1111-4111-8111-111111111111';
   const workers=[1,2,3].map(n=>{const chat=ui.createChat({title:`Fixture worker ${n}`});Object.assign(chat,{side:true,parent,parentTitle:ui.state.chats[parent].title,provider:'api'});return chat;});ui.switchChat(parent);
   const goal={id:'fixture-goal',objective:'Fixture: review a bounded delivery',status:'planned',deadline:Date.parse('2026-09-22T10:00:00Z'),tasks:workers.map((chat,i)=>({id:`task-${i+1}`,title:chat.title,chatId:chat.id,prompt:['Inspect ownership boundaries','Exercise interrupted work','Review the resulting evidence'][i],dependsOn:[],status:'pending',context:{provider:'api',folder:null,model:null,effort:null},attempts:[]}))};
   const service={list:async()=>structuredClone([goal]),create:async()=>{throw Error('Visual fixture creation disabled');},command:async(_owner,_id,action)=>{if(action==='start'){goal.status='active';goal.tasks.forEach(t=>{t.status='running';t.attempts=[{id:'fixture-'+t.id,status:'running',progress:{text:'Fixture event; provider calls are blocked.'}}];});}else if(action==='pause'){goal.status='paused';goal.tasks.forEach(t=>{t.status='interrupted';Object.assign(t.attempts[0],{status:'interrupted',stoppedAt:1,reason:'Fixture provider stopped; inspect effects before retry.'});});}}};
   ui.openGoalView({owner:{profileId,chatId:parent,generation:1},service,openChat:(_owner,id)=>ui.switchChat(id)});
  });await p.locator('.bw-goal-card').waitFor();}],
  ['running',()=>p.locator('.bw-goals [data-command="start"]').click()],
  ['paused',()=>p.locator('.bw-goals [data-command="pause"]').click()],
  ['narrow',()=>p.setViewportSize({width:390,height:740})],
  ['restore',()=>p.setViewportSize({width:1100,height:740})],
  ['worker-chat',()=>p.locator('.bw-goals [data-chat]').first().click()]
 ]);
 if(errors.length)throw Error(errors.join('\n'));
 const environment={platform:process.platform,osRelease:os.release(),arch:process.arch,font:await p.evaluate(()=>getComputedStyle(document.body).fontFamily),electron:await app.evaluate(()=>process.versions.electron),viewport:'1100x740, workspace narrow 740x740',scale:await p.evaluate(()=>devicePixelRatio),fixture:'temporary seeded local profile; providers blocked; reduced motion; caret hidden'};
 write(`${dir}/manifest.json`,{version:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),capturedAt:new Date().toISOString(),environment,sourceDirty:execFileSync('git',['status','--porcelain','--','app','scripts','package.json','package-lock.json'],{cwd:root,encoding:'utf8'}).trim()!=='',inputs:inputs(),shots,hashes});write('docs/visual/pending.json',{run});console.log(`Captured ${dir}; run npm run visual:compare. Not approved.`);
}finally{await app.close();/* Keep isolated profile in OS temp for recovery; never delete user data. */}
