const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{createRequire}=require('module'),{execFileSync}=require('child_process');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown',req=createRequire(root+'/app/package.json'),tar=req('tar');
const inputs=JSON.parse(fs.readFileSync(__dirname+'/C106-publisher-cache-inputs359.json'));
const source=JSON.parse(fs.readFileSync(__dirname+'/C106-package-source-338/result.json'));
const proof=JSON.parse(fs.readFileSync(__dirname+'/C106-package-transform-344/result.json'));
const out=__dirname+'/C106-publisher-members-362';assert(!fs.existsSync(out));fs.mkdirSync(out);
const hash=(b,a='sha256')=>crypto.createHash(a).update(b).digest('hex');
const lock=fs.readFileSync(root+'/app/package-lock.json'),started=Date.now();
const entry={at:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),goal:'Read-only comparison of the 5887 carried npm files to members of 133 exact SRI-verified publisher cache archives, preserving missing or modified code rather than clearing distribution.',budget:'One bounded cached-input pass and classification, 20 minute ceiling; no downloads, extraction, source/cache changes or native execution. Publication only after current PR79 CI settles.',lockSha256:hash(lock),archiveSha256:hash(fs.readFileSync(source.entry.archive)),parser:{name:'tar',version:req('tar/package.json').version}};
assert.equal(entry.lockSha256,source.entry.lockSha256);assert.equal(entry.archiveSha256,source.entry.archiveSha256);
fs.writeFileSync(out+'/entry.json',JSON.stringify(entry,null,2)+'\n');fs.copyFileSync(__filename,out+'/producer.cjs');
const records=[],packages=[],links=[];
(async()=>{
 for(const input of inputs.records){
  assert.equal(input.state,'integrity-verified');const bytes=fs.readFileSync(input.cacheFile);assert.equal(hash(bytes),input.sha256);assert.equal(bytes.length,input.bytes);
  const sri=input.integrity.split(/\s+/).find(s=>s.startsWith(input.algorithm+'-'));assert.equal(crypto.createHash(input.algorithm).update(bytes).digest('base64'),sri.slice(input.algorithm.length+1));
  const members=new Map();let total=0;
  await tar.list({file:input.cacheFile,strict:true,onReadEntry(e){
   const name=e.path.replace(/\/$/,'');assert(!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').some(x=>x==='..'||x==='.'||x===''),'Unsafe tar path');
   if(e.type==='Directory')return;
   assert(!members.has(name),'Duplicate tar member '+name);
   if(e.type!=='File'&&e.type!=='OldFile'){links.push({name:input.name,path:name,type:e.type,target:e.linkpath});members.set(name,{type:e.type});return;}
   const digest=crypto.createHash('sha256');let count=0;members.set(name,{type:e.type,bytes:e.size});
   e.on('data',chunk=>{count+=chunk.length;total+=chunk.length;assert(total<1024*1024*1024,'Uncompressed archive exceeds bounded budget');digest.update(chunk)});
   e.on('end',()=>{assert.equal(count,e.size);members.set(name,{type:e.type,bytes:count,sha256:digest.digest('hex')})});
  }});
  for(const pkgRoot of input.archivedRoots){
   const owner=source.owners.find(p=>p.root===pkgRoot),files=source.records.filter(f=>f.packageRoot===pkgRoot);
   const candidateRoots=proof.packages.find(p=>p.root===pkgRoot).consistentCandidates;
   const matchedCandidates=owner.candidates.filter(c=>candidateRoots.includes(c.root)&&c.resolved===input.resolved&&c.integrity===input.integrity);assert(matchedCandidates.length);
   const candidates=[];
   for(const c of matchedCandidates){
    const installed=JSON.parse(fs.readFileSync(path.join(root,'app',c.root,'package.json')));assert.equal(installed.name,input.name);assert.equal(installed.version,input.version);
    candidates.push(c.root);
   }
   let direct=0,manifest=0,missing=0,different=0;
   for(const f of files){
    const suffix=f.file.slice(pkgRoot.length+1),memberName='package/'+suffix,m=members.get(memberName);
    const state=!m?'missing':!m.sha256?'non-file':m.sha256===f.sha256?'direct':suffix==='package.json'?'manifest-difference':'code-difference';
    if(state==='direct')direct++;else if(state==='manifest-difference')manifest++;else if(state==='missing')missing++;else different++;
    records.push({file:f.file,name:input.name,version:input.version,publisherArchiveSha256:input.sha256,member:memberName,state,packagedBytes:f.bytes,packagedSha256:f.sha256,...(m?{publisher:m}:{})});
   }
   packages.push({root:pkgRoot,name:input.name,version:input.version,resolved:input.resolved,integrity:input.integrity,publisherSha256:input.sha256,candidates,memberCount:members.size,uncompressedBytes:total,files:files.length,direct,manifest,missing,different});
  }
  assert.equal(hash(fs.readFileSync(input.cacheFile)),input.sha256);
 }
 assert.equal(hash(fs.readFileSync(root+'/app/package-lock.json')),entry.lockSha256);assert.equal(hash(fs.readFileSync(source.entry.archive)),entry.archiveSha256);
 assert.equal(records.length,5887);assert.equal(packages.length,134);
 const counts={};for(const r of records)counts[r.state]=(counts[r.state]||0)+1;
 const result={at:new Date().toISOString(),status:'measured',elapsedMs:Date.now()-started,entry,publisherArchives:inputs.uniqueInputs,packageRoots:packages.length,files:records.length,counts,links,originalInputsUnchanged:true,packages,records,limits:'Exact locked publisher-cache archive/member correspondence only, not a vendor signature, full build/corresponding-source, original-notice applicability, CRT, clean installation or A5 acceptance. No download/extraction/archive execution/source/cache changes.'};
 fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log({status:result.status,elapsedMs:result.elapsedMs,archives:result.publisherArchives,roots:packages.length,files:records.length,counts,links:links.length});
})().catch(e=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({at:new Date().toISOString(),error:e.stack,elapsedMs:Date.now()-started},null,2));console.error(e);process.exitCode=1});
