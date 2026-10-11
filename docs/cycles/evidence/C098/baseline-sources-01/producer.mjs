import fs from 'node:fs';
import crypto from 'node:crypto';
const out='docs/cycles/evidence/C098/baseline-sources-01';fs.mkdirSync(out);
const sources=[['configuration','https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file'],['installation','https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install'],['optional-feature','https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-optionalfeature']];
const rows=[];
for(const [name,url] of sources){const response=await fetch(url);if(!response.ok)throw Error('Source fetch failed '+url);const bytes=Buffer.from(await response.arrayBuffer());fs.writeFileSync(out+'/'+name+'.html',bytes,{flag:'wx'});rows.push({name,url,resolvedUrl:response.url,fetchedAt:new Date().toISOString(),file:name+'.html',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
fs.copyFileSync('.git/c098-baseline-sources-01.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/sources.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows.map(({name,bytes})=>({name,bytes}))));
