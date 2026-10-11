import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const output='docs/third-party/windows-runtime-inputs/postgres-18.4-native-04',runtime='runtime/barkpark-944a57a1-win32-x64-release-05/postgres';
if(fs.existsSync(output))throw Error('Preserve existing output');fs.mkdirSync(output);fs.copyFileSync(fileURLToPath(import.meta.url),output+'/producer.mjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),report={version:1,status:'running',distributionReady:false,startedAt:new Date().toISOString(),runtime,pathVersionEvidence:'versions.json',sources:[],failures:[],limits:['Resource version selects upstream source release; it does not prove vendor build flags or modifications','All native payload bytes and supplied notices remain unchanged','Source obligations, embedded/static components and unknown native versions require further review']};
const save=()=>fs.writeFileSync(output+'/provenance.json',JSON.stringify(report,null,2)+'\n');save();
const inputs=[
 {name:'icu',version:'77.1',repo:'unicode-org/icu',tag:'release-77-1',paths:['LICENSE']},
 {name:'wxwidgets',version:'3.2.10',repo:'wxWidgets/wxWidgets',tag:'v3.2.10',paths:['docs/licence.txt','docs/lgpl.txt','docs/gpl.txt','docs/licendoc.txt','docs/preamble.txt']},
 {name:'openssl',version:'3.5.6',repo:'openssl/openssl',tag:'openssl-3.5.6',paths:['LICENSE.txt','AUTHORS.md']},
 {name:'curl',version:'8.20.0',repo:'curl/curl',tag:'curl-8_20_0',paths:['COPYING']},
 {name:'lz4',version:'1.10.0',repo:'lz4/lz4',tag:'v1.10.0',paths:['LICENSE','lib/LICENSE']},
 {name:'libxml2',version:'2.15.3',repo:'GNOME/libxml2',tag:'v2.15.3',paths:['Copyright']},
 {name:'zstd',version:'1.5.7',repo:'facebook/zstd',tag:'v1.5.7',paths:['LICENSE','COPYING']},
 {name:'zlib',version:'1.3.2',repo:'madler/zlib',tag:'v1.3.2',paths:['LICENSE']},
 {name:'postgresql',version:'18.4',repo:'postgres/postgres',tag:'REL_18_4',paths:['COPYRIGHT']}
];
try{
 const script="$base = [System.IO.Path]::GetFullPath('runtime/barkpark-944a57a1-win32-x64-release-05/postgres/bin'); Get-ChildItem -LiteralPath $base -Filter '*.dll' | Sort-Object Name | ForEach-Object { $v = $_.VersionInfo; [pscustomobject]@{ file=$_.Name; fileVersion=$v.FileVersion; productVersion=$v.ProductVersion; productName=$v.ProductName; copyright=$v.LegalCopyright } } | ConvertTo-Json -Depth 5";
 const b=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); '+script],{maxBuffer:2e6,windowsHide:true});fs.writeFileSync(output+'/versions.json',b);
 const files=fs.readdirSync(runtime+'/bin').filter(f=>/\.dll$/i.test(f)).sort().map(file=>{const bytes=fs.readFileSync(runtime+'/bin/'+file);return {path:'bin/'+file,bytes:bytes.length,sha256:sha(bytes)};});if(files.length!==29)throw Error('Unexpected DLL count');
 report.nativeFiles=files;report.versionEvidence={path:'versions.json',bytes:b.length,sha256:sha(b)};const marker=fs.readFileSync(runtime+'/barkdown-postgres.json');report.postgresMarker={path:runtime+'/barkdown-postgres.json',bytes:marker.length,sha256:sha(marker),archiveSha256:JSON.parse(marker).sourceSha256};save();
 for(const item of inputs){
  const raw=execFileSync('gh',['api','repos/'+item.repo+'/git/ref/tags/'+item.tag],{maxBuffer:2e6}),ref=JSON.parse(raw);const chain=[{kind:'ref',body:ref}];let object=ref.object;
  while(object.type==='tag'){if(chain.length>5)throw Error('Unexpected recursive tag');const tag=JSON.parse(execFileSync('gh',['api','repos/'+item.repo+'/git/tags/'+object.sha],{maxBuffer:2e6}));chain.push({kind:'tag',body:tag});object=tag.object;}
  if(object.type!=='commit'||!/^[a-f0-9]{40}$/.test(object.sha))throw Error('No immutable source commit');
  const row={...item,commit:object.sha,tagChain:chain,files:[]};report.sources.push(row);save();
  for(const sourcePath of item.paths){
   const url='https://raw.githubusercontent.com/'+item.repo+'/'+row.commit+'/'+sourcePath;const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Fetch '+response.status+': '+url);const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>1e6||bytes.includes(0)||!Buffer.from(bytes.toString('utf8')).equals(bytes))throw Error('Invalid notice bytes');
   const target=item.name+'/'+sourcePath;fs.mkdirSync(path.dirname(output+'/'+target),{recursive:true});fs.writeFileSync(output+'/'+target,bytes,{flag:'wx'});row.files.push({path:target,sourcePath,url,bytes:bytes.length,sha256:sha(bytes)});save();
  }
  console.log('Retained '+item.name+' '+item.version+' from '+row.commit);
 }
 report.status='incomplete-preparation';report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.finishedAt=new Date().toISOString();report.failures.push(error.message);save();throw error;}
