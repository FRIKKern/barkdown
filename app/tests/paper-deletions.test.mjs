import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createPaperDeletions } = require('../main/paper-deletions');

function fixture() {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-deletions-')));
  const id = 'drafts.ordinary', revision = 'first-opaque', profileId = crypto.randomUUID(), paperOwner = 'a'.repeat(64);
  const snapshot = { _id:id, _type:'paper', _draft:true, _publishedId:'ordinary', _rev:revision, rev:2,
    title:'Original', style:'article', description:'Keep metadata', blocks:[
      {id:'title', type:'heading', role:'title', locked:true, level:1, text:'Original'},
      {id:'body', type:'paragraph', content:[{type:'text',value:'Marked text',bold:true}]},
      {id:'image',type:'image',src:'/v1/media/owned-image',alt:'Retain the media reference'},
    ] };
  const rows = new Map([[id,structuredClone(snapshot)],['ordinary',{_id:'ordinary',title:'Published twin'}]]);
  const posts = [], history = []; let dropDelete=false, dropCopy=false, offline=false, historyAvailable=true, owned=true, refusal=null, race=false, malformed=false;
  const options = {store,profileId,paperOwner,config:{enabled:true,writes:true,server:'http://fixture',dataset:'test'},assertOwned:()=>{if(!owned)throw Error('Owner lost');},
    request:async (_config,method,route,body)=>{
      if(offline)throw Error('Offline');
      if(method==='POST') {
        posts.push(structuredClone(body));
        const op=body.mutations[0];
        if(op.deleteExactDraft) {
          if(refusal)throw Object.assign(Error('Server refused'),{status:refusal});
          if(race)rows.get(id)._rev='newer-human';
          if(rows.get(id)?._rev!==op.deleteExactDraft.ifRevisionID)throw Object.assign(Error('Stale'),{status:412});
          const d=rows.get(id);rows.delete(id);
          history.push({id:'history-id',action:'delete',status:'draft',rev:d._rev,type:'paper',dataset:'test',doc_id:'ordinary',title:d.title,content:{blocks:d.blocks}});
          if(dropDelete)throw Error('Lost committed deletion reply');
          return {results:[{id:malformed?'ordinary':id,operation:'deleteExactDraft',document:d}]};
        }
        const d=op.create, copyId='drafts.'+d._id;
        assert(!rows.has(copyId),'Creation must not replay');
        rows.set(copyId,{...d,_id:copyId,_draft:true,_publishedId:d._id,_rev:'copy-opaque',rev:0});
        if(dropCopy)throw Error('Lost committed creation reply');
        return {results:[{document:rows.get(copyId)}]};
      }
      if(route.includes('/history/'))return {revisions:historyAvailable?history:[]};
      if(route.includes('/revision/'))return {revision:history[0]};
      const rowId=decodeURIComponent(route.split('?')[0].split('/').at(-1));
      if(!rows.has(rowId))throw Object.assign(Error('Missing'),{status:404});
      return {result:structuredClone(rows.get(rowId))};
    }};
  return {store,id,revision,snapshot,rows,posts,options,service:()=>createPaperDeletions(options),
    dropDelete:()=>{dropDelete=true;},dropCopy:()=>{dropCopy=true;},offline:x=>{offline=x;},historyAvailable:x=>{historyAvailable=x;},loseOwner:()=>{owned=false;},refuse:x=>{refusal=x;},race:()=>{race=true;},malformed:()=>{malformed=true;}};
}

test('an unwritable snapshot destination prevents dispatch',async()=>{
  const f=fixture();fs.writeFileSync(f.store.filePath('paper-deletions'),'Retained unrelated file');
  await assert.rejects(f.service().remove(f.id,f.revision));
  assert.equal(f.posts.length,0);assert.deepEqual(f.rows.get(f.id),f.snapshot);
});

test('separate service instances cannot overlap one deletion intent',async()=>{
  const f=fixture(),request=f.options.request;let release,started;
  const gate=new Promise(r=>{release=r;}),entered=new Promise(r=>{started=r;});
  f.options.request=async(...args)=>{if(args[1]==='POST'){started();await gate;}return request(...args);};
  const first=f.service().remove(f.id,f.revision);await entered;
  await assert.rejects(f.service().remove(f.id,f.revision),/already running/);
  release();await first;assert.equal(f.posts.length,1);
});

