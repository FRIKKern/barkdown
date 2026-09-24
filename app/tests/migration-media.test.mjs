import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const { stageMigration } = require('../main/migration-staging');
const { prepareMigration } = require('../main/migration-preflight');
const modulePath = require.resolve('../main/migration-staging');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-media-migration-'));
  const profileId = crypto.randomUUID(), sourceDir = path.join(root,profileId), destinationDir = path.join(root,'backup');
  fs.mkdirSync(path.join(sourceDir,'documents'),{recursive:true}); fs.mkdirSync(path.join(sourceDir,'attachments'));
  const png = new PNG({width:96,height:64});
  for(let i=0;i<png.data.length;i+=4){png.data[i]=40;png.data[i+1]=130;png.data[i+2]=90;png.data[i+3]=255;}
  const bytes=PNG.sync.write(png);fs.writeFileSync(path.join(sourceDir,'attachments/orchard.png'),bytes);
  const doc={id:'note',rev:2,title:'Owned orchard image',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Preserve this picture.'}]},{type:'image',attrs:{src:'attachments/orchard.png',alt:'Orchard green',title:null,width:192}}]}};
  const save=()=>fs.writeFileSync(path.join(sourceDir,'documents/note.json'),JSON.stringify(doc));save();
  fs.writeFileSync(path.join(sourceDir,'workspace.json'),JSON.stringify({pages:['note'],draft:'Unsent image thought'}));
  const media=new Map(),papers=new Map(),calls=[],state={};
  const asset=(id,filename,data)=>({id,mediaFileId:id,dataset:'production',originalName:filename,mimeType:'image/png',size:data.length,path:'private/'+id+'.png',url:'/media/files/private/'+id+'.png',originalUrl:'/media/files/private/'+id+'.png',absoluteUrl:'https://do-not-follow.invalid/leak'});
  const server=http.createServer(async(req,res)=>{
    try {
      calls.push({method:req.method,url:req.url});
      const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
      assert.equal(req.headers.authorization,'Bearer private-media-fixture');
      const url=new URL(req.url,'http://fixture');
      if(req.method==='GET'&&url.pathname==='/v1/media/production') {
        if(state.list) return send(200,{result:state.list});
        const assets=[...media.values()].filter(v=>v.asset.originalName.includes(url.searchParams.get('q'))).map(v=>v.asset);
        return send(200,{result:{assets,total:assets.length,hasMore:false}});
      }
      if(req.method==='GET'&&url.pathname.startsWith('/v1/media/production/')) {
        const v=media.get(url.pathname.split('/').at(-1));return v?send(200,{result:state.metadata?state.metadata(v.asset):v.asset}):send(404,{error:{code:'not_found'}});
      }
      if(req.method==='GET'&&url.pathname.startsWith('/media/files/')) {
        const v=[...media.values()].find(v=>v.asset.originalUrl===url.pathname);
        if(state.redirect){res.writeHead(302,{location:state.redirect});return res.end();}
        if(!v)return send(404,{error:{code:'not_found'}});
        res.writeHead(200,{'content-type':'image/png'});return res.end(state.bytes||v.bytes);
      }
      if(req.method==='GET') {
        const id=decodeURIComponent(url.pathname.split('/').at(-1));return papers.has(id)?send(200,{result:papers.get(id)}):send(404,{error:{code:'not_found'}});
      }
      const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
      if(url.pathname==='/v1/media/production/upload') {
        const data=await new Request('http://fixture',{method:'POST',headers:{'content-type':req.headers['content-type']},body}).formData();
        const file=data.get('file'),content=Buffer.from(await file.arrayBuffer());
        assert.ok(fs.readdirSync(path.join(options.destinationDir,'media')).some(name=>name.endsWith('.intent.json')&&fs.readFileSync(path.join(options.destinationDir,'media',name),'utf8').includes(file.name)));
        const id=crypto.randomUUID(),value={asset:asset(id,file.name,content),bytes:content};media.set(id,value);
        if(state.afterUpload)state.afterUpload(value);
        if(state.drop){state.drop=false;return res.destroy();}
        return send(201,{result:state.upload?state.upload(value.asset):value.asset});
      }
      const payload=JSON.parse(body),id=payload.slug;
      if(papers.has(id))return send(409,{error:{code:'paper_exists'}});
      papers.set(id,{...payload,_id:id,_type:'paper',rev:1,_rev:'paper-rev-1'});return send(201,{slug:id,rev:1});
    } catch(error){res.writeHead(500);res.end(JSON.stringify({error:{code:'fixture',message:error.message}}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const options={profileId,sourceDir,destinationDir,quiesced:true,metadata:{note:{description:'Reviewed owned orchard picture',tags:[{tag:'orchard',strength:95,rationale:'Test category'}]}}};
  const target={profileId,runtimeId:'media-'+profileId,server:'http://127.0.0.1:'+server.address().port,dataset:'production',token:'private-media-fixture',assertOwned:()=>true};
  const stage=extra=>stageMigration(options,target,extra),uploads=()=>calls.filter(c=>c.method==='POST'&&c.url.includes('/media/')).length;
  return{root,options,target,doc,save,bytes,sourceDir,destinationDir,media,papers,calls,state,stage,uploads};
}

test('owned PNG stages once, exact bytes and dimensions survive, repeated refs share one upload',async t=>{
  const f=await fixture(t);f.doc.content.content.push(structuredClone(f.doc.content.content[1]));f.save();
  const original=fs.readFileSync(path.join(f.sourceDir,'documents/note.json')),workspace=fs.readFileSync(path.join(f.sourceDir,'workspace.json'));
  const result=await f.stage();assert.deepEqual(await f.stage(),result);assert.equal(f.uploads(),1);assert.equal(f.papers.size,1);
  const paper=[...f.papers.values()][0],asset=[...f.media.values()][0].asset;
  assert.deepEqual(paper.blocks[1],{id:'migration-1',type:'image',src:f.target.server+asset.originalUrl,alt:'Orchard green',width:192});
  assert.equal(paper.blocks[2].src,paper.blocks[1].src);assert.equal(result.authority,'legacy');
  assert.deepEqual(fs.readFileSync(path.join(f.sourceDir,'documents/note.json')),original);assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents/note.json')),original);
  assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/attachments/orchard.png')),f.bytes);assert.deepEqual(fs.readFileSync(path.join(f.sourceDir,'workspace.json')),workspace);
  for(const name of fs.readdirSync(path.join(f.destinationDir,'media')))assert.ok(!fs.readFileSync(path.join(f.destinationDir,'media',name),'utf8').includes(f.target.token));
});

test('absolute and file URL references resolve only through captured profile files',async t=>{
  const f=await fixture(t),image=f.doc.content.content[1];image.attrs.src=path.join(f.sourceDir,'attachments/orchard.png');f.save();assert.equal(prepareMigration(f.options).status,'prepared');
  f.options.destinationDir=path.join(f.root,'second-backup');image.attrs.src=pathToFileURL(image.attrs.src).href;f.save();await f.stage();assert.equal(f.uploads(),1);
});

test('bad sources and unsupported image metadata refuse before all target access',async t=>{
  for(const attrs of [{src:'https://example.invalid/image.png'},{src:'attachments/missing.png'},{src:'attachments/../attachments/orchard.png'},{src:'file:///another-profile/attachments/orchard.png'},{title:'Unmapped caption'},{width:'192'},{height:0},{alt:{text:'not string'}}]){
    const f=await fixture(t);Object.assign(f.doc.content.content[1].attrs,attrs);f.save();await assert.rejects(f.stage(),{code:'preflight_blocked'});assert.equal(f.calls.length,0);
  }
});

test('corrupt PNG bytes and nested images refuse before target access',async t=>{
  const f=await fixture(t);const bad=Buffer.from(f.bytes);bad[bad.length-2]^=1;fs.writeFileSync(path.join(f.sourceDir,'attachments/orchard.png'),bad);
  await assert.rejects(f.stage(),{code:'preflight_blocked'});assert.equal(f.calls.length,0);
  const g=await fixture(t);g.doc.content.content=[{type:'blockquote',content:[g.doc.content.content[1]]}];g.save();await assert.rejects(g.stage(),{code:'preflight_blocked'});assert.equal(g.calls.length,0);
});

test('post-commit lost response reconciles exact attempt without another upload',async t=>{
  const f=await fixture(t);f.state.drop=true;await assert.rejects(f.stage(),{code:'media_uncertain'});assert.equal(f.media.size,1);assert.equal(f.papers.size,0);
  await f.stage();await f.stage();assert.equal(f.uploads(),1);assert.equal(f.papers.size,1);
});

for(const boundary of ['media-plan','media-intent:attachments/orchard.png','media-response:attachments/orchard.png','media-receipt:attachments/orchard.png'])test('actual process exit at '+boundary,async t=>{
  const f=await fixture(t),config=path.join(f.root,'child.json');fs.writeFileSync(config,JSON.stringify({options:f.options,target:{...f.target,token:undefined}}));
  const code=`const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.MEDIA_CONFIG));c.target.token=process.env.MEDIA_TOKEN;c.target.assertOwned=()=>true;require(process.env.MEDIA_MODULE).stageMigration(c.options,c.target,{checkpoint:n=>{if(n===process.env.MEDIA_BOUNDARY)process.exit(77)}}).catch(e=>{console.error(e);process.exit(1)});`;
  const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',code],{windowsHide:true,env:{...process.env,MEDIA_CONFIG:config,MEDIA_TOKEN:f.target.token,MEDIA_MODULE:modulePath,MEDIA_BOUNDARY:boundary},stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',d=>error+=d);child.on('error',reject);child.on('exit',status=>resolve({status,error}));});
  assert.equal(exit.status,77,exit.error);
  if(boundary.startsWith('media-intent')){await assert.rejects(f.stage(),{code:'media_uncertain'});assert.equal(f.uploads(),0);}
  else{await f.stage();await f.stage();assert.equal(f.uploads(),1);assert.equal(f.papers.size,1);}
});

test('absent, ambiguous and incomplete upload lookup never retries',async t=>{
  for(const mode of ['absent','ambiguous','incomplete']){
    const f=await fixture(t);f.state.drop=true;await assert.rejects(f.stage());
    if(mode==='absent')f.media.clear();
    if(mode==='ambiguous'){const old=[...f.media.values()][0],id=crypto.randomUUID();f.media.set(id,{...old,asset:{...old.asset,id,mediaFileId:id}});}
    if(mode==='incomplete')f.state.list={assets:[],total:51,hasMore:true};
    await assert.rejects(f.stage());assert.equal(f.uploads(),1);assert.equal(f.papers.size,0);
  }
});

test('changed or redirected binary and wrong identity refuse before Paper write',async t=>{
  for(const mode of ['bytes','metadata','redirect','receipt']){
    const f=await fixture(t);
    if(mode==='bytes')f.state.bytes=Buffer.from('wrong');
    if(mode==='metadata')f.state.metadata=a=>({...a,dataset:'foreign'});
    if(mode==='redirect')f.state.redirect='http://127.0.0.1:1/never-follow';
    if(mode==='receipt')f.state.upload=a=>({...a,url:'https://example.invalid/leak',originalUrl:'https://example.invalid/leak'});
    await assert.rejects(f.stage());assert.equal(f.uploads(),1);assert.equal(f.papers.size,0);
  }
});

test('local journal tampering refuses before any further target access',async t=>{
  const f=await fixture(t);await f.stage();
  for(const file of ['staging/plan.json','media/plan.json',...fs.readdirSync(path.join(f.destinationDir,'media')).filter(n=>n.endsWith('.receipt.json')).map(n=>'media/'+n)]){
    const name=path.join(f.destinationDir,file),original=fs.readFileSync(name),before=f.calls.length;fs.writeFileSync(name,'{}');await assert.rejects(f.stage());assert.equal(f.calls.length,before,file);fs.writeFileSync(name,original);
  }
});

test('later missing/changed uploaded bytes or changed source never recreate or overwrite',async t=>{
  const f=await fixture(t);await f.stage();const original=[...f.media.values()][0];f.state.bytes=Buffer.from('changed');await assert.rejects(f.stage(),{code:'media_bytes'});delete f.state.bytes;
  f.media.clear();await assert.rejects(f.stage(),{code:'media_uncertain'});f.media.set(original.asset.id,original);
  fs.writeFileSync(path.join(f.sourceDir,'attachments/orchard.png'),Buffer.from('changed source'));const count=f.calls.length;await assert.rejects(f.stage(),/Source or preparation contract changed/);assert.equal(f.calls.length,count);assert.equal(f.uploads(),1);assert.equal(f.papers.size,1);
});

test('media changed after Paper creation prevents completion without replay or cleanup',async t=>{
  for (const mode of ['missing','bytes','identity']) {
    const f=await fixture(t);
    await assert.rejects(f.stage({checkpoint(name){
      if(name!=='before-complete')return;
      if(mode==='missing')f.media.clear();
      if(mode==='bytes')f.state.bytes=Buffer.from('changed after paper creation');
      if(mode==='identity')f.state.metadata=a=>({...a,id:crypto.randomUUID()});
    }}));
    assert.equal(f.uploads(),1);assert.equal(f.papers.size,1);
    assert.equal(fs.existsSync(path.join(f.destinationDir,'staging/complete.json')),false);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/attachments/orchard.png')),f.bytes);
  }
});

test('two-file partial upload resumes only the interrupted attempt and preserves both identities',async t=>{
  const f=await fixture(t);
  fs.writeFileSync(path.join(f.sourceDir,'attachments/second.png'),f.bytes);
  f.doc.content.content.push({type:'image',attrs:{src:'attachments/second.png',alt:'Second owned file'}});f.save();
  await assert.rejects(f.stage({checkpoint(name){if(name==='media-response:attachments/second.png')throw Error('interrupted second upload');}}),/interrupted second/);
  assert.equal(f.uploads(),2);assert.equal(f.papers.size,0);
  await f.stage();await f.stage();assert.equal(f.uploads(),2);assert.equal(f.media.size,2);
  const images=[...f.papers.values()][0].blocks.filter(b=>b.type==='image');assert.equal(images.length,2);assert.notEqual(images[0].src,images[1].src);
});
