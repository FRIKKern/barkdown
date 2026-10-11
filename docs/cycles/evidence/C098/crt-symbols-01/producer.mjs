import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,execFileSync} from 'node:child_process';import {image} from './c098-crt-symbols-pe-02.mjs';
const out='docs/cycles/evidence/C098/crt-symbols-01';fs.mkdirSync(out);fs.mkdirSync(out+'/raw');
for(const [src,dst] of [['.git/c098-crt-symbol-audit-01.mjs','producer.mjs'],['.git/c098-crt-symbols-pe-02.mjs','reader.mjs']])fs.copyFileSync(src,out+'/'+dst);
const scanFile='docs/cycles/evidence/C098/import-scan-06/audit/imports.json',payloadFile='docs/cycles/evidence/C098/crt-payload-01/review.json';
const scan=JSON.parse(fs.readFileSync(scanFile)),payload=JSON.parse(fs.readFileSync(payloadFile)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),target=['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll'];
const started=Date.now(),report={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),tool:scan.tool,inputs:[scanFile,payloadFile,'.git/c098-crt-symbol-audit-01.mjs','.git/c098-crt-symbols-pe-02.mjs','scripts/audit-windows-imports.mjs'].map(file=>({file,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))})),catalog:[],candidateExports:[],importers:[],raw:[],controls:[],limits:['Fixed inspected three-module candidate correspondence, not a production arbitrary-PE parser','Native dumpbin only reads images; no candidate code invoked or installer run','Names/ordinals/export RVAs do not prove ABI, minimum compiler version, dynamic imports, loader search/API-set/UCRT resolution or clean deployment','Physical186 PE scan; compressed ASAR payloads and optional ARM64/WinPTY execution not accepted','Linker version fields are observations, not established compiler/runtime minimums']};
const write=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');write();
function sameInput(file,row){const b=fs.readFileSync(file);assert.equal(b.length,row.bytes,'Input size changed '+file);assert.equal(sha(b),row.sha256,'Input hash changed '+file);return b;}
function native(op,file,index){const start=Date.now(),r=spawnSync(scan.tool.path,['/nologo','/'+op,file],{windowsHide:true,timeout:10000,maxBuffer:16e6});
 for(const stream of ['stdout','stderr']){const b=r[stream]||Buffer.alloc(0),name='raw/'+index+'-'+op+'-'+stream+'.txt';fs.writeFileSync(out+'/'+name,b,{flag:'wx'});report.raw.push({file,operation:op,stream,output:name,bytes:b.length,sha256:sha(b),exitCode:r.status,elapsedMs:Date.now()-start,error:r.error?String(r.error):null});}
 assert.equal(r.status,0,'Native inspection failed');assert.ok(!r.error);assert.match(r.stdout.toString('utf8'),/^File Type: (?:DLL|EXECUTABLE IMAGE)\s*$/m);assert.match(r.stdout.toString('utf8'),/^  Summary\s*$/m);return r.stdout.toString('utf8');}
