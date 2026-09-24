// Retained legacy backup recovery in a real disposable profile; no authority switch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {createProfileRegistry}=require('../main/profile-registry'),{createStore}=require('../main/store'),{createDocuments}=require('../main/documents');
const {stageMigration}=require('../main/migration-staging'),{inventoryProfile}=require('../main/migration-preflight'),{restoreMigrationBackup}=require('../main/migration-restore');
const server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(server||'')||!token)throw Error('Owned isolated runtime required');
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bd-restored-profile-')),userData=path.join(temporary,'electron');
const registry=createProfileRegistry(path.join(userData,'profile-data')),profile=registry.createProfile({name:'Restored writing room'}),profileId=profile.id;
const sourceDir=registry.storeFor(profileId).storeDir,backupDir=path.join(temporary,'backup'),retained=path.join(temporary,'retained-original');
const store=createStore(sourceDir),docs=createDocuments(store);docs.loadAll({seed:false});
const first=docs.create({title:'A thought worth keeping',markdown:'The first version remains readable.'});
docs.save({id:first.id,baseRev:first.rev,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'This note came back from its retained backup.'}]}]},summary:'A deliberate second version'});
const proposal=docs.addProposal(first.id,{mode:'append',actor:'agent',baseRev:2,summary:'An old proposal, still yours to decide',markdown:'A suggested ending retained without applying it.'});
// Restore proof uses the already-reviewed reference shape. The Markdown parser's
// extra target attribute remains a separately recorded migration compatibility gate.
const second=docs.create({title:'Connected thought',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Read '},{type:'text',text:'the original thought',marks:[{type:'link',attrs:{href:'barkdown://doc/'+first.id}}]},{type:'text',text:'.'}]}]}});
const png=new PNG({width:480,height:320});
for(let y=0;y<320;y++)for(let x=0;x<480;x++){const hill=y>205+Math.sin(x/60)*25,sun=(x-365)**2+(y-76)**2<42**2;png.data.set([...(sun?[237,194,93]:hill?[76,112,76]:[206,223,221]),255],(y*480+x)*4);}
const imageBytes=PNG.sync.write(png),imageFile=path.join(sourceDir,'attachments/landscape.png');fs.mkdirSync(path.dirname(imageFile));fs.writeFileSync(imageFile,imageBytes);
// A second retained attachment exercises a partial 64 KiB copy. It is never sent to a provider.
fs.writeFileSync(path.join(sourceDir,'attachments/retained-binary.bin'),crypto.randomBytes(180000));
const attachment={id:'landscape',name:'landscape.png',mime:'image/png',size:imageBytes.length,path:imageFile,url:pathToFileURL(imageFile).href};
const baseChat={messages:[],tabs:[],active:null,folder:null,following:true,draftImages:[],apiHistory:[],events:[],closedTargets:[]};
const pages={layoutVersion:2,seeded:true,roots:[first.id],children:{[first.id]:[second.id]},expanded:{[first.id]:true},archiveOpen:false,archiveFilter:'',cloudArchiveOpen:false,cloudArchiveFilter:''};
const favorite={id:'kept-favorite',label:first.title,target:{kind:'doc',id:first.id,source:'local',title:first.title},chatId:'main',chatTitle:'Main conversation'};
store.writeJson('workspace.json',{version:1,chats:{main:{...baseChat,id:'main',title:'Main conversation',draft:'The main unsent thought.'},side:{...baseChat,id:'side',title:'A separate thought',side:true,parent:'main',parentTitle:'Main conversation',draft:'This side-chat draft and its picture survived.',draftImages:[attachment]}},order:['main','side'],current:'side',favorites:[favorite],pages,mode:'chat',directTab:null});
store.writeJson('agent-edits/retained-receipt.json',{version:1,profileId,documentId:first.id,beforeRev:1,afterRev:2,status:'retained-fixture'});
store.writeJson('paper-proposals.json',{retained:{summary:'Legacy proposal semantics are retained, not converted'}});
const options={profileId,sourceDir,destinationDir:backupDir,quiesced:true,metadata:Object.fromEntries([first,second].map(d=>[d.id,{description:'Backup restoration proof keeps original notes and their references readable without changing staged Paper',tags:[{tag:'restoreproof',strength:95,rationale:'Private backup restore rehearsal'}]}]))};
const snapshot=inventoryProfile(options),target={profileId,runtimeId:'private-restore-'+profileId,server,dataset:'production',token,assertOwned:b=>b.profileId===profileId&&b.server===server};
const restoreOptions={profileId,backupDir,destinationDir:sourceDir,expectedSourceHash:snapshot.sourceHash,quiesced:true};
const out=path.resolve(appDir,'../docs/visual/migration/runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function request(method,route,body){const r=await fetch(server+route,{method,redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const data=await r.json();return data.result||data;}
const readPaper=id=>request('GET','/v1/data/doc/production/paper/'+id+'?perspective=published');
let app,page,video;const frames=[],errors=[],results={};
const pane=()=>page.locator('.bw-doc-pane:visible');
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
const launch=async()=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,'--profiles',`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
async function checkWorkspace(){const state=await page.evaluate(()=>window.__barkdown.state);assert.equal(state.profileId,profileId);assert.equal(state.chats.main.draft,'The main unsent thought.');assert.equal(state.chats.side.parent,'main');assert.equal(state.chats.side.draft,'This side-chat draft and its picture survived.');assert.deepEqual(state.chats.side.draftImages,[attachment]);assert.deepEqual(state.pages,pages);assert.deepEqual(state.favorites,[favorite]);}
function originalsExact(){for(const file of snapshot.files){assert.deepEqual(fs.readFileSync(path.join(retained,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(backupDir,'source',file.path)),file.data);}}
try{
  await request('POST','/v1/data/mutate/production',{mutations:[{create:{_id:'restoreproof',_type:'tag',title:'Restore proof'}},{publish:{id:'restoreproof',type:'tag'}}]});
  await stageMigration(options,target);
  const papers=await Promise.all(snapshot.documents.map(d=>readPaper(d.targetId))),registryBefore=registry.load();
  // Only this disposable profile is moved, inside its owned temporary root.
  for(const name of [sourceDir,retained])assert.ok(path.resolve(name).startsWith(path.resolve(temporary)+path.sep));
  fs.renameSync(sourceDir,retained);
  const config=path.join(temporary,'restore.json');fs.writeFileSync(config,JSON.stringify(restoreOptions));
  const code=`const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.RESTORE_CONFIG));require(process.env.RESTORE_MODULE).restoreMigrationBackup(c,{checkpoint:n=>{if(n==='restore-chunk:attachments/retained-binary.bin')process.exit(77)}});`;
  const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',code],{windowsHide:true,env:{...process.env,RESTORE_CONFIG:config,RESTORE_MODULE:require.resolve('../main/migration-restore')},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',status=>resolve({status,stderr}));});
  assert.equal(exit.status,77,exit.stderr);results.interruptedExit=exit.status;
  assert.equal(restoreMigrationBackup(restoreOptions).status,'restored');assert.equal(restoreMigrationBackup(restoreOptions).status,'restored');
  for(const file of snapshot.files)assert.deepEqual(fs.readFileSync(path.join(sourceDir,file.path)),file.data);
  assert.deepEqual(registry.load(),registryBefore);originalsExact();results.exactBeforeLaunch=true;results.registryUnchanged=true;
  await launch();await checkWorkspace();
  await page.waitForFunction(()=>{const i=document.querySelector('#bw-attachments img');return i?.complete&&i.naturalWidth===480&&i.naturalHeight===320;});
  await shot('01-restored-sidechat-and-image');
  await page.evaluate(d=>window.__barkdown.openTarget({kind:'doc',id:d.id,source:'local',title:d.title}),first);
  await pane().locator('.ProseMirror').waitFor();await pane().locator('.bw-proposal').waitFor();
  assert.match(await pane().locator('.ProseMirror').innerText(),/came back from its retained backup/);
  assert.equal(await pane().locator('.bw-proposal').getAttribute('data-id'),proposal.id);
  await pane().locator('[data-restore="1"]').waitFor();await shot('02-retained-proposal-and-history');
  const editor=pane().locator('.ProseMirror');await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' A human continued writing after recovery.',{delay:35});
  await page.waitForFunction(()=>document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent.includes('Saved · rev 3'));
  const edited=await page.evaluate(id=>window.barkdown.docs.get(id),first.id);assert.equal(edited.rev,3);assert.match(edited.text,/human continued writing/);assert.equal(edited.proposals[0].id,proposal.id);await shot('03-native-save');
  await pane().locator('[data-restore="1"]').click();await page.waitForFunction(()=>document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent.includes('Restored · rev 4'));
  assert.match(await editor.innerText(),/first version remains readable/);await shot('04-native-history-restore');
  await pane().locator('[data-restore="3"]').click();await page.waitForFunction(()=>document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent.includes('Restored · rev 5'));
  assert.match(await editor.innerText(),/human continued writing/);await shot('05-return-to-human-version');
  await page.setViewportSize({width:760,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('06-narrow');
  await close('restored-profile-editing');await launch();await checkWorkspace();await pane().locator('.ProseMirror').waitFor();
  assert.match(await pane().locator('.ProseMirror').innerText(),/human continued writing/);await shot('07-restarted');
  const reopened=await page.evaluate(id=>window.barkdown.docs.get(id),first.id);assert.equal(reopened.rev,5);assert.equal(reopened.proposals[0].id,proposal.id);assert.equal(reopened.backlinks[0].id,second.id);
  assert.deepEqual(await Promise.all(snapshot.documents.map(d=>readPaper(d.targetId))),papers);originalsExact();assert.deepEqual(fs.readFileSync(imageFile),imageBytes);assert.deepEqual(errors,[]);
  await close('restored-profile-restarted');
  assert.throws(()=>restoreMigrationBackup(restoreOptions));results.postHumanRepeatRefused=true;results.stagedPaperUnchanged=true;results.nativeRevisions=[3,4,5];results.sourceBackupUnchanged=true;results.draftsParentPagesFavoriteAndMediaPreserved=true;
  console.log('PASS interrupted exact backup restore, native drafts/media/history/proposals, save and restart, no staged Paper changes');
}catch(error){if(page&&app){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({state:window.__barkdown?.state,text:document.body.innerText})).catch(()=>null),null,2));}fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{if(app)await close('restart-or-failure');const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,sha(fs.readFileSync(path.join(out,f)))]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,profileId,sourceHash:snapshot.sourceHash,results,frames,artifacts,authority:'legacy',limits:['Closed disposable profile restored at its original path; no live restore UI or authority switch','Credentials/settings/runtime excluded; same-machine recovery only','Actual process interruption and clean restart, not power-loss durability','Staged Paper remains unchanged; later Paper edits are not rolled back']},null,2)+'\n');console.log('Backup restoration evidence:',out);}
