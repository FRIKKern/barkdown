// Load only a projected copy into a disposable app. This is not an authority switch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
const require=createRequire(import.meta.url);
const {createStore}=require('../main/store'),{createDocuments}=require('../main/documents');
const {inventoryProfile}=require('../main/migration-preflight'),{stageMigration}=require('../main/migration-staging'),{projectWorkspace}=require('../main/migration-workspace');
const server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(server||'')||!token)throw Error('Owned isolated runtime required');
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bd-navigation-preview-')),profileId=crypto.randomUUID();
const sourceDir=path.join(temporary,profileId),backupDir=path.join(temporary,'backup'),userData=path.join(temporary,'projected-app');
const sourceStore=createStore(sourceDir),docs=createDocuments(sourceStore);docs.loadAll({seed:false});
const alpha=docs.create({title:'Alpha',markdown:'The local Alpha belongs to the original writing room.'});
const beta=docs.create({title:'Beta',markdown:'The nested Beta keeps its place and its chat path.'});
assert.equal(alpha.id,'alpha');assert.equal(beta.id,'beta');
const chat=(id,extra={})=>({id,title:id==='main'?'Writing room':'Side reflection',messages:[{id:'message-'+id,role:'assistant',text:'A retained conversation about alpha.',at:'2026-09-20T12:00:00Z'}],events:[],apiHistory:[],tabs:[],active:null,draft:id==='main'?'Keep my main draft.':'Keep my independent side draft.',draftImages:[],closedTargets:[],runId:null,folder:null,following:true,...extra});
const original={version:1,chats:{main:chat('main',{tabs:[{id:'path-main',type:'doc',source:'local',path:['alpha','beta'],title:'My local path',scroll:0},{id:'side-view',type:'chat',sideChatId:'side',title:'Side reflection'},{id:'cloud-view',type:'doc',source:'barkpark',path:['alpha'],title:'Cloud Alpha'}],active:'side-view'}),side:chat('side',{parent:'main',parentTitle:'Writing room',side:true,tabs:[{id:'path-side',type:'doc',path:['beta'],title:'Beta'}],active:'path-side'})},order:['main','side'],current:'main',mode:'chat',directTab:{id:'saved-direct',type:'doc',source:'local',path:['alpha'],title:'Alpha'},favorites:[{id:'local-fav',label:'My local Alpha',target:{kind:'doc',id:'alpha',source:'local',title:'Alpha'},chatId:'main'},{id:'cloud-fav',label:'Existing cloud Alpha',target:{kind:'doc',id:'alpha',source:'barkpark',title:'Cloud Alpha'},chatId:'main'}],pages:{layoutVersion:2,seeded:true,roots:['alpha','bp:alpha'],children:{alpha:['beta']},expanded:{alpha:true,'bp:alpha':false},archiveOpen:false,archiveFilter:'',cloudArchiveOpen:false,cloudArchiveFilter:'',archived:{'bp:unplaced-cloud':true},cloudLayoutMigration:{previousRoots:['alpha','bp:alpha'],moved:[]}}};
sourceStore.writeJson('workspace.json',original);
const options={profileId,sourceDir,destinationDir:backupDir,quiesced:true,metadata:Object.fromEntries([alpha,beta].map(d=>[d.id,{description:'Preserve the original human navigation, nested Pages and per-chat paths in this private migration rehearsal',tags:[{tag:'navproof',strength:95,rationale:'Private navigation preservation proof'}]}]))};
const snapshot=inventoryProfile(options),projection=projectWorkspace(options);assert.equal(projection.status,'preview');assert.equal(projection.activationAllowed,false);assert.deepEqual(projectWorkspace(options),projection);
const ids=Object.fromEntries(projection.documentMap.map(d=>[d.id,d.targetId]));
const out=path.resolve(appDir,'../docs/visual/migration/runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'projection.json'),JSON.stringify(projection,null,2)+'\n');
let app,page,video,editorBundle;const frames=[],errors=[],results=[];
async function request(method,route,body,status=200){const r=await fetch(server+route,{method,redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d.result||d;}
const read=id=>request('GET','/v1/data/doc/production/paper/'+id+'?perspective=published');
const canvas=()=>page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas');
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
const launch=async()=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
async function arrived(id){const expected=await read(id);await page.waitForFunction(({id,blocks})=>{const p=document.querySelector('.bw-paper-pane:not([hidden])'),c=p?.querySelector('bp-paper-canvas');return p?.querySelector('#path')?.textContent.includes(id)&&c?._editor&&JSON.stringify(c.recoverySnapshot().blocks)===JSON.stringify(blocks);},{id,blocks:expected.blocks},{timeout:30000});await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live'));}
async function unchangedOrganization(){const state=await page.evaluate(()=>window.__barkdown.state);assert.deepEqual(state.pages,projection.workspace.pages);assert.deepEqual(state.favorites,projection.workspace.favorites);assert.equal(state.chats.side.parent,'main');for(const id of ['main','side']){assert.equal(state.chats[id].draft,original.chats[id].draft);assert.deepEqual(state.chats[id].messages,original.chats[id].messages);}assert.deepEqual(state.chats.side.tabs.find(t=>t.id==='path-side').path,[ids.beta]);}
try{
  await request('POST','/v1/data/mutate/production',{mutations:[{create:{_id:'navproof',_type:'tag',title:'Navigation proof'}},{publish:{id:'navproof',type:'tag'}}]});
  await request('POST','/v1/plugins/bulldocs/papers/alpha/create',{slug:'alpha',title:'Cloud Alpha',style:'article',description:'A deliberately separate cloud paper sharing the legacy slug, whose identity and existing placement must remain independent',tags:[{tag:'navproof',strength:95,rationale:'Existing cloud identity proof'}],blocks:[{id:'cloud-original',type:'paragraph',content:[{type:'text',value:'This is the existing cloud Alpha, never the migrated local note.'}]}]},201);
  const target={profileId,runtimeId:'private-navigation-'+profileId,server,dataset:'production',token,assertOwned:b=>b.profileId===profileId&&b.server===server};await stageMigration(options,target);
  const papers=Object.fromEntries(await Promise.all([ids.alpha,ids.beta,'alpha'].map(async id=>[id,await read(id)])));
  createStore(userData).writeJson('workspace.json',projection.workspace);
  await launch();await page.evaluate(async c=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,writes:true,viaCli:false,...c}});await window.__barkdown.refreshLibrary();},{server,token});
  await page.locator('.bw-side-chat').waitFor();await unchangedOrganization();assert.equal(await page.locator('#bw-prompt').inputValue(),original.chats.main.draft);assert.equal(await page.locator('.bw-side-chat textarea').inputValue(),original.chats.side.draft);await shot('01-projected-sidechat-and-pages');
  await page.locator('.bw-side-chat #open-chat').click();await arrived(ids.beta);assert.equal(await page.locator('#bw-prompt').inputValue(),original.chats.side.draft);await shot('02-sidechat-owned-path');
  await page.locator('#bw-transcript [data-parent]').click();await page.locator('.bw-side-chat').waitFor();assert.equal(await page.locator('#bw-prompt').inputValue(),original.chats.main.draft);
  await page.locator('#bw-tabs [data-tab="path-main"]').click();await arrived(ids.beta);assert.deepEqual(await page.evaluate(()=>window.__barkdown.state.chats.main.tabs.find(t=>t.id==='path-main').path),[ids.alpha,ids.beta]);await shot('03-parent-document-path');
  await page.locator(`#bw-pages [data-open="bp:${ids.alpha}"]`).click();await arrived(ids.alpha);assert.equal(await page.evaluate(()=>window.__barkdown.state.mode),'document');await shot('04-direct-local-page');
  await page.locator('#bw-pages [data-open="bp:alpha"]').click();await arrived('alpha');await shot('05-distinct-cloud-page');
  await page.locator(`#bw-pages [data-open="bp:${ids.beta}"]`).click();await arrived(ids.beta);assert.equal(await page.locator(`#bw-pages [data-page="bp:${ids.beta}"]`).getAttribute('data-depth'),'1');await shot('06-nested-page');
  await page.locator('#bw-favorites').click();await page.locator('#bw-fav-menu [data-open="local-fav"]').click();await arrived(ids.alpha);await shot('07-local-favorite');
  await page.locator('#bw-favorites').click();await page.locator('#bw-fav-menu [data-open="cloud-fav"]').click();await arrived('alpha');await shot('08-cloud-favorite');
  await unchangedOrganization();editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json')));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.sha,crypto.createHash('sha1').update(fs.readFileSync(path.join(process.env.BARKDOWN_TEST_BP_SOURCE,'api/priv/static/assets/bp-paper-editor.bundle.js'))).digest('hex'));
  await page.setViewportSize({width:760,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('09-narrow');
  await page.waitForFunction(async()=>{const saved=await window.barkdown.state.load();return saved?.mode==='chat'&&saved.current==='main'&&saved.chats.main.active==='cloud-view'&&saved.chats.main.draft==='Keep my main draft.'&&saved.chats.side.draft==='Keep my independent side draft.';});await close('projected-navigation');
  await launch();await arrived('alpha');await unchangedOrganization();await shot('10-restarted');
  for(const file of snapshot.files){assert.deepEqual(fs.readFileSync(path.join(sourceDir,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(backupDir,'source',file.path)),file.data);}
  for(const [id,originalPaper] of Object.entries(papers))assert.deepEqual(await read(id),originalPaper);
  assert.deepEqual(errors,[]);results.push('Pages order/nesting, distinct same-slug cloud identity, parent/side drafts and paths, direct navigation/favorites/restart; source/backup/Papers unchanged');
  console.log('PASS projected human organization through actual Paper navigation and restart; no source authority switch');
}catch(error){if(page&&app){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,state:window.__barkdown.state})).catch(()=>null),null,2));}fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{if(app)await close('restart-or-failure');const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,profileId,sourceHash:snapshot.sourceHash,projectionHash:projection.projectionHash,editorBundle,results,frames,artifacts,authority:'legacy',limits:['Separate disposable target app loads only a projected copy; no activation or writer fencing','Unplaced local archive and source-less closed targets explicitly refuse','Old transcripts/receipts remain opaque legacy evidence; no revision reinterpretation','Clean restart and same-machine paths; no cross-machine or power-loss proof']},null,2)+'\n');console.log('Workspace projection evidence:',out);}
