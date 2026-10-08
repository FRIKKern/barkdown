import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {auditWindowsImports} from '../scripts/audit-windows-imports.mjs';
const out='docs/cycles/evidence/C098/import-controlled-failure-04';fs.mkdirSync(out,{recursive:false});fs.copyFileSync(fileURLToPath(import.meta.url),out+'/producer.mjs');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture=path.resolve('runtime/C098 PE controlled command Chø 03'),candidate=path.join(fixture,'bundle/probe.dll'),tool=path.join(fixture,'tools/dumpbin.exe');
const bytes={candidate:sha(candidate),tool:sha(tool)};
const audit=auditWindowsImports({bundle:path.join(fixture,'bundle'),dumpbin:tool,output:out+'/audit'});
assert.equal(audit.status,'failed');assert.equal(audit.distributionReady,false);assert.equal(audit.failure.exitCode,2);assert.equal(audit.files.length,0);
const raw=JSON.parse(fs.readFileSync(out+'/audit/dumpbin-output.json'));assert.equal(raw.length,2);
for(const row of raw){assert.equal(fs.statSync(out+'/audit/'+row.output).size,row.bytes);assert.equal(sha(out+'/audit/'+row.output),row.sha256);}
assert.equal(sha(candidate),bytes.candidate);assert.equal(sha(tool),bytes.tool);
assert.throws(()=>auditWindowsImports({bundle:path.join(fixture,'bundle'),dumpbin:tool,output:out+'/audit'}),/Output already exists/);
const corrupt=path.resolve('runtime/C098 PE controlled corrupt Chø 01'),corruptHash=sha(path.join(corrupt,'corrupt.dll'));
assert.throws(()=>auditWindowsImports({bundle:corrupt,dumpbin:tool,output:out+'/malformed-refusal'}),/Incomplete PE image headers/);
assert.equal(fs.existsSync(out+'/malformed-refusal'),false);assert.equal(sha(path.join(corrupt,'corrupt.dll')),corruptHash);
fs.writeFileSync(out+'/result.json',JSON.stringify({status:'passed-controlled-refusal',elapsedMs:audit.elapsedMs,fixture,reusedPriorFixtureUnchanged:true,bytes,originalNativeStreamsRetained:raw.map(r=>({stream:r.stream,bytes:r.bytes,sha256:r.sha256})),exitCode:audit.failure.exitCode,outputReuseRefused:true,malformedHeaderRefusedWithoutWrites:true,limits:['Explicit retained where.exe-copy fault, not genuine dumpbin; no installer executed']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'passed-controlled-refusal',elapsedMs:audit.elapsedMs}));
