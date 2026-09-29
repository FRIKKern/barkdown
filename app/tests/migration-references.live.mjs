import { openFixturePaper } from './lib/paper-fixture.mjs';
// Real linked-library staging, graph and native Paper history proof. Disposable runtime only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const { stageMigration } = require('../main/migration-staging');
const { inventoryProfile } = require('../main/migration-preflight');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-linked-migration-'));
const userData = path.join(temporary, 'electron');
const out = path.resolve(appDir, '../docs/visual/migration/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const tag = 'linkproof';
async function request(method, route, body) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  return { status: response.status, data: await response.json() };
}
const read = async id => { const r = await request('GET', `/v1/data/doc/production/paper/${id}?perspective=published`); assert.equal(r.status, 200); return r.data.result || r.data; };
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const link = (text, id='z-destination') => ({ type: 'text', text, marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'link', attrs: { href: 'barkdown://doc/'+id } }] });
const linkedParagraph = text => ({type:'paragraph',content:[link(text)]});
function library(label) {
  const profileId=crypto.randomUUID(), sourceDir=path.join(temporary,profileId), destinationDir=path.join(temporary,profileId+'-backup');
  fs.mkdirSync(path.join(sourceDir,'documents'),{recursive:true});
  const sources=[
    {id:'origin',title:'Field notebook',rev:2,content:{type:'doc',content:[
      paragraph(label+' profile: these links belong to this library.'),
      linkedParagraph('Marked destination'),
      {type:'heading',attrs:{level:2},content:[link('Heading destination')]},
      {type:'blockquote',content:[linkedParagraph('Quoted destination')]},
      {type:'bulletList',content:[{type:'listItem',content:[linkedParagraph('List destination')]}]},
      {type:'taskList',content:[{type:'taskItem',attrs:{checked:false},content:[linkedParagraph('Task destination')]}]},
      {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[linkedParagraph('Cell destination')]}]}]},
      {type:'paragraph',content:[link('This same notebook','origin')]},
    ]}},
    {id:'z-destination',title:'Destination notebook',rev:3,content:{type:'doc',content:[paragraph(label+' profile destination: the same titles in other profiles must never substitute this note.'),{type:'paragraph',content:[{type:'text',text:'Return to origin',marks:[{type:'link',attrs:{href:'barkdown://doc/origin'}}]}]}]}},
  ];
  for(const source of sources)fs.writeFileSync(path.join(sourceDir,'documents',source.id+'.json'),JSON.stringify(source,null,2)+'\n');
  fs.writeFileSync(path.join(sourceDir,'workspace.json'),JSON.stringify({pages:{roots:['origin'],children:{origin:['z-destination']}},favorites:[{kind:'doc',id:'origin'}],chats:{side:{parent:'main',draft:'Unsent '+label}}}));
  const options={profileId,sourceDir,destinationDir,quiesced:true,metadata:Object.fromEntries(sources.map(s=>[s.id,{description:'Disposable linked notebook migration preserves profile identity, references and marked labels',tags:[{tag,strength:95,rationale:'Registered private linked migration rehearsal'}]}]))};
  const target={profileId,runtimeId:'private-links-'+profileId,server,dataset:'production',token,assertOwned:binding=>binding.profileId===profileId&&binding.server===server};
  const snapshot=inventoryProfile(options);
  return {label,options,target,snapshot,ids:Object.fromEntries(snapshot.documents.map(d=>[d.id,d.targetId]))};
}
// Each source profile owns a separate private runtime; run both labels through
// the isolated wrapper, never pretend a shared server is two profile stores.
const label=process.env.BARKDOWN_LINK_PROFILE || 'Orchard';
assert.ok(['Orchard','Coast'].includes(label));
const libraries=[library(label)];
let app,page,video,editorBundle;
const frames=[],results=[],errors=[];
const canvas=()=>page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas');
const blocks=()=>canvas().evaluate(c=>c.recoverySnapshot().blocks);
const ready=async()=>{await canvas().locator('.ProseMirror').waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live'));};
const arrived=async id=>{
  const expected=await read(id),lead=expected.blocks[0].content[0].value;
  await page.waitForFunction(({id,lead})=>{
    const pane=document.querySelector('.bw-paper-pane:not([hidden])');
    const c=pane?.querySelector('bp-paper-canvas');
    return pane?.querySelector('#path')?.textContent.includes(id)&&c?._editor&&c.recoverySnapshot().blocks[0]?.content?.[0]?.value===lead;
  },{id,lead},{timeout:20000});
  await ready();
};
const open=async id=>{await openFixturePaper(page, id);await arrived(id);assert.deepEqual(await blocks(),(await read(id)).blocks);};
const shot=async name=>{let file=name+'.png',n=1;while(fs.existsSync(path.join(out,file)))file=name+'-'+(++n)+'.png';await page.screenshot({path:path.join(out,file)});frames.push(file);};
const launch=async()=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
async function graph() {
  const values=[];
  for(const lib of libraries)for(const [sourceId,id] of Object.entries(lib.ids)) {
    // The actual endpoint reads the asynchronously projected graph. Its source
    // identity is from_doc_id (not a document _id); projection debounces 5s.
    const expected=sourceId==='origin'?lib.ids['z-destination']:lib.ids.origin;
    let value;const started=Date.now();
    do {
      const r=await request('GET','/v1/data/backlinks/production/'+id);assert.equal(r.status,200);
      value=r.data.result;assert.ok(Array.isArray(value?.backlinks));
      if(value.count===1&&value.backlinks[0]?.from_doc_id===expected)break;
      if(Date.now()-started>45000){fs.writeFileSync(path.join(out,'graph-failure.json'),JSON.stringify({id,expected,value},null,2));break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    } while(true);
    assert.equal(value.count,1);assert.deepEqual(value.backlinks.map(d=>d.from_doc_id),[expected]);
    assert.equal(value.backlinks[0].kind,'references');
    values.push({profile:lib.label,id,backlinks:value.backlinks.map(d=>d.from_doc_id)});
  }
  return values;
}
async function saved(id, previous) {
  await page.waitForFunction(rev=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');const host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));const status=document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent||'';return c&&host&&!host.isDirty()&&!c.hasPendingChanges()&&Number(status.match(/Saved \u00b7 rev (\d+)/)?.[1])>rev;},previous,{timeout:45000});
  const value=await read(id);assert.deepEqual(await blocks(),value.blocks);return value;
}
async function navigate(lib, from, label, destination) {
  await open(lib.ids[from]);
  await page.evaluate(()=>document.activeElement?.blur?.());
  const span=canvas().locator('span[data-wikilink]').filter({hasText:label}).first();
  await span.hover();
  await page.waitForFunction(text=>document.querySelector('body .bp-link-preview__excerpt')?.textContent.includes(text),lib.label+' profile',{timeout:15000});
  await shot(lib.label+'-'+from+'-preview');
  await page.locator('body .bp-link-preview__open').click();await arrived(lib.ids[destination]);
  assert.deepEqual(await blocks(),(await read(lib.ids[destination])).blocks,'native Open reaches exact profile-qualified target');
  await shot(lib.label+'-'+destination+'-opened');
}
try {
  assert.equal((await request('POST','/v1/data/mutate/production',{mutations:[{create:{_id:tag,_type:'tag',title:'Linked migration proof'}},{publish:{id:tag,type:'tag'}}]})).status,200);
  // A real process dies after the first linked note, while its target is absent.
  const config=path.join(temporary,'staging-child.json');fs.writeFileSync(config,JSON.stringify({options:libraries[0].options,target:{...libraries[0].target,token:undefined}}));
  const code=`const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.LINK_CONFIG));c.target.token=process.env.BARKPARK_API_TOKEN;c.target.assertOwned=b=>b.profileId===c.options.profileId&&b.server===process.env.BARKDOWN_SHOTS_SERVER;require(process.env.LINK_MODULE).stageMigration(c.options,c.target,{checkpoint:n=>{if(n==='receipt:origin')process.exit(77)}}).catch(e=>{console.error(e);process.exit(1)});`;
  const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',code],{windowsHide:true,env:{...process.env,LINK_CONFIG:config,LINK_MODULE:require.resolve('../main/migration-staging')},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',status=>resolve({status,stderr}));});
  assert.equal(exit.status,77,exit.stderr);
  const firstBefore=await read(libraries[0].ids.origin);
  const absent=await request('GET',`/v1/data/doc/production/paper/${libraries[0].ids['z-destination']}?perspective=published`);assert.equal(absent.status,404);
  for(const lib of libraries){await stageMigration(lib.options,lib.target);await stageMigration(lib.options,lib.target);}
  assert.equal((await read(libraries[0].ids.origin))._rev,firstBefore._rev,'resume never recreates the first linked note');
  const initialGraph=await graph();
  await launch();await page.evaluate(async connection=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,writes:true,viaCli:false,...connection}});await window.__barkdown.refreshLibrary();},{server,token});
  await open(libraries[0].ids.origin);
  editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json')));assert.equal(editorBundle.source,'server');
  assert.equal(editorBundle.sha,crypto.createHash('sha1').update(fs.readFileSync(path.join(process.env.BARKDOWN_TEST_BP_SOURCE,'api/priv/static/assets/bp-paper-editor.bundle.js'))).digest('hex'));
  await shot('01-staged-linked-library');
  const id=libraries[0].ids.origin,original=await read(id);let revision=original.rev;
  for(const label of ['Marked destination','Heading destination','Quoted destination','List destination','Task destination','Cell destination','This same notebook']) {
    await canvas().evaluate((c,label)=>{const e=c._editor;let at;e.state.doc.descendants((n,pos)=>{if(n.isText&&n.text===label)at=pos+1;});if(at===undefined)throw Error('Missing marked link');e.view.focus();e.commands.setTextSelection(at);},label);
    await page.keyboard.type('X');const edited=await saved(id,revision);
    const expected=structuredClone(original.blocks);let changed=0;
    const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(v.type==='text'&&v.value===label){v.value=label.slice(0,1)+'X'+label.slice(1);changed++;}else Object.values(v).forEach(walk);}};walk(expected);assert.equal(changed,1);
    assert.deepEqual(edited.blocks,expected,'only intended marked label changes, retaining target ID');await shot('edit-'+label.split(' ')[0].toLowerCase());
    await page.keyboard.press(`${MOD}+z`);const undone=await saved(id,edited.rev);assert.deepEqual(undone.blocks,original.blocks,'exact source carriers return with Undo');
    results.push({label,editedRev:edited.rev,undoneRev:undone.rev});revision=undone.rev;
  }
  assert.deepEqual(await graph(),initialGraph);
  for(const lib of libraries){await navigate(lib,'origin','Marked destination','z-destination');await navigate(lib,'z-destination','Return to origin','origin');await navigate(lib,'origin','This same notebook','origin');}
  await open(id);await canvas().evaluate(c=>c.__beforeReferenceReload=true);await page.locator('.bw-paper-pane:not([hidden]) button[title="Reload from server"]').click();
  await page.waitForFunction(()=>{const c=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');return c&&!c.__beforeReferenceReload&&c._editor;});assert.deepEqual(await blocks(),original.blocks);await shot('02-reloaded');
  await page.setViewportSize({width:760,height:900});
  const geometry=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));assert.ok(geometry.page<=geometry.viewport);await shot('03-narrow');
  await close('links-editing-navigation');await launch();await ready();assert.deepEqual(await blocks(),original.blocks);await shot('04-restarted');
  await navigate(libraries[0],'origin','Marked destination','z-destination');assert.deepEqual(await graph(),initialGraph);
  for(const lib of libraries)for(const file of lib.snapshot.files){assert.deepEqual(fs.readFileSync(path.join(lib.options.sourceDir,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(lib.options.destinationDir,'source',file.path)),file.data);}
  await assert.rejects(stageMigration(libraries[0].options,libraries[0].target),{code:'journal_changed'});assert.deepEqual((await read(id)).blocks,original.blocks);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'graph.json'),JSON.stringify({initialGraph,afterRestart:await graph(),geometry,interruptedResume:true},null,2)+'\n');
  console.log('PASS seven marked links across six carriers, self/cyclic native navigation, profile-pinned identity, exact Undo/reload/restart, graph and process-interrupted resume');
} catch(error) {
  if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});const state=await canvas().evaluate(c=>({editor:c._editor?.getJSON(),blocks:c.recoverySnapshot().blocks,pending:c.hasPendingChanges(),saveState:document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent,html:c._editor?.view.dom.innerHTML})).catch(()=>null);fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(state,null,2));}
  fs.writeFileSync(path.join(out,'failure-server.json'),JSON.stringify(await read(libraries[0].ids.origin).catch(()=>null),null,2));
  fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;
} finally {
  if(app)await close('restart-or-failure');
  const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,profile:label,profileId:libraries[0].options.profileId,sourceIds:libraries[0].ids,editorBundle,cases:results,frames,artifacts,authority:'legacy',limits:['Disposable library only; paired isolated runs prove same-title cross-profile separation; no real-library activation','Native references preserve links to current content; history/receipts remain legacy','Clean Electron restart and process-exit recovery, not database power loss']},null,2)+'\n');
  console.log('Linked migration evidence:',out);
}