test('exact deletion retains snapshot before dispatch, preserves twin and reconstructs without replay',async()=>{
  const f=fixture(), published=structuredClone(f.rows.get('ordinary'));
  const request=f.options.request;
  f.options.request=async(...args)=>{if(args[1]==='POST'){const files=f.store.list('paper-deletions','.json');assert.equal(files.length,1);const r=f.store.readJson(files[0]);assert.equal(r.status,'sent');assert.deepEqual(r.snapshot,f.snapshot);}return request(...args);};
  const receipt=await f.service().remove(f.id,f.revision);
  assert.equal(receipt.status,'deleted');assert(!f.rows.has(f.id));assert.deepEqual(f.rows.get('ordinary'),published);
  assert.deepEqual(await f.service().remove(f.id,f.revision),receipt);assert.equal(f.posts.length,1);assert.deepEqual(f.service().list(),[receipt]);
});
test('newer human revision before read or during dispatch prevents deletion',async()=>{
  for(const race of [false,true]){const f=fixture();if(race)f.race();else f.rows.get(f.id)._rev='newer-human';await assert.rejects(f.service().remove(f.id,f.revision),/changed|refused/);assert.equal(f.rows.get(f.id)._rev,'newer-human');assert.equal(f.posts.length,race?1:0);assert.equal(f.service().list().length,0);}
});
test('lost delete reply reconciles exact retained history; never deletes a later recreated row',async()=>{
  const f=fixture();f.dropDelete();const r=await f.service().remove(f.id,f.revision);assert.equal(r.status,'deleted');
  const newer={...f.snapshot,_rev:'recreated',title:'New human work'};f.rows.set(f.id,newer);
  assert.equal((await f.service().remove(f.id,f.revision)).status,'deleted');assert.deepEqual(f.rows.get(f.id),newer);assert.equal(f.posts.length,1);
});
test('absence without matching history stays uncertain and retries are reads only',async()=>{
  const f=fixture();f.dropDelete();f.historyAvailable(false);const r=await f.service().remove(f.id,f.revision);assert.equal(r.status,'sent');
  await f.service().reconcile(r.key);await f.service().remove(f.id,f.revision);assert.equal(f.posts.length,1);
  f.historyAvailable(true);assert.equal((await f.service().reconcile(r.key)).status,'deleted');
});
test('copy recovery retains native blocks and metadata; lost reply/restart returns later human copy unchanged',async()=>{
  const f=fixture(), d=await f.service().remove(f.id,f.revision);f.dropCopy();const copy=await f.service().recover(d.key);
  assert.notEqual(copy.id,f.id);assert.deepEqual(copy.blocks,f.snapshot.blocks);assert.equal(copy.raw.style,'article');assert.equal(copy.description,f.snapshot.description);
  f.rows.get(copy.id).title='Later human copy';f.rows.get(copy.id)._rev='later';f.rows.set(f.id,{...f.snapshot,_rev:'original-newer'});
  const replay=await f.service().recover(d.key);assert.equal(replay.id,copy.id);assert.equal(replay.title,'Later human copy');assert.equal(f.rows.get(f.id)._rev,'original-newer');assert.equal(f.posts.length,2);
  assert.equal(f.service().list()[0].copyId,copy.id);
});
test('offline recovery retains intent and missing copy readback never issues a second POST',async()=>{
  const f=fixture(), d=await f.service().remove(f.id,f.revision);f.offline(true);await assert.rejects(f.service().recover(d.key));f.offline(false);
  await assert.rejects(f.service().recover(d.key),/Missing/);assert.equal(f.posts.length,1);assert.equal(f.service().list()[0].status,'deleted');
});
test('same IDs in separate profiles do not share deletion or recovery records',async()=>{
  const a=fixture(),b=fixture();const d=await a.service().remove(a.id,a.revision);
  assert.equal(b.service().list().length,0);await assert.rejects(b.service().recover(d.key),/record/);assert(b.rows.has(b.id));
  const foreign=createPaperDeletions({...a.options,profileId:b.options.profileId});assert.throws(()=>foreign.list(),/another library/);
});
test('disabled writes and owner loss refuse before mutation',async()=>{
  const f=fixture();await assert.rejects(createPaperDeletions({...f.options,config:{...f.options.config,writes:false}}).remove(f.id,f.revision),/Enable/);
  f.loseOwner();await assert.rejects(f.service().remove(f.id,f.revision),/Owner lost/);assert.equal(f.posts.length,0);
});
test('corrupt retained snapshot is not overwritten or recovered',async()=>{
  const f=fixture(),d=await f.service().remove(f.id,f.revision),name=f.store.list('paper-deletions','.json')[0],r=f.store.readJson(name);r.snapshot.title='Tampered';f.store.writeJson(name,r);
  await assert.rejects(f.service().recover(d.key),/unreadable/);assert.throws(()=>f.service().list(),/unreadable/);assert.equal(f.posts.length,1);
});
test('server refusal stays terminal for the same intent and old servers fail closed',async()=>{
  for(const status of [400,401,403,404,409,412,422]){const f=fixture();f.refuse(status);await assert.rejects(f.service().remove(f.id,f.revision),/refused/);await assert.rejects(f.service().remove(f.id,f.revision),/already refused/);assert.equal(f.posts.length,1);assert(f.rows.has(f.id));}
});
test('a wrong-row acknowledgement requires independent exact evidence',async()=>{
  const f=fixture();f.malformed();f.historyAvailable(false);assert.equal((await f.service().remove(f.id,f.revision)).status,'sent');assert.equal(f.posts.length,1);
});
