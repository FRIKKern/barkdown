import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const parent=fs.realpathSync(os.tmpdir()), old='barkdown-shots-runtime-c2Nta2';
const evidence='docs/cycles/evidence/C098/capture-retention-01';
const snapshot=name=>{const dir=path.join(parent,name);return{name,files:fs.readdirSync(dir,{recursive:true}).filter(file=>fs.lstatSync(path.join(dir,file)).isFile()).sort().map(file=>{const bytes=fs.readFileSync(path.join(dir,file));return{file,bytes:bytes.length,sha256:sha(bytes)};})};};
if(process.argv[2]==='before'){
  fs.mkdirSync(evidence,{recursive:true});
  const receipts=fs.readdirSync(parent).filter(name=>name.startsWith('barkdown-shots-runtime-')).sort().map(name=>{const file=path.join(parent,name,'capture-result.json'),stat=fs.existsSync(file)?fs.lstatSync(file):null;return{name,receipt:stat?.isFile()?sha(fs.readFileSync(file)):null,receiptType:stat?(stat.isFile()?'file':'other'):'absent'};});
  fs.writeFileSync(evidence+'/retained-runtimes-before.json',JSON.stringify({at:new Date().toISOString(),receipts,previousRuntime:snapshot(old)},null,2)+'\n');
  console.log('Retained runtime inventory before: '+receipts.length);
}else{
  const before=JSON.parse(fs.readFileSync(evidence+'/retained-runtimes-before.json'));
  for(const r of before.receipts){assert.ok(fs.existsSync(path.join(parent,r.name)),r.name+' remains');if(r.receipt)assert.equal(sha(fs.readFileSync(path.join(parent,r.name,'capture-result.json'))),r.receipt,r.name+' receipt unchanged');}
  assert.deepEqual(snapshot(old),before.previousRuntime);
  fs.writeFileSync(evidence+'/retained-runtimes-after.json',JSON.stringify({at:new Date().toISOString(),status:'passed',priorDirectories:before.receipts.length,previousRuntime:old,unchangedFiles:before.previousRuntime.files.length,unchangedBytes:before.previousRuntime.files.reduce((n,f)=>n+f.bytes,0)},null,2)+'\n');
  console.log('Prior runtime directories/receipts and complete previous capture bytes preserved.');
}
