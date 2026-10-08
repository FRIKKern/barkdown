import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { bindWinpthreadsPublisher } from './winpthreads-publisher.mjs';
const pin=JSON.parse(fs.readFileSync(new URL('./windows-winpthreads-pin.json',import.meta.url)));
const payload=[pin.native],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const originals=new URL('../docs/cycles/evidence/C098/winpthreads-association-03/original/',import.meta.url);
const keep=(file,meta)=>{
  const bytes=fs.readFileSync(new URL(file.archivePath,originals));
  assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);
  assert.equal(meta.sourceRevision,null);assert.equal(meta.source,pin.url);
  return 'licenses/'+meta.kind+'/'+file.path;
};
assert.deepEqual(bindWinpthreadsPublisher(undefined,payload,keep),[]);
const bound=bindWinpthreadsPublisher([structuredClone(pin)],payload,keep);
assert.equal(bound.length,1);assert.equal(bound[0].sourceRevision,null);assert.equal(bound[0].texts.length,9);assert.equal(bound[0].members.length,3);
bound[0].archive.sha256='0'.repeat(64);bound[0].native.bytes++;bound[0].members[0].path='mutated-report';
assert.equal(bindWinpthreadsPublisher([pin],payload,keep)[0].archive.sha256,pin.archive.sha256);
bindWinpthreadsPublisher([pin],payload,file=>{file.sha256='0'.repeat(64);return file.path;});
assert.equal(bindWinpthreadsPublisher([pin],payload,keep)[0].texts.length,9);
let refusals=0;
const refuse=value=>{let writes=0;assert.throws(()=>bindWinpthreadsPublisher(value,payload,()=>{writes++;}),/Unsupported\/changed/);assert.equal(writes,0);refusals++;};
for(const value of [null,false,{},[],[pin,pin],[null],[[]]])refuse(value);
const changes=[p=>p.archive.sha256='f'.repeat(64),p=>p.archive.bytes++,p=>p.artifact=p.artifact.replace('rev1','rev0'),p=>p.url=p.url.replace('https:','http:'),p=>p.component='postgresql',p=>p.version='5.0.0',p=>p.sourceRevision='a'.repeat(40),p=>delete p.sourceRevision,p=>p.native.path='bin/another.dll',p=>p.native.sha256='a'.repeat(64),p=>p.members.pop(),p=>p.members.push(p.members[0]),p=>p.members[0].path='mingw64/lib32/libwinpthread-1.dll',p=>p.members[0].sha256='b'.repeat(64),p=>p.files.pop(),p=>p.files[1]=p.files[0],p=>p.files[0].path='../escape',p=>p.files[0].path+=':stream',p=>p.files[0].archivePath='mingw64/other.txt',p=>p.files[0].sha256='c'.repeat(64),p=>p.files[0].bytes++,p=>p.files[0].url='https://example.invalid/forged',p=>p.files=null];
for(const change of changes){const altered=structuredClone(pin);change(altered);refuse([altered]);}
for(const value of [[],[{...pin.native,bytes:pin.native.bytes+1}],[{...pin.native,sha256:'d'.repeat(64)}],[{...pin.native,path:pin.native.path.toUpperCase()}]]){let writes=0;assert.throws(()=>bindWinpthreadsPublisher([pin],value,()=>{writes++;}),/native bytes differ/);assert.equal(writes,0);refusals++;}
console.log('Winpthreads publisher: exact original texts/member/native/archive pins, null source revision, old input compatibility and '+refusals+' malformed/tampered/forged-closure refusals passed.');
