import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
const require=createRequire(import.meta.url);
const {prepareMigration}=require('../main/migration-preflight');
const {restoreMigrationBackup,validateBackup}=require('../main/migration-restore');
const {createStore}=require('../main/store');
const {createDocuments}=require('../main/documents');
const modulePath=require.resolve('../main/migration-restore');

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-migration-restore-')),profileId=crypto.randomUUID();
  const sourceDir=path.join(root,'source',profileId),backupDir=path.join(root,'backup'),parent=path.join(root,'restored');
  fs.mkdirSync(sourceDir,{recursive:true});fs.mkdirSync(parent);
  const store=createStore(sourceDir),docs=createDocuments(store);docs.loadAll({seed:false});
  const note=docs.create({title:'Retained note',markdown:'Original æ 🌲 note'});
  docs.save({id:note.id,baseRev:note.rev,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Current note'}]}]},actor:'you'});
  const value=store.readJson('documents/retained-note.json');value.proposals=[{id:'pending-review',baseRev:2,summary:'Retained legacy proposal',content:note.content}];store.writeJson('documents/retained-note.json',value);
  store.writeJson('workspace.json',{version:1,chats:{main:{id:'main',title:'Main',draft:'Unsent main thought',messages:[],tabs:[]},side:{id:'side',parent:'main',side:true,draft:'Unsent side thought',messages:[],tabs:[{id:'note-tab',type:'doc',idForDocument:'retained-note'}]}},order:['main','side'],current:'side',pages:{roots:['retained-note']}});
  fs.mkdirSync(path.join(sourceDir,'attachments'));fs.writeFileSync(path.join(sourceDir,'attachments/blob.bin'),crypto.randomBytes(180000));
  fs.mkdirSync(path.join(sourceDir,'agent-edits'));fs.writeFileSync(path.join(sourceDir,'agent-edits/receipt.json'),'{"beforeRev":1,"afterRev":2,"status":"retained"}\r\n');
  store.writeJson('paper-proposals.json',{legacy:{id:'keep-original-revision-semantics'}});
  store.writeJson('local-credentials.json',{secret:'excluded'});store.writeJson('settings.json',{secret:'also excluded'});
  const manifest=prepareMigration({profileId,sourceDir,destinationDir:backupDir,quiesced:true});assert.equal(manifest.status,'prepared');
  fs.mkdirSync(path.join(backupDir,'staging'));fs.writeFileSync(path.join(backupDir,'staging/retained.json'),'already staged; never edit');
  const destinationDir=path.join(parent,profileId),options={profileId,backupDir,destinationDir,expectedSourceHash:manifest.sourceHash,quiesced:true};
  const restore=extra=>restoreMigrationBackup(options,extra);
  const journal=()=>path.join(backupDir,'restore',fs.readdirSync(path.join(backupDir,'restore'))[0]);
  return {root,profileId,sourceDir,backupDir,destinationDir,options,manifest,restore,journal};
}
function assertExact(f) {
  for(const entry of f.manifest.files){
    const before=fs.readFileSync(path.join(f.sourceDir,entry.path));
    assert.deepEqual(fs.readFileSync(path.join(f.backupDir,'source',entry.path)),before);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,entry.path)),before);
  }
  assert.equal(fs.readFileSync(path.join(f.backupDir,'staging/retained.json'),'utf8'),'already staged; never edit');
}
function moveInsideFixture(f,from,to) {
  for(const p of [from,to])assert.ok(path.resolve(p).startsWith(path.resolve(f.root)+path.sep));
  fs.renameSync(from,to);
}

test('exact restore preserves legacy history/proposals/media/workspace and excludes credentials',()=>{
  const f=fixture(),result=f.restore();assert.equal(result.status,'restored');assert.equal(result.authority,'legacy');assertExact(f);assert.deepEqual(f.restore(),result);
  assert.equal(fs.existsSync(path.join(f.destinationDir,'local-credentials.json')),false);assert.equal(fs.existsSync(path.join(f.destinationDir,'settings.json')),false);
  const docs=createDocuments(createStore(f.destinationDir));docs.loadAll({seed:false});
  assert.equal(docs.get('retained-note').rev,2);assert.equal(docs.get('retained-note').proposals[0].id,'pending-review');assert.equal(docs.history('retained-note').length,2);
  assert.equal(docs.restore('retained-note',1).ok,true);assert.match(docs.get('retained-note').text,/Original æ/);
  assert.throws(()=>f.restore(),{code:'restore_changed'});
  assert.match(fs.readFileSync(path.join(f.backupDir,'source/documents/retained-note.json'),'utf8'),/Current note/);
});

