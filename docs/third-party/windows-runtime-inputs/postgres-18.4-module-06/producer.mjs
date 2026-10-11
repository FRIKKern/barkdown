import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const out='docs/third-party/windows-runtime-inputs/postgres-18.4-module-06',cache='.git/c098-postgres-original-06',commit='f5cc81719e6da4cbdb1f797c48b693e91018153a',url='https://codeload.github.com/postgres/postgres/tar.gz/'+commit;
if(fs.existsSync(out)||fs.existsSync(cache))throw Error('Preserve original output');fs.mkdirSync(out);fs.mkdirSync(cache);fs.copyFileSync(fileURLToPath(import.meta.url),out+'/producer.mjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),report={version:1,status:'running',distributionReady:false,startedAt:new Date().toISOString(),repo:'postgres/postgres',tag:'REL_18_4',commit,url,files:[],modules:[],limits:['Literal source build declarations identify candidates, not binary build reproduction','Unresolved expressions and archive-supplied vendor modules remain explicit','No source file is executed and no native payload is changed']};const save=()=>fs.writeFileSync(out+'/provenance.json',JSON.stringify(report,null,2)+'\n');save();
try{
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Fetch '+response.status);const b=Buffer.from(await response.arrayBuffer());if(b.length>100e6||b.length<1e6)throw Error('Unexpected source size');const archive=cache+'/postgres-'+commit+'.tar.gz';fs.writeFileSync(archive,b,{flag:'wx'});report.archive={privatePath:path.resolve(archive),bytes:b.length,sha256:sha(b)};
 const prefix='postgres-'+commit+'/',listing=execFileSync('C:/Windows/System32/tar.exe',['-tf',archive],{maxBuffer:8e6}).toString('utf8').split(/\r?\n/),files=listing.filter(p=>p.startsWith(prefix)&&(p.endsWith('/Makefile')||p===prefix+'COPYRIGHT'));
 for(const archivePath of files){
  const bytes=execFileSync('C:/Windows/System32/tar.exe',['-xOf',archive,archivePath],{maxBuffer:2e6}),sourcePath=archivePath.slice(prefix.length),target=out+'/'+sourcePath;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});report.files.push({path:sourcePath,bytes:bytes.length,sha256:sha(bytes),archivePath});
  const text=bytes.toString('utf8').replace(/\\\r?\n/g,' ');for(const match of text.matchAll(/^(MODULES|MODULE_big|NAME)\s*(?:=|:=)\s*([^#\r\n]+)/gm)){
   if(match[1]==='NAME'&&!text.includes('Makefile.shlib'))continue;
   const tokens=match[2].trim().split(/\s+/);if(tokens.some(t=>!/^[a-zA-Z0-9_-]+$/.test(t)))continue;
   for(const name of tokens)report.modules.push({name,declaration:match[1],sourcePath,line:text.slice(0,match.index).split('\n').length});
  }
 }
 report.status='incomplete-preparation';report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({sourceFiles:report.files.length,moduleDeclarations:report.modules.length,archiveBytes:b.length}));
}catch(e){report.status='failed';report.error=e.message;report.finishedAt=new Date().toISOString();save();throw e;}
