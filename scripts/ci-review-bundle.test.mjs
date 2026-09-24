import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { prepare,bundle,verifyBundle } from './ci-review-bundle.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-review-bundle-'));
let count=0;
function fixture() {
  const scope=path.join(root,String(++count)), source=path.join(scope,'source'), out=path.join(scope,'out');
  fs.mkdirSync(source,{recursive:true});
  const write=(name,value)=>{const file=path.join(source,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
  function capture(run,head,base=null) {
    const dir='docs/visual/runs/'+run, frame=dir+'/screen.png',gif=dir+'/motion.gif';
    write(frame,'png '+run);write(gif,'gif '+run);
    const m={commit:head,shots:[{file:gif,frames:[{file:frame}]}],hashes:{[frame]:hash('png '+run),[gif]:hash('gif '+run)}};
    write(dir+'/manifest.json',m);
    write(dir+'/comparison.json',{candidate:dir+'/manifest.json',candidateHash:hash(fs.readFileSync(path.join(source,dir+'/manifest.json'))),baseline:base?'docs/visual/runs/'+base+'/manifest.json':null,entries:[{before:base?'docs/visual/runs/'+base+'/screen.png':null,after:frame,diff:null}]});
    write(dir+'/README.md',`![After](screen.png)\n![Motion](motion.gif)\n${base?'![Before](../'+base+'/screen.png)':''}`);
  }
  capture('baseline','old');capture('unrelated','ancient');
  const a={manifest:'docs/visual/runs/baseline/manifest.json',report:'docs/visual/runs/baseline/comparison.json',reviewer:'Fixture reviewer',note:'Unit fixture only',reviewedAt:'2026-09-24'};
  a.manifestHash=hash(fs.readFileSync(path.join(source,a.manifest)));a.reportHash=hash(fs.readFileSync(path.join(source,a.report)));
  const attestation=JSON.stringify(a,null,2)+'\n',reviewHash=hash(attestation),reviewPath='docs/visual/reviews/approval-'+reviewHash+'.json';
  write(reviewPath,attestation);write('docs/visual/approved.json',{...a,reviewPath,reviewHash});write('docs/visual/pending.json',{run:'baseline'});
  prepare(source,out,'new');
  const fresh=()=>{capture('candidate','new','baseline');write('docs/visual/pending.json',{run:'candidate'});};
  const pack=()=>bundle(source,out,{head:'new',capture:'success',compare:'success'});
  return {source,out,write,fresh,pack};
}
const ok=fixture();ok.fresh();const before=fs.readFileSync(path.join(ok.source,'docs/visual/approved.json'));const result=ok.pack();
assert.equal(result.status,'review-ready');const index=verifyBundle(result.directory);
assert(!index.files.some(f=>f.path.includes('unrelated')));
assert(index.files.some(f=>f.path.includes('reviews/approval-')));
assert.deepEqual(fs.readFileSync(path.join(ok.source,'docs/visual/approved.json')),before);
const extracted=path.join(root,'extracted');fs.cpSync(result.directory,extracted,{recursive:true});verifyBundle(extracted);
fs.appendFileSync(path.join(extracted,'docs/visual/runs/candidate/screen.png'),'bad');assert.throws(()=>verifyBundle(extracted),/hash mismatch/);
assert.throws(()=>ok.pack(),/EEXIST/);
for(const [name,mutate,pattern] of [
 ['stale',()=>{},/fresh candidate/],
 ['tampered-media',f=>{f.fresh();f.write('docs/visual/runs/candidate/screen.png','bad');},/hash mismatch/],
 ['missing-media',f=>{f.fresh();fs.renameSync(path.join(f.source,'docs/visual/runs/candidate/screen.png'),path.join(f.source,'retained-screen.png'));},/ENOENT/],
 ['broken-link',f=>{f.fresh();f.write('docs/visual/runs/candidate/README.md','![Lost](missing.png)');},/Unpackaged review link/],
 ['escape',f=>{f.fresh();const file='docs/visual/runs/candidate/manifest.json';const m=JSON.parse(fs.readFileSync(path.join(f.source,file)));m.shots[0].file='docs/visual/runs/candidate/../../secret.gif';m.hashes[m.shots[0].file]=hash('x');f.write(file,m);},/Unsafe artifact path/],
 ['omitted-frame',f=>{f.fresh();const file='docs/visual/runs/candidate/comparison.json';const r=JSON.parse(fs.readFileSync(path.join(f.source,file)));r.entries=[];f.write(file,r);},/omits frames/],
 ['tampered-attestation',f=>{f.fresh();const a=JSON.parse(fs.readFileSync(path.join(f.source,'docs/visual/approved.json')));f.write(a.reviewPath,'{}');},/hash mismatch/],
 ['symlink',f=>{f.fresh();const outside=path.join(f.out,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'evil.png'),'x');fs.symlinkSync(outside,path.join(f.source,'docs/visual/runs/candidate/junction'),'junction');const file='docs/visual/runs/candidate/manifest.json',m=JSON.parse(fs.readFileSync(path.join(f.source,file)));m.shots[0].file='docs/visual/runs/candidate/junction/evil.png';m.hashes[m.shots[0].file]=hash('x');f.write(file,m);},/Symlink/],
 ['changed-approval',f=>{f.fresh();f.write('docs/visual/approved.json',{});},/Approval changed/],
 ['wrong-head',f=>{f.fresh();const file='docs/visual/runs/candidate/manifest.json';const m=JSON.parse(fs.readFileSync(path.join(f.source,file)));m.commit='another';f.write(file,m);},/another source/],
]) {
 const f=fixture();mutate(f);assert.throws(()=>f.pack(),pattern,name);
 assert.equal(verifyBundle(path.join(f.out,'artifact')).status,'diagnostic-only',name);
}
const failed=fixture();failed.fresh();const diag=bundle(failed.source,failed.out,{head:'new',capture:'failure',compare:'skipped'});
assert.equal(diag.status,'diagnostic-only');assert(!verifyBundle(diag.directory).files.some(f=>f.path.includes('/baseline/')));
console.log('Review bundle: self-contained media/provenance, extraction, hashes, stale capture, escapes, missing media, approval changes, overwrite refusal and diagnostics passed.');