test('pinned source/profile and fully committed backup are required before destination writes',()=>{
  for(const mode of ['hash','owner','manifest','intent','bytes','missing','extra']){
    const f=fixture();
    if(mode==='hash')f.options.expectedSourceHash='a'.repeat(64);
    if(mode==='owner')f.options.profileId=crypto.randomUUID();
    if(mode==='manifest')fs.writeFileSync(path.join(f.backupDir,'manifest.json'),'{}');
    if(mode==='intent')fs.writeFileSync(path.join(f.backupDir,'intent.json'),'{}');
    if(mode==='bytes')fs.appendFileSync(path.join(f.backupDir,'source/attachments/blob.bin'),'changed');
    if(mode==='missing')moveInsideFixture(f,path.join(f.backupDir,'source/workspace.json'),path.join(f.root,'retained-workspace.json'));
    if(mode==='extra')fs.writeFileSync(path.join(f.backupDir,'source/local-credentials.json'),'not allowed');
    assert.throws(()=>f.restore(),undefined,mode);assert.equal(fs.existsSync(f.destinationDir),false,mode);
  }
});

test('blocked migration backup remains recoverable without converting its unsupported content',()=>{
  const f=fixture(),source=path.join(f.sourceDir,'documents/retained-note.json'),doc=JSON.parse(fs.readFileSync(source));
  doc.content={type:'doc',content:[{type:'heading',attrs:{level:6},content:[{type:'text',text:'Keep level six'}]}]};fs.writeFileSync(source,JSON.stringify(doc));
  f.options.backupDir=path.join(f.root,'blocked-backup');const manifest=prepareMigration({profileId:f.profileId,sourceDir:f.sourceDir,destinationDir:f.options.backupDir,quiesced:true});assert.equal(manifest.status,'blocked');f.options.expectedSourceHash=manifest.sourceHash;
  f.restore();assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'documents/retained-note.json')),fs.readFileSync(source));
});

test('existing destinations, disjointness and quiescence refuse without overwriting',()=>{
  const f=fixture();fs.mkdirSync(f.destinationDir);fs.writeFileSync(path.join(f.destinationDir,'workspace.json'),'human work');
  assert.throws(()=>f.restore(),{code:'restore_exists'});assert.equal(fs.readFileSync(path.join(f.destinationDir,'workspace.json'),'utf8'),'human work');
  const g=fixture();g.options.destinationDir=path.join(g.backupDir,g.profileId);assert.throws(()=>g.restore(),{code:'restore_scope'});
  const h=fixture();h.options.quiesced=false;assert.throws(()=>h.restore(),{code:'restore_owner'});assert.equal(fs.existsSync(h.destinationDir),false);
});

for(const boundary of ['restore-plan','restore-root','restore-intent:attachments/blob.bin','restore-chunk:attachments/blob.bin','restore-temp:attachments/blob.bin','restore-published:attachments/blob.bin','restore-receipt:attachments/blob.bin','restore-before-complete'])test('real process exit resumes at '+boundary,()=>{
  const f=fixture(),config=path.join(f.root,'options.json');fs.writeFileSync(config,JSON.stringify(f.options));
  const code=`const o=JSON.parse(require('fs').readFileSync(process.env.RESTORE_OPTIONS));require(process.env.RESTORE_MODULE).restoreMigrationBackup(o,{checkpoint:n=>{if(n===process.env.RESTORE_BOUNDARY)process.exit(77)}});`;
  const child=spawnSync(process.execPath,['-e',code],{encoding:'utf8',windowsHide:true,env:{...process.env,RESTORE_OPTIONS:config,RESTORE_MODULE:modulePath,RESTORE_BOUNDARY:boundary}});
  assert.equal(child.status,77,child.stderr);
  const result=f.restore();assertExact(f);assert.deepEqual(f.restore(),result);
});

test('changed/extra/missing restored data is retained and never overwritten or recreated',()=>{
  for(const mode of ['changed','extra','missing']){
    const f=fixture();f.restore();
    if(mode==='changed')fs.writeFileSync(path.join(f.destinationDir,'workspace.json'),'new human draft');
    if(mode==='extra')fs.writeFileSync(path.join(f.destinationDir,'documents/new-note.json'),'new human note');
    if(mode==='missing')moveInsideFixture(f,path.join(f.destinationDir,'workspace.json'),path.join(f.root,'retained-workspace.json'));
    assert.throws(()=>f.restore());
    if(mode==='changed')assert.equal(fs.readFileSync(path.join(f.destinationDir,'workspace.json'),'utf8'),'new human draft');
    if(mode==='missing')assert.equal(fs.existsSync(path.join(f.destinationDir,'workspace.json')),false);
  }
});

