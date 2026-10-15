const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{createRequire}=require('module');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown',tar=createRequire(root+'/app/package.json')('tar'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=JSON.parse(fs.readFileSync(__dirname+'/C106-publisher-cache-inputs359.json')),m=JSON.parse(fs.readFileSync(__dirname+'/C106-publisher-members-362/result.json')),t=JSON.parse(fs.readFileSync(__dirname+'/C106-package-transform-344/result.json'));
const out=__dirname+'/C106-publisher-joined-364';assert(!fs.existsSync(out));fs.mkdirSync(out);const began=Date.now();
(async()=>{
const manifests=m.records.filter(r=>['manifest-difference','code-difference'].includes(r.state)).map(r=>{
 const p=t.records.find(p=>p.file===r.file);assert(p);const candidates=p.candidates.filter(c=>c.exact&&c.originalSha256===r.publisher.sha256);assert(candidates.length);
 return{file:r.file,publisherMember:r.member,publisherSha256:r.publisher.sha256,packagedSha256:r.packagedSha256,transformerOutputExact:true,originalCandidateRoots:candidates.map(c=>c.root)};
});assert.equal(manifests.length,133);
const pty=input.records.find(p=>p.name==='node-pty');assert.equal(hash(fs.readFileSync(pty.cacheFile)),pty.sha256);
const targets=m.records.filter(r=>r.state==='missing');assert.equal(targets.length,2);
const selected=new Map();const postinstall='package/scripts/post-install.js';
await tar.list({file:pty.cacheFile,strict:true,onReadEntry(e){if(e.path===postinstall||targets.some(t=>e.path==='package/third_party/conpty/1.23.251008001/win10-x64/'+path.basename(t.file))){const chunks=[];e.on('data',b=>chunks.push(b));e.on('end',()=>selected.set(e.path,Buffer.concat(chunks)));}}});
const script=selected.get(postinstall);assert(script);const local=fs.readFileSync(root+'/app/node_modules/node-pty/scripts/post-install.js');assert(script.equals(local));
const relocations=targets.map(r=>{const member='package/third_party/conpty/1.23.251008001/win10-x64/'+path.basename(r.file),bytes=selected.get(member);assert(bytes);assert.equal(hash(bytes),r.packagedSha256);assert.equal(bytes.length,r.packagedBytes);return{file:r.file,publisherMember:member,bytes:bytes.length,sha256:r.packagedSha256,exact:true,reason:'Publisher post-install.js lines69-75 copies these x64 console files into build/Release/conpty. Script is byte-exact to this tar member; it was inspected, not executed.'}});
assert.equal(hash(fs.readFileSync(pty.cacheFile)),pty.sha256);
const result={at:new Date().toISOString(),status:'passed',elapsedMs:Date.now()-began,publisherArchives:133,packageRoots:134,archivedFiles:5887,directPublisherMembers:5752,exactRealHelperManifests:133,exactRelocatedPublisherBinaries:2,allArchivedNpmFilesAccounted:true,rawMeasurement:'../C106-publisher-members-362/result.json',manifests,relocations,postInstall:{member:postinstall,sha256:hash(script),installedByteExact:true,readOnlyInspected:true,executed:false},limits:'Lock-SRI verified cache publisher members and exact known packaging changes only. The two relabeled binaries remain compiled publisher payloads, not corresponding source. No vendor signature, source/build/relinking, notice, CRT or clean installation/A5 clearance.'};
fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');fs.copyFileSync(__filename,out+'/producer.cjs');console.log({status:result.status,elapsedMs:result.elapsedMs,files:5887,direct:5752,manifests:133,relocations:2,allAccounted:true});
})().catch(e=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({error:e.stack},null,2));console.error(e);process.exitCode=1});
