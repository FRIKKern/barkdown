import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const out='docs/cycles/evidence/C098/postgres-native-identity-01';fs.mkdirSync(out);fs.copyFileSync(fileURLToPath(import.meta.url),out+'/producer.mjs');
const imports=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/import-scan-06/audit/imports.json')),tool=imports.tool.path;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');if(sha(fs.readFileSync(tool))!==imports.tool.sha256)throw Error('Native tool changed');
const dir='runtime/barkpark-944a57a1-win32-x64-release-05/postgres',names=['bin/icutu77.dll','bin/libwinpthread-1.dll','bin/libxslt.dll','bin/testplug.dll','lib/plugin_debugger.dll','lib/system_stats.dll'];const rows=[];
for(const [i,name] of names.entries()){
  const bytes=fs.readFileSync(dir+'/'+name),raw=execFileSync(tool,['/nologo','/exports',dir+'/'+name],{windowsHide:true,timeout:10000});fs.writeFileSync(out+'/'+i+'-exports.txt',raw,{flag:'wx'});
  const strings=[...bytes.toString('latin1').matchAll(/[ -~]{6,}/g)].filter(m=>/libxslt|MinGW|copyright|version|PostgreSQL|plugin_debugger|system_stats|ICU|(?:^|\s)\d+\.\d+\.\d+(?:\s|$)/i.test(m[0])).map(m=>({offset:m.index,text:m[0]}));
  if(!bytes.equals(fs.readFileSync(dir+'/'+name)))throw Error('Native input changed');rows.push({file:name,bytes:bytes.length,sha256:sha(bytes),exports:{path:i+'-exports.txt',bytes:raw.length,sha256:sha(raw)},strings});
  console.log(JSON.stringify({file:name,strings:strings.slice(0,25)}));
}
fs.writeFileSync(out+'/result.json',JSON.stringify({version:1,status:'observed',observedAt:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tool:imports.tool,rows,limits:['Static export/list/string observations only, no DLL loaded','Arbitrary embedded strings are candidates, not exact version identity','Original payload bytes preserved; no distribution acceptance']},null,2)+'\n');
