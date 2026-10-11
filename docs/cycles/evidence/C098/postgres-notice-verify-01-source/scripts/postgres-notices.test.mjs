import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { auditPostgresNotices, parseModuleDeclarations } from './audit-postgres-notices.mjs';

const fixture=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'barkdown-pg-notices-Chø-'));
const runtime=path.join(fixture,'runtime'),provenance=path.join(fixture,'originals'),gnu=path.join(fixture,'gnu'),modules=path.join(fixture,'modules');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(file,b)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);};
const json=(file,value)=>write(file,JSON.stringify(value,null,2)+'\n');
const image=Buffer.alloc(512);image.write('MZ');image.writeUInt32LE(64,0x3c);image.writeUInt32LE(0x4550,64);image.writeUInt16LE(0x8664,68);image.writeUInt16LE(1,70);image.writeUInt16LE(240,84);image.writeUInt16LE(0x20b,88);
const original=Buffer.from('Original copyright and license fixture\r\nUnchanged original bytes\r\n');
for(const name of ['bin/icuuc77.dll','bin/new.exe','lib/utf8_and_big5.dll','lib/plpython3.dll','lib/system_stats.dll'])write(path.join(runtime,name),image);
write(path.join(runtime,'vendor.txt'),original);
const files=fs.readdirSync(runtime,{recursive:true}).filter(f=>fs.lstatSync(path.join(runtime,f)).isFile()).map(file=>{const b=fs.readFileSync(path.join(runtime,file));return {path:file.split(path.sep).join('/'),bytes:b.length,sha256:sha(b)};});
const mark={version:1,platform:'win32',arch:'x64',postgres:'18.4',sourceSha256:'f'.repeat(64),sourceUrl:'https://example.invalid/owned-fixture.zip',licenses:['vendor.txt'],files};json(path.join(runtime,'barkdown-postgres.json'),mark);
const markBytes=fs.readFileSync(path.join(runtime,'barkdown-postgres.json'));
const versionBytes=Buffer.from(JSON.stringify([{file:'icuuc77.dll',fileVersion:'77, 1, 0, 0'}]));write(path.join(provenance,'versions.json'),versionBytes);
const pgCommit='a'.repeat(40),icuCommit='b'.repeat(40);
const source=(name,version,repo,tag,commit,sourcePath)=>{
  write(path.join(provenance,name,sourcePath),original);
  return {name,version,repo,tag,commit,tagChain:[{kind:'ref',body:{ref:'refs/tags/'+tag,object:{type:'commit',sha:commit}}}],files:[{path:name+'/'+sourcePath,sourcePath,url:'https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+sourcePath,bytes:original.length,sha256:sha(original)}]};
};
const prepared={version:1,status:'incomplete-preparation',distributionReady:false,postgresMarker:{sha256:sha(markBytes),archiveSha256:mark.sourceSha256},versionEvidence:{path:'versions.json',bytes:versionBytes.length,sha256:sha(versionBytes)},nativeFiles:files.filter(f=>f.path==='bin/icuuc77.dll'),sources:[source('icu','77.1','unicode-org/icu','release-77-1',icuCommit,'LICENSE'),source('postgresql','18.4','postgres/postgres','REL_18_4',pgCommit,'COPYRIGHT')]};
const savePrepared=value=>json(path.join(provenance,'provenance.json'),value);savePrepared(prepared);json(path.join(gnu,'provenance.json'),{version:1,status:'incomplete-preparation',distributionReady:false,sources:[]});
const makeInputs=[['GNUmakefile','# Root build declaration\n'],['src/backend/utils/mb/conversion_procs/utf8_and_big5/Makefile','NAME = utf8_and_big5\ninclude $(srcdir)/../proc.mk\n'],['src/backend/utils/mb/conversion_procs/proc.mk','include $(top_srcdir)/src/Makefile.shlib\n'],['src/pl/plpython/Makefile','NAME = plpython$(python_majorversion)\ninclude $(top_srcdir)/src/Makefile.shlib\n'],['COPYRIGHT',original.toString()]];
const build={version:1,status:'incomplete-preparation',distributionReady:false,repo:'postgres/postgres',tag:'REL_18_4',commit:pgCommit,url:'https://codeload.github.com/postgres/postgres/tar.gz/'+pgCommit,archive:{sha256:'c'.repeat(64)},files:[],modules:[]};
for(const [file,text] of makeInputs){const b=Buffer.from(text);write(path.join(modules,file),b);build.files.push({path:file,archivePath:'postgres-'+pgCommit+'/'+file,bytes:b.length,sha256:sha(b)});if(file.endsWith('/Makefile'))build.modules.push(...parseModuleDeclarations(file,text));}
const saveBuild=value=>json(path.join(modules,'provenance.json'),value);saveBuild(build);
const options=name=>({runtime,provenance,gnu,modules,output:path.join(fixture,name)});

assert.deepEqual(parseModuleDeclarations('src/program/Makefile','NAME = not_a_module\n'),[]);
assert.deepEqual(parseModuleDeclarations('contrib/example/Makefile','MODULES = first \\\n second # comment\nMODULE_big = $(unknown)\n').map(r=>r.name),['first','second']);
assert.equal(parseModuleDeclarations('src/pl/Makefile','NAME = plpython$(python_majorversion)\ninclude Makefile.shlib\n')[0].variable,'python_majorversion');
const report=auditPostgresNotices(options('audit'));
assert.equal(report.distributionReady,false);assert.equal(report.status,'incomplete-preparation');assert.equal(report.native.length,5);assert.equal(report.sources.length,2);
const find=p=>report.native.find(r=>r.path===p);
assert.equal(find('bin/icuuc77.dll').component,'icu');assert.equal(find('lib/utf8_and_big5.dll').component,'postgresql');assert.equal(find('lib/plpython3.dll').moduleDeclaration.variable,'python_majorversion');
assert.equal(find('lib/system_stats.dll').component,null);assert.equal(find('bin/new.exe').component,null);
assert.ok(report.gaps.some(g=>g.path==='lib/system_stats.dll'));assert.ok(report.gaps.some(g=>g.component==='GNU libraries'));
assert.deepEqual(fs.readFileSync(path.join(fixture,'audit/licenses/upstream/icu/LICENSE')),original);
assert.throws(()=>auditPostgresNotices(options('audit')),/Output already exists/);
for(const input of [runtime,provenance,gnu,modules]){
  const output=path.join(process.platform==='win32'?input.toUpperCase():input,'nested-output');
  assert.throws(()=>auditPostgresNotices({...options('overlap'),output}),/Output overlaps/);assert.equal(fs.existsSync(path.join(input,'nested-output')),false);
}
fs.symlinkSync(provenance,path.join(fixture,'linked-originals'),process.platform==='win32'?'junction':'dir');
assert.throws(()=>auditPostgresNotices({...options('linked'),provenance:path.join(fixture,'linked-originals')}),/Linked/);
assert.equal(fs.existsSync(path.join(fixture,'linked')),false);
const changed=Buffer.concat([image,Buffer.from([1])]);write(path.join(runtime,'bin/icuuc77.dll'),changed);
assert.throws(()=>auditPostgresNotices(options('changed-native')),/Changed notice\/payload/);write(path.join(fixture,'changed-native-retained.bin'),changed);write(path.join(runtime,'bin/icuuc77.dll'),image);
write(path.join(runtime,'unlisted.txt'),'Unlisted fixture');assert.throws(()=>auditPostgresNotices(options('unlisted')),/roster differs/);fs.renameSync(path.join(runtime,'unlisted.txt'),path.join(fixture,'unlisted-retained.txt'));
savePrepared({...prepared,postgresMarker:{...prepared.postgresMarker,archiveSha256:'d'.repeat(64)}});assert.throws(()=>auditPostgresNotices(options('wrong-payload')),/another payload/);savePrepared(prepared);
savePrepared({...prepared,versionEvidence:null});assert.throws(()=>auditPostgresNotices(options('unbound-version')),/Missing byte-bound native version evidence/);savePrepared(prepared);
const bad=structuredClone(prepared);bad.sources[0].tag='main';savePrepared(bad);assert.throws(()=>auditPostgresNotices(options('mutable-ref')),/exact upstream/);savePrepared(prepared);
const broken=structuredClone(prepared);broken.sources[0].tagChain[0].body.object.sha='e'.repeat(40);savePrepared(broken);assert.throws(()=>auditPostgresNotices(options('wrong-tag-commit')),/Source commit/);savePrepared(prepared);
for(const sourcePath of ['../escape','LICENSE:stream','NUL.txt','LICENSE.']){
  const escaped=structuredClone(prepared);escaped.sources[0].files[0].sourcePath=sourcePath;savePrepared(escaped);assert.throws(()=>auditPostgresNotices(options('unsafe-'+sha(Buffer.from(sourcePath)).slice(0,8))),/Unsafe notice path/);
}savePrepared(prepared);
write(path.join(provenance,'icu/LICENSE'),'Changed text');assert.throws(()=>auditPostgresNotices(options('changed-license')),/Changed notice\/payload/);write(path.join(provenance,'icu/LICENSE'),original);
const wrongVersion=Buffer.from(JSON.stringify([{file:'icuuc77.dll',fileVersion:'78, 1, 0, 0'}]));write(path.join(provenance,'versions.json'),wrongVersion);savePrepared({...prepared,versionEvidence:{path:'versions.json',bytes:wrongVersion.length,sha256:sha(wrongVersion)}});assert.throws(()=>auditPostgresNotices(options('wrong-resource-version')),/resource version differs/);write(path.join(provenance,'versions.json'),versionBytes);savePrepared(prepared);
savePrepared({...prepared,nativeFiles:[...prepared.nativeFiles,...prepared.nativeFiles]});assert.throws(()=>auditPostgresNotices(options('duplicate-version-binary')),/Duplicate version-bound/);savePrepared(prepared);
saveBuild({...build,modules:[...build.modules,{name:'system_stats',sourcePath:'unproven',declaration:'MODULES',logicalLine:1}]});assert.throws(()=>auditPostgresNotices(options('invented-module')),/Module declarations differ/);saveBuild(build);
write(path.join(modules,makeInputs[0][0]),'Changed declaration');assert.throws(()=>auditPostgresNotices(options('changed-build-source')),/Changed notice\/payload/);write(path.join(modules,makeInputs[0][0]),makeInputs[0][1]);
assert.deepEqual(fs.readFileSync(path.join(fixture,'audit/licenses/upstream/icu/LICENSE')),original);
assert.equal(fs.existsSync(path.join(fixture,'wrong-resource-version')),false);
console.log('PostgreSQL notice contracts: raw preservation, full roster/hash ownership, literal/symbolic module candidates, unknown vendor modules, exact tags/resources, tamper/link/overlap/ADS/reserved path and output reuse refusals passed. Fixture: '+fixture);
