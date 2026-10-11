import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Owned offline input comparison; never rewrite source, runtime or package assets.
const out=path.resolve('docs/cycles/evidence/C098/phoenix-attribution-02');
assert.ok(!fs.existsSync(out),'Preserve previous evidence');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(fileURLToPath(import.meta.url),path.join(out,'producer.mjs'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const started=Date.now();
const report={version:1,status:'running',startedAt:new Date().toISOString(),distributionReady:false};
const write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
write();
try {
 const source=path.resolve('runtime/phoenix-inputs-01/source/package');
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
 const dist=JSON.parse(fs.readFileSync('.git/c098-phoenix-dist-02.json','utf8'));
 const tar=fs.readFileSync('runtime/phoenix-inputs-01/phoenix-1.8.5.tgz');
 assert.equal(manifest.name,'phoenix');assert.equal(manifest.version,'1.8.5');
 assert.equal('sha512-'+crypto.createHash('sha512').update(tar).digest('base64'),dist.integrity);
 assert.equal(crypto.createHash('sha1').update(tar).digest('hex'),dist.shasum);
 fs.copyFileSync('.git/c098-phoenix-dist-02.json',path.join(out,'registry-dist.json'));
 fs.copyFileSync(path.join(source,'LICENSE.md'),path.join(out,'LICENSE.md'));
 fs.copyFileSync(path.join(source,'package.json'),path.join(out,'package.json'));
 const require=createRequire(path.resolve('app/package.json'));
 const esbuild=require('esbuild');assert.equal(esbuild.version,'0.25.12');
 const compiler=path.dirname(require.resolve('esbuild/package.json'));
 const binary=require.resolve('@esbuild/win32-x64/esbuild.exe');
 fs.copyFileSync(path.join(compiler,'package.json'),path.join(out,'compiler-package.json'));
 fs.copyFileSync(path.join(compiler,'LICENSE.md'),path.join(out,'compiler-LICENSE.md'));
 report.compiler={version:esbuild.version,binarySha256:hash(fs.readFileSync(binary)),packageJsonSha256:hash(fs.readFileSync(path.join(compiler,'package.json')))};
 const options={bundle:true,format:'iife',globalName:'Phoenix',minify:true,write:false,metafile:true,tsconfigRaw:{compilerOptions:{}},supported:{'typeof-exotic-object-is-object':false,'optional-catch-binding':false}};
 const rebuilt=await esbuild.build({...options,entryPoints:[path.join(source,'assets/js/phoenix/index.js')]});
 const bytes=Buffer.from(rebuilt.outputFiles[0].contents);
 fs.writeFileSync(path.join(out,'rebuilt.js'),bytes);
 fs.writeFileSync(path.join(out,'metafile.json'),JSON.stringify(rebuilt.metafile,null,2)+'\n');
 const inputs=Object.keys(rebuilt.metafile.inputs).sort().map(file=>{const full=path.resolve(file),rel=path.relative(source,full);assert.ok(!rel.startsWith('..')&&!path.isAbsolute(rel),'Input inside owned Phoenix package');const b=fs.readFileSync(full);const target=path.join(out,'source',rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);return {path:rel.split(path.sep).join('/'),bytes:b.length,sha256:hash(b)};});
 fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
 const pin=path.resolve('../barkpark-windows-return'),file='api/priv/static/assets/phoenix.js';
 const original=fs.readFileSync(path.join(pin,file));
 const carried=fs.readFileSync('runtime/barkpark-944a57a1-win32-x64-release-03/lib/barkpark-0.1.0/priv/static/assets/phoenix.js');
 const packaged=fs.readFileSync('app/release/C098 Packaged Chø 01/win-unpacked/resources/runtime/lib/barkpark-0.1.0/priv/static/assets/phoenix.js');
 assert.ok(bytes.equals(original));assert.ok(bytes.equals(carried));assert.ok(bytes.equals(packaged));
 const current=await esbuild.build({...options,entryPoints:[path.join(pin,'api/deps/phoenix/assets/js/phoenix/index.js')]});
 const wrong=Buffer.from(current.outputFiles[0].contents);assert.ok(!wrong.equals(original),'Current server dependency must not masquerade as old static client');
 fs.copyFileSync('.git/c098-phoenix-supported-01.json',path.join(out,'one-flag-failure.json'));
 report.status='prepared';report.package={name:manifest.name,version:manifest.version,tarball:dist.tarball,tarSha256:hash(tar),integrity:dist.integrity,licenseSha256:hash(fs.readFileSync(path.join(source,'LICENSE.md')))};
 report.upstream=execFileSync('git',['rev-parse','HEAD'],{cwd:pin,encoding:'utf8'}).trim();
 report.compiled={source:file,bytes:bytes.length,sha256:hash(bytes),inputCount:inputs.length,exactSourceRuntimeAndPackage:true};
 report.options=options;
 report.negativeControl={phoenix:'1.8.9',bytes:wrong.length,sha256:hash(wrong),equal:false};
 report.limits=['Reproduction recipe inferred from measured output; original historical compiler/command not established','Exact static client source is 1.8.5; current server lock is 1.8.9','Registry integrity/shasum verified; signatures retained but not independently signature-verified','No source/runtime/package mutation or production dependency change','This attribution does not complete native/system/frontend obligations or grant installer acceptance'];
} catch(e) {report.status='failed';report.error=String(e.stack||e);process.exitCode=1;}
finally {report.elapsedMs=Date.now()-started;report.finishedAt=new Date().toISOString();write();console.log(JSON.stringify(report));}