function nativeImports(text){let active=null,kind=null;const rows=[];
 for(const line of text.split(/\r?\n/)){
  if(line==='  Section contains the following imports:'){kind='direct';active=null;continue;}
  if(line==='  Section contains the following delay load imports:'){kind='delayed';active=null;continue;}
  if(/^  Summary\s*$/.test(line)){active=null;kind=null;continue;}
  const module=/^    (\S+)$/.exec(line)?.[1];if(module&&kind){active=target.includes(module.toLowerCase())?{module,kind,symbols:[]}:null;if(active)rows.push(active);continue;}
  if(!active||!line.trim())continue;
  if(/^\s+[0-9A-F]+ (?:Import Address Table|Import Name Table|time date stamp|Index of first forwarder reference)\s*$/.test(line))continue;
  const ordinal=/^\s+Ordinal\s+(\d+)\s*$/.exec(line);if(ordinal){active.symbols.push({ordinal:Number(ordinal[1])});continue;}
  const named=/^\s+([0-9A-F]+) (\S+)\s*$/.exec(line);assert.ok(named,'Unrecognized target import line '+line);active.symbols.push({name:named[2],hint:parseInt(named[1],16)});
 }
 return rows;
}
function nativeExports(text,expected){const rows=[];let table=false;
 for(const line of text.split(/\r?\n/)){if(line==='    ordinal hint RVA      name'){table=true;continue;}if(/^  Summary\s*$/.test(line)){table=false;continue;}if(!table||!line.trim())continue;
 const m=/^\s+(\d+)\s+([0-9A-F]+)\s+([0-9A-F]{8})\s+(\S+)\s*$/.exec(line);assert.ok(m,'Unrecognized target export line '+line);rows.push({ordinal:Number(m[1]),rva:parseInt(m[3],16),name:m[4]});}
 // dumpbin prints counts in decimal despite hexadecimal hint/RVA columns.
 const count=label=>Number(new RegExp('^\\s+(\\d+) '+label+'\\s*$','m').exec(text)?.[1]);
 assert.equal(count('number of functions'),expected.functions);assert.equal(count('number of names'),expected.names);
 assert.deepEqual(rows,expected.rows.flatMap(r=>r.names.map(name=>({ordinal:r.ordinal,rva:r.rva,name}))));return rows.length;
}
function resolve(symbol,exp){const rows=exp.rows.filter(r=>symbol.name?r.names.includes(symbol.name):r.ordinal===symbol.ordinal);assert.equal(rows.length,1,'Missing/ambiguous candidate export '+JSON.stringify(symbol));assert.ok(rows[0].rva,'Zero candidate export');assert.equal(rows[0].forwarder,null,'Forwarded candidate requires independent target proof');return rows[0];}
try{
 sameInput(scan.tool.path,scan.tool);
 assert.equal(scan.files.length,186);assert.deepEqual(scan.dependencies.filter(d=>d.category==='visual-c-runtime').map(d=>d.name).sort(),[...target].sort());
 const symbols=new Map(),pending=[];
 for(const row of scan.files){const file=path.join(scan.bundle,row.path),b=sameInput(file,row),pe=image(b),catalog=pe.imports();assert.equal(pe.arch,row.arch);
  for(const kind of ['direct','delayed'])assert.deepEqual([...new Set(catalog[kind].map(r=>r.module))].sort(),row.imports[kind]);
  report.catalog.push({path:row.path,bytes:row.bytes,sha256:row.sha256,arch:pe.arch,linker:pe.linker,direct:catalog.direct.length,delayed:catalog.delayed.length});
  const selected=['direct','delayed'].flatMap(kind=>catalog[kind].filter(r=>target.includes(r.module.toLowerCase())).map(r=>({...r,kind})));if(selected.length){assert.equal(row.arch,'x64');pending.push({row,file,selected});}
 }
 for(const name of target){const row=payload.correspondence.find(r=>r.name===name)?.candidate;assert.ok(row,'Missing candidate metadata');const file=path.resolve('.git/c098-crt-minimum-files-01',name),b=sameInput(file,row),pe=image(b),exp=pe.exports();assert.equal(pe.arch,'x64');assert.equal(exp.module.toLowerCase(),name);assert.ok(exp.rows.every(r=>!r.forwarder),'Unexpected forwarders');
  const nativeNamed=nativeExports(native('exports',file,name),exp);sameInput(file,row);symbols.set(name,exp);report.candidateExports.push({name,bytes:row.bytes,sha256:row.sha256,arch:pe.arch,functions:exp.functions,names:exp.names,nativeNamed,rows:exp.rows});
 }
 for(const [i,{row,file,selected}] of pending.entries()){
  const actual=nativeImports(native('imports',file,String(i).padStart(3,'0')));assert.deepEqual(actual,selected,'Native import symbols differ '+row.path);sameInput(file,row);
  for(const module of selected){const exp=symbols.get(module.module.toLowerCase()),resolved=module.symbols.map(symbol=>({...symbol,exportOrdinal:resolve(symbol,exp).ordinal,exportRva:resolve(symbol,exp).rva}));report.importers.push({path:row.path,arch:row.arch,sha256:row.sha256,module:module.module,kind:module.kind,symbols:resolved});}
 }
 const example=report.importers.find(r=>r.symbols.some(s=>s.name));assert.ok(example);const required=example.symbols.find(s=>s.name),original=symbols.get(example.module.toLowerCase()),removed=structuredClone(original);for(const r of removed.rows)r.names=r.names.filter(n=>n!==required.name);assert.throws(()=>resolve(required,removed),/Missing\/ambiguous/);report.controls.push({name:'Missing actual required name refuses',module:example.module,name:required.name});
 const row=original.rows.find(r=>r.names.includes(required.name)),zero=structuredClone(original);zero.rows.find(r=>r.ordinal===row.ordinal).rva=0;assert.throws(()=>resolve(required,zero),/Zero candidate export/);report.controls.push({name:'Zero actual required export RVA refuses',ordinal:row.ordinal});
 const forwarded=structuredClone(original);forwarded.rows.find(r=>r.ordinal===row.ordinal).forwarder='unproved.symbol';assert.throws(()=>resolve(required,forwarded),/Forwarded candidate/);report.controls.push({name:'Forwarded actual export refuses without target proof',ordinal:row.ordinal});
 assert.equal(resolve({ordinal:row.ordinal},original).rva,row.rva);assert.throws(()=>resolve({ordinal:original.base+original.functions},original),/Missing\/ambiguous/);report.controls.push({name:'Actual ordinal maps; outside-table ordinal refuses',ordinal:row.ordinal,syntheticOrdinalUse:true});
 sameInput(scan.tool.path,scan.tool);for(const row of report.inputs)sameInput(row.file,row);
 report.summary={images:report.catalog.length,uniqueImporters:pending.length,moduleReferences:report.importers.length,symbolReferences:report.importers.reduce((s,r)=>s+r.symbols.length,0),ordinalImports:report.importers.reduce((s,r)=>s+r.symbols.filter(t=>t.ordinal!==undefined).length,0),delayedTargetReferences:report.importers.filter(r=>r.kind==='delayed').length,modules:target.map(name=>{const rows=report.importers.filter(r=>r.module.toLowerCase()===name),named=new Set(rows.flatMap(r=>r.symbols.map(s=>s.name)));return {name,importers:rows.length,symbolReferences:rows.reduce((s,r)=>s+r.symbols.length,0),uniqueNames:named.size};})};
 report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack||e);process.exitCode=1;}finally{report.elapsedMs=Date.now()-started;report.finishedAt=new Date().toISOString();write();console.log(JSON.stringify({status:report.status,elapsedMs:report.elapsedMs,summary:report.summary,error:report.error}));}
