import { openFixturePaper } from './lib/paper-fixture.mjs';
// Owned PNG migration through actual media endpoints and the real Paper canvas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {stageMigration}=require('../main/migration-staging'),{inventoryProfile}=require('../main/migration-preflight');
const server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(server||'')||!token)throw Error('Owned isolated runtime required');
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bd-migrated-images-')),userData=path.join(temporary,'electron');
const out=path.resolve(appDir,'../docs/visual/migration/runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const profileId=crypto.randomUUID(),sourceDir=path.join(temporary,profileId),destinationDir=path.join(temporary,'backup');
fs.mkdirSync(path.join(sourceDir,'documents'),{recursive:true});fs.mkdirSync(path.join(sourceDir,'attachments'));
const png=new PNG({width:480,height:320});
for(let y=0;y<320;y++)for(let x=0;x<480;x++){
  const circle=(x-365)**2+(y-76)**2<42**2,land=y>205+Math.sin(x/60)*25;
  const rgb=circle?[237,194,93]:land?[76,112,76]:[206,223,221],i=(y*480+x)*4;png.data.set([...rgb,255],i);
}
const bytes=PNG.sync.write(png);fs.writeFileSync(path.join(sourceDir,'attachments/landscape.png'),bytes);
const document={id:'image-note',title:'A picture kept with its note',rev:3,content:{type:'doc',content:[
  {type:'paragraph',content:[{type:'text',text:'This owned image must survive migration, editing and restart with its original bytes.'}]},
  {type:'image',attrs:{src:'attachments/landscape.png',alt:'Green hills under a gold sun',width:320}},
  {type:'paragraph',content:[{type:'text',text:'The same attachment can appear twice without a second upload.'}]},
  {type:'image',attrs:{src:'attachments/landscape.png',alt:'Second view of the same landscape',width:160}},
]}};
fs.writeFileSync(path.join(sourceDir,'documents/image-note.json'),JSON.stringify(document,null,2)+'\n');
fs.writeFileSync(path.join(sourceDir,'workspace.json'),JSON.stringify({pages:{roots:['image-note']},chats:{side:{parent:'main',draft:'Keep this thought'}}}));
const options={profileId,sourceDir,destinationDir,quiesced:true,metadata:{'image-note':{description:'Owned local picture migration verifies original bytes, native image history and interrupted upload recovery',tags:[{tag:'imageproof',strength:95,rationale:'Private media migration rehearsal'}]}}};
const target={profileId,runtimeId:'private-image-'+profileId,server,dataset:'production',token,assertOwned:b=>b.profileId===profileId&&b.server===server};
const snapshot=inventoryProfile(options),id=snapshot.documents[0].targetId;
async function request(method,route,body){const r=await fetch(server+route,{method,redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});return{status:r.status,data:await r.json()};}
const read=async()=>{const r=await request('GET','/v1/data/doc/production/paper/'+id+'?perspective=published');assert.equal(r.status,200);return r.data.result||r.data;};
let app,page,video,editorBundle;const frames=[],results=[],errors=[];
const canvas=()=>page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas');
const blocks=()=>canvas().evaluate(c=>c.recoverySnapshot().blocks);
const ready=async()=>{await canvas().locator('.ProseMirror').waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live'));};
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
const launch=async()=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
async function saved(previous){await page.waitForFunction(rev=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');const host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));const text=document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent||'';return c&&host&&!host.isDirty()&&!c.hasPendingChanges()&&Number(text.match(/Saved \u00b7 rev (\d+)/)?.[1])>rev;},previous,{timeout:45000});const p=await read();assert.deepEqual(await blocks(),p.blocks);return p;}
async function rendered(){await page.waitForFunction(()=>{const imgs=[...document.querySelectorAll('.bw-paper-pane:not([hidden]) figure[data-bp-type="image"] img')];return imgs.length===2&&imgs.every(i=>i.complete&&i.naturalWidth===480&&i.naturalHeight===320);},null,{timeout:30000});}
async function mediaCount(){const r=await request('GET','/v1/media/production?limit=50');assert.equal(r.status,200);assert.equal(r.data.result.hasMore,false);return r.data.result.total;}
try{
  const before=await mediaCount();
  assert.equal((await request('POST','/v1/data/mutate/production',{mutations:[{create:{_id:'imageproof',_type:'tag',title:'Owned image proof'}},{publish:{id:'imageproof',type:'tag'}}]})).status,200);
  const config=path.join(temporary,'child.json');fs.writeFileSync(config,JSON.stringify({options,target:{...target,token:undefined}}));
  const code=`const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.MEDIA_CONFIG));c.target.token=process.env.BARKPARK_API_TOKEN;c.target.assertOwned=b=>b.profileId===c.options.profileId&&b.server===process.env.BARKDOWN_SHOTS_SERVER;require(process.env.MEDIA_MODULE).stageMigration(c.options,c.target,{checkpoint:n=>{if(n==='media-response:attachments/landscape.png')process.exit(77)}}).catch(e=>{console.error(e);process.exit(1)});`;
  const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',code],{windowsHide:true,env:{...process.env,MEDIA_CONFIG:config,MEDIA_MODULE:require.resolve('../main/migration-staging')},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',status=>resolve({status,stderr}));});
  assert.equal(exit.status,77,exit.stderr);assert.equal(await mediaCount(),before+1);
  assert.equal(fs.readdirSync(path.join(destinationDir,'media')).filter(n=>n.endsWith('.receipt.json')).length,0);
  assert.equal((await request('GET','/v1/data/doc/production/paper/'+id+'?perspective=published')).status,404);
  await stageMigration(options,target);await stageMigration(options,target);assert.equal(await mediaCount(),before+1);
  const original=await read(),images=original.blocks.filter(b=>b.type==='image');assert.equal(images.length,2);assert.equal(images[0].src,images[1].src);
  const raw=await fetch(images[0].src,{headers:{authorization:'Bearer '+token},redirect:'error'});assert.equal(raw.status,200);assert.deepEqual(Buffer.from(await raw.arrayBuffer()),bytes);
  await launch();await page.evaluate(async c=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,writes:true,viaCli:false,...c}});await window.__barkdown.refreshLibrary();},{server,token});
  await openFixturePaper(page, id);await ready();await rendered();assert.deepEqual(await blocks(),original.blocks);
  editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json')));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.sha,crypto.createHash('sha1').update(fs.readFileSync(path.join(process.env.BARKDOWN_TEST_BP_SOURCE,'api/priv/static/assets/bp-paper-editor.bundle.js'))).digest('hex'));
  await shot('01-migrated-images');let revision=original.rev;
  const figure=()=>canvas().locator('figure[data-bp-type="image"]').first();
  for(const [field,value] of [['alt','A human edited this description'],['width',240]]){
    await figure().hover();const input=figure().locator('input.bp-canvas-image-'+field);await input.click();await input.fill(String(value));await input.press('Enter');
    const edited=await saved(revision),expected=structuredClone(original.blocks);expected[1][field]=value;assert.deepEqual(edited.blocks,expected);await shot('02-edit-'+field);
    if(field==='width')assert.equal(await figure().locator('img').evaluate(i=>i.style.width),'240px');
    await canvas().locator('.ProseMirror').focus();await page.keyboard.press('Control+z');const undone=await saved(edited.rev);assert.deepEqual(undone.blocks,original.blocks);await rendered();await shot('03-undo-'+field);results.push({field,editedRev:edited.rev,undoneRev:undone.rev});revision=undone.rev;
  }
  // Native deletion selects the real atom; acknowledged Undo restores its media identity.
  await figure().focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection.node?.attrs.bpId==='migration-1');
  await page.keyboard.press('Backspace');const deleted=await saved(revision);assert.deepEqual(deleted.blocks,original.blocks.filter((_,i)=>i!==1));await shot('04-deleted');
  await page.keyboard.press('Control+z');const restored=await saved(deleted.rev);assert.deepEqual(restored.blocks,original.blocks);await rendered();await shot('05-restored');results.push({field:'delete',editedRev:deleted.rev,undoneRev:restored.rev});
  await canvas().evaluate(c=>c.__beforeImageReload=true);await page.locator('.bw-paper-pane:not([hidden]) button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');return c&&!c.__beforeImageReload&&c._editor;});await rendered();assert.deepEqual(await blocks(),original.blocks);await shot('06-reloaded');
  await page.setViewportSize({width:760,height:900});await rendered();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('07-narrow');
  await close('images-editing-and-undo');await launch();await ready();await rendered();assert.deepEqual(await blocks(),original.blocks);await shot('08-restarted');assert.equal(await mediaCount(),before+1);
  for(const file of snapshot.files){assert.deepEqual(fs.readFileSync(path.join(sourceDir,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(destinationDir,'source',file.path)),file.data);}
  await assert.rejects(stageMigration(options,target),{code:'journal_changed'});assert.deepEqual((await read()).blocks,original.blocks);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'recovery.json'),JSON.stringify({postCommitChildExit:exit.status,receiptAbsentBeforeResume:true,beforeMediaCount:before,afterMediaCount:await mediaCount(),oneUploadForTwoReferences:true,exactBytes:true,sourceBackupWorkspaceUnchanged:true},null,2)+'\n');
  console.log('PASS owned PNG upload reconciliation, exact bytes, shared references, native alt/width/delete Undo, reload and restart');
}catch(error){
  if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await canvas().evaluate(c=>({editor:c._editor?.getJSON(),blocks:c.recoverySnapshot().blocks,html:c._editor?.view.dom.innerHTML,saveState:document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent})).catch(()=>null),null,2));}
  fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;
}finally{
  if(app)await close('restart-or-failure');
  const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,profileId,sourceId:document.id,targetId:id,editorBundle,cases:results,frames,artifacts,authority:'legacy',limits:['Disposable owned PNG only; no real-library activation','Explicit image heights, captions and non-supported PNG encodings refuse','Clean restart and post-upload process exit, not power-loss durability','Captured runtime origin must remain stable; portability is a later stage']},null,2)+'\n');console.log('Image migration evidence:',out);
}
