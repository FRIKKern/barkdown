import fs from 'node:fs';import path from 'node:path';
import {attachPostgres,inventory,sha256} from '../scripts/runtime-postgres-bundle.mjs';
const release=path.resolve('runtime/barkpark-944a57a1-win32-x64-release-05'),postgres=path.resolve('runtime/postgres-18.4-win32-x64-final'),out=path.resolve('docs/cycles/evidence/C098/reader-postgres-01');
if(fs.existsSync(out))throw Error('Preserve evidence');fs.mkdirSync(out);
const before=inventory(release),pgBefore=inventory(postgres),startedAt=new Date().toISOString(),start=Date.now();
fs.copyFileSync(import.meta.filename,path.join(out,'producer.mjs'));
const copied=attachPostgres(release,postgres),after=inventory(release),map=new Map(after.map(f=>[f.path,f]));
for(const file of before)if(file.path!=='barkdown-release.json'&&map.get(file.path)?.sha256!==file.sha256)throw Error('Existing release bytes changed');
if(JSON.stringify(pgBefore)!==JSON.stringify(inventory(postgres)))throw Error('Original PostgreSQL changed');
const mark=JSON.parse(fs.readFileSync(path.join(release,'barkdown-release.json'),'utf8'));
for(const asset of mark.readerAssets.files){const application=fs.readdirSync(path.join(release,'lib')).filter(n=>n.startsWith('barkpark-'));if(application.length!==1)throw Error('Ambiguous application');if(sha256(path.join(release,'lib',application[0],'priv/static/assets',asset.name))!==asset.sha256)throw Error('Reader assets changed');}
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(after,null,2)+'\n');
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',startedAt,finishedAt:new Date().toISOString(),elapsedMs:Date.now()-start,release,postgres,copied,files:after.length,bytes:after.reduce((s,f)=>s+f.bytes,0),readerExact:true,preservedExistingBytes:true,limits:['Only new engineering release05 assembled; retained earlier payloads and source bundle unchanged','No clean-machine or installer acceptance']},null,2)+'\n');
