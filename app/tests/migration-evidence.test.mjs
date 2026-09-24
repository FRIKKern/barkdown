import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createStore}=require('../main/store'),{createDocuments}=require('../main/documents'),{createAgentEdits}=require('../main/agent-edits');
const {prepareMigration}=require('../main/migration-preflight'),{readRetainedDocument}=require('../main/migration-evidence');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const body=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
async function fixture({undo=false,laterHuman=true}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-retained-evidence-')),profileId=crypto.randomUUID(),sourceDir=path.join(root,profileId);
  const store=createStore(sourceDir),docs=createDocuments(store);docs.loadAll({seed:false});
  const note=docs.create({title:'Original note',markdown:'Original æ 🌲 wording.'});
  docs.save({id:note.id,baseRev:1,content:body('A human second revision.'),actor:'you',summary:'Human revision'});
  const edits=createAgentEdits({store,documents:docs});
  const receipt=await edits.apply({id:note.id,baseRev:2,mode:'append',markdown:'An acknowledged agent addition.',summary:'Agent addition'});
  const proposal=docs.addProposal(note.id,{mode:'replace',baseRev:3,markdown:'An old pending suggestion.',summary:'Keep pending'});
  if(undo)await edits.undo(note.id,receipt.id);
  else if(laterHuman)docs.save({id:note.id,baseRev:3,content:body('A later human revision, after the receipt.'),actor:'you'});
  store.writeJson('workspace.json',{version:1,chats:{},order:[],favorites:[],pages:{roots:[note.id]}});
  store.writeJson('paper-proposals.json',{'original-note':[{id:'cloud-proposal',markdown:'This is separate cloud evidence'}]});
  const cloudReceipt='agent-edits/'+sha('bp:'+note.id)+'.json';store.writeJson(cloudReceipt,{id:'cloud-receipt',documentId:'bp:'+note.id,beforeRev:2,afterRev:3,before:{blocks:[]}});
  const receiptPath='agent-edits/'+sha(note.id)+'.json';let serial=0;
  function prepare(){const backupDir=path.join(root,'backup-'+(++serial));const manifest=prepareMigration({profileId,sourceDir,destinationDir:backupDir,quiesced:true});return {profileId,backupDir,expectedSourceHash:manifest.sourceHash,documentId:note.id};}
  return {root,profileId,sourceDir,store,docs,edits,note,receipt,proposal,receiptPath,prepare,options:prepare()};
}
function bytes(root){const result={};function visit(p){for(const item of fs.readdirSync(p,{withFileTypes:true})){const next=path.join(p,item.name);if(item.isDirectory())visit(next);else result[path.relative(root,next)]=sha(fs.readFileSync(next));}}visit(root);return result;}
function blocked(f,code,options=f.options){const before=bytes(f.root);assert.throws(()=>readRetainedDocument(options),error=>error.code===code);assert.deepEqual(bytes(f.root),before);}