test('partial-copy tampering, replaced root and changed backup stop conservatively',()=>{
  for(const mode of ['partial','root','backup']){
    const f=fixture();assert.throws(()=>f.restore({checkpoint(n){if(n==='restore-chunk:attachments/blob.bin')throw Error('pause copy');}}),/pause copy/);
    if(mode==='partial'){const name=fs.readdirSync(path.join(f.destinationDir,'attachments')).find(n=>n.endsWith('.tmp'));fs.writeFileSync(path.join(f.destinationDir,'attachments',name),'different bytes');}
    if(mode==='root'){moveInsideFixture(f,f.destinationDir,path.join(f.root,'retained-profile'));fs.mkdirSync(f.destinationDir);}
    if(mode==='backup')fs.appendFileSync(path.join(f.backupDir,'source/attachments/blob.bin'),'changed');
    assert.throws(()=>f.restore());assert.equal(fs.existsSync(path.join(f.journal(),'complete.json')),false);
  }
});

test('missing/tampered journals refuse and never adopt pre-existing restored content',()=>{
  for(const mode of ['plan','receipt','root','complete']){
    const f=fixture();f.restore();const journal=f.journal();
    let file=path.join(journal,mode+'.json');if(mode==='receipt')file=path.join(journal,fs.readdirSync(journal).find(n=>n.endsWith('.receipt.json')));
    if(mode==='plan'||mode==='receipt')moveInsideFixture(f,file,path.join(f.root,'retained-'+mode+'.json'));else fs.writeFileSync(file,'{}');
    assert.throws(()=>f.restore());assertExact(f);
  }
});

test('linked backup and destination paths refuse',()=>{
  for(const which of ['backup','destination']){
    const f=fixture(),link=path.join(f.root,'linked'),real=which==='backup'?f.backupDir:path.dirname(f.destinationDir);
    fs.symlinkSync(real,link,process.platform==='win32'?'junction':'dir');
    if(which==='backup')f.options.backupDir=link;else f.options.destinationDir=path.join(link,f.profileId);
    assert.throws(()=>f.restore(),/symbolic link/);assert.equal(fs.existsSync(f.destinationDir),false);
  }
});

test('validator rejects traversing or credential paths even with matching edited manifest hashes',()=>{
  for(const name of ['../escape','documents/../../escape','local-credentials.json','attachments/secret:stream','documents\\escape']){
    const f=fixture(),m=JSON.parse(fs.readFileSync(path.join(f.backupDir,'manifest.json')));m.files[0].path=name;
    m.sourceHash=crypto.createHash('sha256').update(JSON.stringify({profileId:f.profileId,files:m.files})).digest('hex');f.options.expectedSourceHash=m.sourceHash;
    for(const file of ['manifest.json','intent.json'])fs.writeFileSync(path.join(f.backupDir,file),JSON.stringify(m));
    assert.throws(()=>validateBackup(f.options),{code:'backup_path'});assert.equal(fs.existsSync(f.destinationDir),false);
  }
});

test('an active restore lease excludes a second process and recovers only after owner exit',async()=>{
  const f=fixture(),config=path.join(f.root,'options.json'),marker=path.join(f.root,'claimed');fs.writeFileSync(config,JSON.stringify(f.options));
  const code=`const fs=require('fs');const o=JSON.parse(fs.readFileSync(process.env.RESTORE_OPTIONS));require(process.env.RESTORE_MODULE).restoreMigrationBackup(o,{checkpoint:n=>{if(n==='restore-plan'){fs.writeFileSync(process.env.RESTORE_MARKER,'owned');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30000);}}});`;
  const child=spawn(process.execPath,['-e',code],{windowsHide:true,stdio:'ignore',env:{...process.env,RESTORE_OPTIONS:config,RESTORE_MODULE:modulePath,RESTORE_MARKER:marker}});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try {
    for(let i=0;i<200&&!fs.existsSync(marker);i++)await new Promise(r=>setTimeout(r,25));
    assert.ok(fs.existsSync(marker));assert.throws(()=>f.restore(),/already owned/);assert.equal(fs.existsSync(f.destinationDir),false);
  } finally { child.kill();await exited; }
  f.restore();assertExact(f);
});

test('a human change at the final boundary is retained instead of receiving a completion stamp',()=>{
  const f=fixture();assert.throws(()=>f.restore({checkpoint(name){if(name==='restore-before-complete')fs.writeFileSync(path.join(f.destinationDir,'workspace.json'),'new human draft');}}),{code:'restore_changed'});
  assert.equal(fs.readFileSync(path.join(f.destinationDir,'workspace.json'),'utf8'),'new human draft');assert.equal(fs.existsSync(path.join(f.journal(),'complete.json')),false);
});
