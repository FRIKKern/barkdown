const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { createProfilePortable } = require('../app/main/profile-portable');
const { createProfileRegistry } = require('../app/main/profile-registry');
const { verifyExport } = require('../app/main/profile-export');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const out = path.join(__dirname, 'import-count-review');
fs.mkdirSync(out);
const started = Date.now();
const cases = [
  ['valid-legacy-no-drafts', {papers:3}, true, 3],
  ['valid-with-drafts', {papers:3,drafts:2}, true, 5],
  ['missing-counts', undefined, false],
  ['negative-papers', {papers:-3,drafts:2}, false],
  ['string-papers', {papers:'3',drafts:2}, false],
  ['fractional-drafts', {papers:3,drafts:0.5}, false],
  ['string-drafts', {papers:3,drafts:'2'}, false],
  ['unsafe-sum', {papers:Number.MAX_SAFE_INTEGER,drafts:1}, false]
];
(async()=>{
 const results=[];
 for(const [name,counts,valid,expected] of cases){
  const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'bd-import-count-review-')));
  const folder=path.join(temp,'export');fs.mkdirSync(folder);fs.mkdirSync(path.join(folder,'media'));
  const dump=Buffer.from('disposable synthetic database dump');fs.writeFileSync(path.join(folder,'database.dump'),dump);
  const manifest={version:1,kind:'barkdown-profile-export',profile:{id:'11111111-1111-4111-8111-111111111111',name:'Fixture'},upstream:'pin',exportedAt:'2026-10-07T00:00:00.000Z',counts,database:{path:'database.dump',bytes:dump.length,sha256:sha(dump),format:'pg_dump custom'},media:[],store:[]};
  const bytes=JSON.stringify(manifest,null,2);fs.writeFileSync(path.join(folder,'manifest.json'),bytes);
  const registry=createProfileRegistry(path.join(temp,'registry'));const original=registry.createProfile({name:'Existing'});
  const before=registry.load().profiles.map(p=>p.id);let restores=0,verified=false,result=null,error=null;
  const portable=createProfilePortable({registry,preparation:{},runtimePool:{restore:async id=>{restores++;return{profileId:id,storeDir:registry.storeFor(id).storeDir,connection:{server:'http://127.0.0.1:4999',token:'synthetic',dataset:'production',viaCli:false}};}},sourceFor:()=>'/fixture',upstreamRef:()=> 'pin',chooseFolder:async()=>folder});
  try{verifyExport(folder);verified=true;}catch(e){}
  try{result=await portable.importFrom(original.id,folder);}catch(e){error={code:e.code||null,message:e.message};}
  const created=registry.load().profiles.filter(p=>!before.includes(p.id));
  const phases=created.map(p=>JSON.parse(fs.readFileSync(path.join(registry.storeFor(p.id).storeDir,'profile-import.json'),'utf8')).phase);
  const archiveUnchanged=fs.readFileSync(path.join(folder,'manifest.json'),'utf8')===bytes&&sha(fs.readFileSync(path.join(folder,'database.dump')))===sha(dump);
  const passed=valid ? result?.papers===expected&&restores===1&&created.length===1&&archiveUnchanged : !result&&!!error&&restores===0&&created.length===0&&archiveUnchanged;
  results.push({name,valid,expected,passed,verified,result,error,restores,created:created.length,phases,incomplete:created.map(p=>portable.isIncomplete(p.id)),archiveUnchanged,temp});
 }
 const report={source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),at:new Date().toISOString(),elapsedMs:Date.now()-started,scope:'Actual verifier/import facade/registry; stubbed restore and synthetic dump only. No database loss or actual runtime restoration proved.',hashes:Object.fromEntries(['app/main/profile-export.js','app/main/profile-import.js','app/main/profile-portable.js','app/main/profile-import-content.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),results};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({elapsedMs:report.elapsedMs,results:results.map(({name,passed,verified,error,result,restores,created,phases,incomplete})=>({name,passed,verified,error,papers:result?.papers,restores,created,phases,incomplete}))},null,2));
 process.exitCode=results.every(r=>r.passed)?0:1;
})().catch(e=>{console.error(e);process.exitCode=2;});