test('production history, pending proposal and stale local receipt remain exact read-only evidence',async()=>{
  const f=await fixture(),before=bytes(f.root),actual=readRetainedDocument(f.options);
  assert.deepEqual(actual,readRetainedDocument(f.options));assert.equal(actual.kind,'retained-legacy-evidence');assert.equal(actual.readOnly,true);assert.equal(actual.revisionDomain,'legacy');assert.deepEqual(actual.actions,[]);
  assert.deepEqual(actual.document,f.store.readJson('documents/'+f.note.id+'.json'));assert.deepEqual(actual.latestAgentEdit,f.store.readJson(f.receiptPath));
  assert.equal(actual.document.rev,4);assert.deepEqual(actual.document.revisions.map(r=>r.rev),[4,3,2,1]);assert.equal(actual.latestAgentEdit.afterRev,3);assert.equal(actual.latestAgentEdit.documentId,f.note.id);assert.equal(actual.document.proposals[0].id,f.proposal.id);
  assert.equal(actual.receiptFile.path,f.receiptPath);assert.equal(Object.hasOwn(actual,'targetRevision'),false);assert.match(actual.evidenceHash,/^[a-f0-9]{64}$/);assert.deepEqual(bytes(f.root),before);
  if(process.env.BARKDOWN_EVIDENCE_OUT){fs.mkdirSync(process.env.BARKDOWN_EVIDENCE_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.BARKDOWN_EVIDENCE_OUT,'production-records.json'),JSON.stringify(actual,null,2)+'\n');}
});
test('a genuinely undone receipt is retained without reopening its action',async()=>{const f=await fixture({undo:true});const value=readRetainedDocument(f.options);assert.equal(value.latestAgentEdit.undone,true);assert.equal(value.document.rev,4);assert.deepEqual(value.document.content,value.latestAgentEdit.before.content);assert.equal(value.document.proposals[0].id,f.proposal.id);assert.deepEqual(value.actions,[]);});
test('the backup remains readable after the live source changes',async()=>{const f=await fixture(),a=readRetainedDocument(f.options);f.docs.save({id:f.note.id,baseRev:4,content:body('New live writing outside the backup')});const before=bytes(f.root);assert.deepEqual(readRetainedDocument(f.options),a);assert.deepEqual(bytes(f.root),before);});
test('same-slug profiles cannot substitute each others captured history',async()=>{const a=await fixture(),b=await fixture();assert.notEqual(readRetainedDocument(a.options).evidenceHash,readRetainedDocument(b.options).evidenceHash);blocked(a,'backup_identity',{...a.options,profileId:b.profileId});});
test('a missing local receipt never substitutes a same-slug Paper receipt',async()=>{const f=await fixture();fs.renameSync(path.join(f.sourceDir,f.receiptPath),path.join(f.root,'retained-receipt'));f.options=f.prepare();const before=bytes(f.root),v=readRetainedDocument(f.options);assert.equal(v.latestAgentEdit,null);assert.equal(v.receiptFile,null);assert.deepEqual(bytes(f.root),before);});
test('unsupported old content and proposal metadata are preserved rather than converted',async()=>{const f=await fixture();const d=f.store.readJson('documents/'+f.note.id+'.json');d.revisions[3].content={type:'doc',content:[{type:'oldWidget',attrs:{mode:'historical-only'},content:[]}]};d.proposals[0].mode='old-plugin-mode';d.proposals[0].custom={literal:'Keep every field'};f.store.writeJson('documents/'+f.note.id+'.json',d);f.options=f.prepare();assert.deepEqual(readRetainedDocument(f.options).document,d);});
for(const id of ['../original-note','bp:original-note','',null,'x'.repeat(129)])test('invalid identity '+String(id).slice(0,24)+' refuses',async()=>{const f=await fixture();blocked(f,'evidence_identity',{...f.options,documentId:id});});
test('a missing captured document refuses instead of finding the current live note',async()=>{const f=await fixture();blocked(f,'evidence_missing',{...f.options,documentId:'absent'});});
test('wrong pinned source hash refuses',async()=>{const f=await fixture();blocked(f,'backup_identity',{...f.options,expectedSourceHash:'0'.repeat(64)});});
test('changed captured document bytes refuse',async()=>{const f=await fixture();fs.appendFileSync(path.join(f.options.backupDir,'source/documents/'+f.note.id+'.json'),' ');blocked(f,'backup_bytes');});
test('unlisted backup bytes refuse even when the requested document is intact',async()=>{const f=await fixture();fs.writeFileSync(path.join(f.options.backupDir,'source/documents/unlisted.json'),'{}');blocked(f,'backup_inventory');});
test('incomplete preparation commitment refuses',async()=>{const f=await fixture();fs.renameSync(path.join(f.options.backupDir,'manifest.json'),path.join(f.root,'retained-manifest'));blocked(f,'backup_commit');});
test('a source-qualified receipt with a different document owner refuses',async()=>{const f=await fixture();const receipt=f.store.readJson(f.receiptPath);receipt.documentId='other';f.store.writeJson(f.receiptPath,receipt);f.options=f.prepare();blocked(f,'evidence_receipt');});
test('a Paper-shaped receipt cannot be reinterpreted as local content',async()=>{const f=await fixture();const receipt=f.store.readJson(f.receiptPath);receipt.before={blocks:[]};f.store.writeJson(f.receiptPath,receipt);f.options=f.prepare();blocked(f,'evidence_receipt');});
test('malformed retained history refuses without replacing it with empty history',async()=>{const f=await fixture();const d=f.store.readJson('documents/'+f.note.id+'.json');d.revisions={old:'unknown'};f.store.writeJson('documents/'+f.note.id+'.json',d);f.options=f.prepare();blocked(f,'evidence_history');});
test('malformed pending proposals refuse without dropping them',async()=>{const f=await fixture();const d=f.store.readJson('documents/'+f.note.id+'.json');d.proposals='unknown';f.store.writeJson('documents/'+f.note.id+'.json',d);f.options=f.prepare();blocked(f,'evidence_proposals');});
test('reading never invokes a write API or network even for an actionable old receipt',async()=>{const f=await fixture({laterHuman:false}),before=bytes(f.root);const methods=['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync','openSync'];const original=Object.fromEntries(methods.map(k=>[k,fs[k]])),fetch=globalThis.fetch;let value;
 try{for(const k of methods)fs[k]=(...args)=>{if(k==='openSync'&&(args[1]==='r'||args[1]===0))return original[k](...args);throw Error('Unexpected mutation '+k);};globalThis.fetch=()=>{throw Error('Unexpected network');};value=readRetainedDocument(f.options);}
 finally{for(const k of methods)fs[k]=original[k];globalThis.fetch=fetch;}
 assert.equal(value.document.rev,value.latestAgentEdit.afterRev);assert.deepEqual(value.actions,[]);assert.deepEqual(bytes(f.root),before);
});

test('a backup changed after the document read is rejected by the final full validation',async()=>{
  const f=await fixture(),sourceBefore=bytes(f.sourceDir),read=fs.readFileSync;let reads=0;
  const note=path.join(f.options.backupDir,'source/documents/'+f.note.id+'.json');
  try {
    fs.readFileSync=(file,...args)=>{const value=read(file,...args);if(typeof file==='string'&&path.resolve(file)===path.resolve(note)&&++reads===2)fs.appendFileSync(path.join(f.options.backupDir,'source/workspace.json'),' ');return value;};
    assert.throws(()=>readRetainedDocument(f.options),e=>e.code==='backup_bytes');
  } finally {fs.readFileSync=read;}
  assert.deepEqual(bytes(f.sourceDir),sourceBefore);
});

test('a blocked migration backup still exposes its unsupported original content without conversion',async()=>{const f=await fixture();const d=f.store.readJson('documents/'+f.note.id+'.json');d.content={type:'doc',content:[{type:'unmigratableWidget',attrs:{literal:'original'}}]};f.store.writeJson('documents/'+f.note.id+'.json',d);f.options=f.prepare();const manifest=JSON.parse(fs.readFileSync(path.join(f.options.backupDir,'manifest.json')));assert.equal(manifest.status,'blocked');assert.deepEqual(readRetainedDocument(f.options).document,d);});
test('optional historical fields are not invented in older captured documents',async()=>{const f=await fixture();const d=f.store.readJson('documents/'+f.note.id+'.json');delete d.revisions;delete d.proposals;f.store.writeJson('documents/'+f.note.id+'.json',d);f.options=f.prepare();assert.deepEqual(readRetainedDocument(f.options).document,d);});
