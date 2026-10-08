import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const out='docs/cycles/evidence/C098/icu-source-15';
if(fs.existsSync(out))throw Error('Existing output preserved');
fs.mkdirSync(out);fs.copyFileSync(fileURLToPath(import.meta.url),out+'/producer.mjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const origin=JSON.parse(fs.readFileSync('docs/third-party/windows-runtime-inputs/postgres-18.4-native-14/provenance.json')).sources.find(r=>r.name==='icu');
if(origin.version!=='77.1'||origin.commit!=='457157a92aa053e632cc7fcfd0e12f8a943b2d11')throw Error('Unexpected immutable ICU source');
const report={version:1,status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),upstream:origin,files:[],limits:['Immutable upstream source/data inspection only; no DLL loaded or build performed','Embedded strings alone do not establish an exact vendor build or close attribution','No payload, notice auditor, dependency or app changes']};
const save=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');save();
try{
 for(const p of ['icu4c/source/tools/toolutil/dbgutil.cpp','icu4c/source/tools/toolutil/dbgutil.h','icu4c/source/tools/toolutil/udbgutil.cpp','icu4c/source/tools/toolutil/udbgutil.h','icu4c/source/tools/toolutil/toolutil.vcxproj','icu4c/source/tools/icuinfo/testplug.c','icu4c/source/tools/icuinfo/testplug.vcxproj','icu4c/source/common/unicode/uvernum.h','icu4c/source/common/unicode/uconfig.h']){
  const url=`https://raw.githubusercontent.com/${origin.repo}/${origin.commit}/${p}`,response=await fetch(url);
  if(!response.ok)throw Error(`Source refused ${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>2000000||bytes.includes(0)||!Buffer.from(bytes.toString('utf8')).equals(bytes))throw Error('Invalid source bytes');
  const file=out+'/upstream/'+p;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});report.files.push({path:'upstream/'+p,url,bytes:bytes.length,sha256:sha(bytes),fetchedAt:new Date().toISOString()});save();
 }
 report.status='passed';report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,files:report.files.length,commit:origin.commit}));
}catch(e){report.status='failed';report.error=e.message;report.finishedAt=new Date().toISOString();save();throw e;}
