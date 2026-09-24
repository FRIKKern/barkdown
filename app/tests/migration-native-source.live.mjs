// Actual legacy-editor persistence -> strict staging -> actual Paper editing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const require=createRequire(import.meta.url);
const {createProfileRegistry}=require('../main/profile-registry'),{createStore}=require('../main/store'),{createDocuments}=require('../main/documents');
const {inventoryProfile}=require('../main/migration-preflight'),{stageMigration}=require('../main/migration-staging');
const server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(server||'')||!token)throw Error('Owned isolated runtime required');
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bd-native-source-'));
const sourceUserData=path.join(temporary,'source-app'),paperUserData=path.join(temporary,'paper-app'),backupDir=path.join(temporary,'backup');
const registry=createProfileRegistry(path.join(sourceUserData,'profile-data')),profile=registry.createProfile({name:'Original writing room'}),profileId=profile.id,sourceDir=registry.storeFor(profileId).storeDir;
const store=createStore(sourceDir),docs=createDocuments(store);docs.loadAll({seed:false});
const anchor=docs.create({title:'Anchor note',markdown:'The connected note has its own identity.'});
const main=docs.create({title:'A normal saved note',markdown:'# Thoughts to carry forward\n\n[External reference](https://example.org/reference) and [a connected note](barkdown://doc/anchor-note).\n\n1. First item\n2. Second item\n\nTail paragraph.'});
const parser=docs.create({title:'Parser note',markdown:'[Parser link](https://example.org/parser) stays unchanged.'});
store.writeJson('workspace.json',{version:1,chats:{writing:{id:'writing',title:'A writing conversation',messages:[],apiHistory:[],events:[],draftImages:[],closedTargets:[],runId:null,tabs:[],active:null,draft:'Keep the source draft.',folder:null,following:true}},order:['writing'],current:'writing',favorites:[],pages:{layoutVersion:2,seeded:true,roots:[main.id,parser.id,anchor.id],children:{},expanded:{},archiveOpen:false,archiveFilter:'',cloudArchiveOpen:false,cloudArchiveFilter:''},mode:'chat',directTab:null});
const out=path.resolve(appDir,'../docs/visual/migration/runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
let app,page,video,snapshot,editorBundle;const frames=[],results=[],errors=[];
const launch=async source=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,...(source?['--profiles']:[]),`--user-data=${source?sourceUserData:paperUserData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
async function request(method,route,body){const r=await fetch(server+route,{method,redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const data=await r.json();return data.result||data;}
const read=id=>request('GET','/v1/data/doc/production/paper/'+id+'?perspective=published');
const canvas=()=>page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas');
const blocks=()=>canvas().evaluate(c=>c.recoverySnapshot().blocks);
const ready=async()=>{await canvas().locator('.ProseMirror').waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live'));};
const open=async id=>{await page.evaluate(id=>window.__barkdown.openTarget({kind:'doc',id,source:'barkpark',title:id}),id);await ready();};
async function saved(id,rev){await page.waitForFunction(rev=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'),host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c)),s=document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent||'';return c&&host&&!host.isDirty()&&!c.hasPendingChanges()&&Number(s.match(/Saved · rev (\d+)/)?.[1])>rev;},rev,{timeout:45000});const value=await read(id);assert.deepEqual(await blocks(),value.blocks);return value;}
function insertX(blocks,needle){const value=structuredClone(blocks);let done=false;function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(!done&&v.type==='text'&&v.value===needle){v.value=v.value.slice(0,1)+'X'+v.value.slice(1);done=true;}else Object.values(v).forEach(visit);}}visit(value);assert.ok(done);return value;}
try{
  await launch(true);assert.equal(await page.evaluate(()=>window.__barkdown.state.profileId),profileId);
  await page.evaluate(d=>window.__barkdown.openTarget({kind:'doc',id:d.id,title:d.title,source:'local'}),main);
  const editor=page.locator('.bw-doc-pane:visible .ProseMirror');await editor.waitFor();await shot('01-legacy-original');
  await editor.locator('p').filter({hasText:'Tail paragraph.'}).click();await page.keyboard.press('Control+End');await page.keyboard.type(' Written in the original editor.',{delay:30});
  await page.waitForFunction(()=>document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent.includes('Saved · rev 2'));
  const source=await page.evaluate(id=>window.barkdown.docs.get(id),main.id);assert.equal(source.rev,2);
  const links=source.content.content[1].content.filter(n=>n.marks?.some(m=>m.type==='link'));
  assert.equal(links.length,2);for(const node of links){const a=node.marks.find(m=>m.type==='link').attrs;assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer nofollow');assert.equal(a.class,null);assert.equal(a.title,null);}
  assert.deepEqual(source.content.content[2].attrs,{start:1,type:null});await shot('02-legacy-saved-defaults');await close('legacy-source-writing');
  const options={profileId,sourceDir,destinationDir:backupDir,quiesced:true,metadata:Object.fromEntries([main,parser,anchor].map(d=>[d.id,{description:'Native source migration preserves ordinary saved link and list defaults through real Paper editing and restart',tags:[{tag:'nativeproof',strength:95,rationale:'Private native source compatibility rehearsal'}]}]))};
  snapshot=inventoryProfile(options);assert.deepEqual(snapshot.issues,[]);
  const ids=Object.fromEntries(snapshot.documents.map(d=>[d.id,d.targetId]));
  fs.writeFileSync(path.join(out,'native-source.json'),JSON.stringify({content:source.content,parserContent:parser.content,sourceHash:snapshot.sourceHash},null,2)+'\n');
  await request('POST','/v1/data/mutate/production',{mutations:[{create:{_id:'nativeproof',_type:'tag',title:'Native source proof'}},{publish:{id:'nativeproof',type:'tag'}}]});
  const target={profileId,runtimeId:'private-native-'+profileId,server,dataset:'production',token,assertOwned:b=>b.profileId===profileId&&b.server===server};await stageMigration(options,target);await stageMigration(options,target);
  const text=value=>({type:'text',value});
  const expected=[{type:'heading',level:1,text:'Thoughts to carry forward'},{type:'paragraph',content:[{type:'link',href:'https://example.org/reference',children:[text('External reference')]},text(' and '),{type:'wikilink',target:'Anchor note',docId:ids[anchor.id],children:[text('a connected note')]},text('.')]},{type:'list',ordered:true,items:[[text('First item')],[text('Second item')]]},{type:'paragraph',content:[text('Tail paragraph. Written in the original editor.')]}].map((b,i)=>({...b,id:'migration-'+i}));
  const parserExpected=[{type:'paragraph',content:[{type:'link',href:'https://example.org/parser',children:[text('Parser link')]},text(' stays unchanged.')],id:'migration-0'}];
  assert.deepEqual((await read(ids[main.id])).blocks,expected);assert.deepEqual((await read(ids[parser.id])).blocks,parserExpected);
  await launch(false);await page.evaluate(async c=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,writes:true,viaCli:false,...c}});await window.__barkdown.refreshLibrary();},{server,token});
  await open(ids[main.id]);assert.deepEqual(await blocks(),expected);
  editorBundle=JSON.parse(fs.readFileSync(path.join(paperUserData,'canvas-bundle/current.json')));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.sha,crypto.createHash('sha1').update(fs.readFileSync(path.join(process.env.BARKDOWN_TEST_BP_SOURCE,'api/priv/static/assets/bp-paper-editor.bundle.js'))).digest('hex'));
  const link=canvas().locator('a[href="https://example.org/reference"]');assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer nofollow');assert.equal(await canvas().locator('ol').count(),1);await shot('03-migrated-native-source');
  for(const [key,id,original,needle] of [['external',ids[main.id],expected,'External reference'],['numbered-list',ids[main.id],expected,'First item'],['parser',ids[parser.id],parserExpected,'Parser link']]){
    await open(id);const before=await read(id);assert.deepEqual(await blocks(),original);
    await canvas().evaluate((c,needle)=>{const e=c._editor;let at;e.state.doc.descendants((n,p)=>{if(at===undefined&&n.isText&&n.text.includes(needle))at=p+n.text.indexOf(needle)+1;});if(at===undefined)throw Error('Missing native text');e.view.focus();e.commands.setTextSelection(at);},needle);
    await page.keyboard.type('X');const edited=await saved(id,before.rev);assert.deepEqual(edited.blocks,insertX(original,needle));await shot('04-edit-'+key);
    await page.keyboard.press('Control+z');const undone=await saved(id,edited.rev);assert.deepEqual(undone.blocks,original);await shot('05-undo-'+key);results.push({case:key,editedRev:edited.rev,undoneRev:undone.rev});
  }
  await open(ids[main.id]);await page.evaluate(()=>document.activeElement?.blur?.());await canvas().locator('span[data-wikilink]').filter({hasText:'a connected note'}).hover();
  await page.waitForFunction(()=>document.querySelector('body .bp-link-preview__excerpt')?.textContent.includes('own identity'));await shot('06-native-link-preview');
  await page.locator('body .bp-link-preview__open').click();await page.waitForFunction(id=>{const p=document.querySelector('.bw-paper-pane:not([hidden])');return p?.querySelector('#path')?.textContent.includes(id)&&p.querySelector('bp-paper-canvas')?.recoverySnapshot().blocks[0]?.content?.[0]?.value==='The connected note has its own identity.';},ids[anchor.id]);await ready();
  assert.deepEqual(await blocks(),(await read(ids[anchor.id])).blocks);await shot('07-linked-note');
  await open(ids[main.id]);await canvas().evaluate(c=>c.__beforeReload=true);await page.locator('.bw-paper-pane:not([hidden]) button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');return c&&!c.__beforeReload&&c._editor;});assert.deepEqual(await blocks(),expected);await shot('08-reloaded');
  await page.setViewportSize({width:760,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('09-narrow');await close('native-source-paper-editing');
  await launch(false);await ready();assert.deepEqual(await blocks(),expected);await shot('10-restarted');assert.deepEqual((await read(ids[parser.id])).blocks,parserExpected);
  for(const file of snapshot.files){assert.deepEqual(fs.readFileSync(path.join(sourceDir,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(backupDir,'source',file.path)),file.data);}assert.deepEqual(errors,[]);
  console.log('PASS actual legacy save defaults, strict staging, native link/list/parser edits and exact Undo, reference navigation, reload/restart and original preservation');
}catch(error){if(page&&app){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,panes:[...document.querySelectorAll('.bw-doc-pane,.bw-paper-pane')].map(p=>({hidden:p.hidden,display:getComputedStyle(p).display,status:p.querySelector('#save-state')?.textContent})),blocks:document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')?.recoverySnapshot()?.blocks})).catch(()=>null),null,2));}fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{if(app)await close('restart-or-failure');const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,profileId,sourceHash:snapshot?.sourceHash,editorBundle,cases:results,frames,artifacts,authority:'legacy',limits:['Exact audited default link attributes and null list type only; custom values refuse','Disposable closed source and separate target app; no authority activation','Clean restart and native saved Undo, not power-loss or portability proof']},null,2)+'\n');console.log('Native source evidence:',out);}
