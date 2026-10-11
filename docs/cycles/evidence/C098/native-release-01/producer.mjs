import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const list=base=>fs.readdirSync(base,{recursive:true,withFileTypes:true}).map(e=>{if(e.isSymbolicLink())throw Error('Linked source refused');return e;}).filter(e=>e.isFile()).map(e=>{const f=path.join(e.parentPath,e.name);return {path:path.relative(base,f).replaceAll('\\','/'),bytes:fs.statSync(f).size,sha256:hash(f)};}).sort((a,b)=>a.path.localeCompare(b.path));
const safe=p=>{p=path.resolve(p);if(/[!%"&|<>^\r\n]/.test(p))throw Error('Unsafe batch path');return p;};
const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
if(process.argv[2]==='--worker'){
 const state=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));const {out,source,cmake,include}=state;const report={status:'running',startedAt:new Date().toISOString(),steps:[]};
 const write=()=>fs.writeFileSync(path.join(out,'native-result.json'),JSON.stringify(report,null,2)+'\n');write();
 const run=(name,exe,args)=>{const log=path.join(out,name+'.log'),fd=fs.openSync(log,'wx'),start=Date.now();let r;try{r=spawnSync(exe,args,{windowsHide:true,stdio:['ignore',fd,fd],timeout:240000});}finally{fs.closeSync(fd);}report.steps.push({name,executable:exe,args,elapsedMs:Date.now()-start,status:r.status,error:r.error?.message,signal:r.signal,log:path.basename(log)});write();if(r.status!==0||r.error)throw Error(name+' failed');};
 try{
  const uv=path.join(out,'libuv-build'),prefix=path.join(out,'libuv'),ex=path.join(out,'expty-build'),app=path.join(out,'expty'),slash=p=>p.replaceAll('\\','/');
  run('libuv-configure',cmake,['-S',path.join(source,'3rd_party/libuv-1.44.2'),'-B',uv,'-G','NMake Makefiles','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_POLICY_VERSION_MINIMUM=3.5','-DLIBUV_BUILD_TESTS=OFF','-DLIBUV_BUILD_BENCH=OFF','-DCMAKE_INSTALL_PREFIX='+slash(prefix)]);
  run('libuv-build',cmake,['--build',uv,'--config','Release']);run('libuv-install',cmake,['--install',uv,'--config','Release']);
  run('expty-configure',cmake,['-S',source,'-B',ex,'-G','NMake Makefiles','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_INSTALL_PREFIX='+slash(path.join(app,'priv')),'-DMIX_APP_PATH='+slash(app),'-DC_SRC='+slash(path.join(source,'c_src')),'-DERTS_INCLUDE_DIR='+slash(include),'-DLIBUV_INCLUDE_DIR='+slash(path.join(prefix,'include')),'-DLIBUV_LIBRARIES_DIR='+slash(path.join(prefix,'lib'))]);
  run('expty-build',cmake,['--build',ex,'--config','Release']);run('expty-install',cmake,['--install',ex,'--config','Release']);
  const dumpbin=process.env.VCToolsInstallDir&&path.join(process.env.VCToolsInstallDir,'bin/Hostx64/x64/dumpbin.exe');if(!dumpbin||!fs.existsSync(dumpbin))throw Error('dumpbin unavailable');
  report.native=[];
  for(const name of ['expty.dll','conpty_console_list.exe']){const file=path.join(app,'priv',name),txt=execFileSync(dumpbin,['/nologo','/dependents',file],{encoding:'utf8'}),imports=[...new Set([...txt.matchAll(/^\s{4,}([^\s]+\.dll)\s*$/gim)].map(m=>m[1]))].sort();if(!imports.length||imports.some(n=>/^(MSVCP|MSVCR|VCRUNTIME|CONCRT).*D\.dll$/i.test(n)))throw Error('Missing imports or Debug CRT: '+name);report.native.push({path:'expty/priv/'+name,sha256:hash(file),bytes:fs.statSync(file).size,imports});}
  report.tools={cmake:{path:cmake,sha256:hash(cmake)},dumpbin:{path:dumpbin,sha256:hash(dumpbin)},vsTools:process.env.VCToolsVersion};report.status='passed';
 }catch(e){report.status='failed';report.error=e.message;process.exitCode=1;}finally{report.finishedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.finishedAt)-Date.parse(report.startedAt);write();}process.exit(process.exitCode||0);
}
const [checkoutArg,outArg,includeArg,vsArg,cmakeArg]=process.argv.slice(2);if(!cmakeArg)throw Error('Usage: producer <checkout> <new output> <erts include> <VsDevCmd> <cmake>');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Windows x64 required');
const checkout=safe(checkoutArg),out=safe(outArg),include=safe(includeArg),vs=safe(vsArg),cmake=safe(cmakeArg),dep=path.join(checkout,'api/deps/expty'),pin=fs.readFileSync('app/BARKPARK_REF','utf8').trim();
if(git(checkout,['rev-parse','HEAD'])!==pin||git(checkout,['status','--porcelain','--untracked-files=no']))throw Error('Pinned tracked-clean source required');
if(fs.existsSync(out))throw Error('Output exists, retained');for(let p=path.dirname(out);;p=path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Linked output parent');if(p===path.dirname(p))break;}
for(const p of [vs,cmake,path.join(include,'erl_nif.h')])if(!fs.statSync(p).isFile())throw Error('Tool/header missing');
const lock=path.join(checkout,'api/mix.lock'),lockSha=hash(lock),hex=fs.readFileSync(path.join(dep,'.hex')).toString('latin1');if(!hex.includes('0.2.1')||!hex.includes('ea28a0c041f588ce82e47bc342ef94b08979ad5a3595c3c484b7f0f4b4a27220')||!fs.readFileSync(lock,'utf8').includes('ea28a0c041f588ce82e47bc342ef94b08979ad5a3595c3c484b7f0f4b4a27220'))throw Error('ExPTY lock/version mismatch');
const selected=['c_src','3rd_party','CMakeLists.txt','Makefile','mix.exs','LICENSE','hex_metadata.config'];let sourceInputs=[];
for(const name of selected){const file=path.join(dep,name);if(fs.lstatSync(file).isSymbolicLink())throw Error('Linked input');sourceInputs.push(...(fs.statSync(file).isDirectory()?list(file).map(f=>({...f,path:name+'/'+f.path})):[{path:name,bytes:fs.statSync(file).size,sha256:hash(file)}]));}
fs.mkdirSync(out);const source=path.join(out,'source');fs.mkdirSync(source);for(const name of selected)fs.cpSync(path.join(dep,name),path.join(source,name),{recursive:true,force:false,errorOnExist:true});
if(JSON.stringify(list(source))!==JSON.stringify(sourceInputs.sort((a,b)=>a.path.localeCompare(b.path))))throw Error('Source copy mismatch');
const state={out,source,cmake,include,upstream:pin,lockSha256:lockSha,packageVersion:'0.2.1',producerSha256:hash(fileURLToPath(import.meta.url)),headerInputs:list(include),sourceInputs,limits:['Native-only preparation; old release untouched','Static imports do not prove dynamic dependency completeness or clean-machine installation','Source bytes from pinned checkout fetched Hex package; no package-signature claim']};
const stateFile=path.join(out,'inputs.json');fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
const cmd=path.join(out,'build.cmd');fs.writeFileSync(cmd,'@echo off\r\nsetlocal DisableDelayedExpansion\r\ncall "'+vs+'" -arch=x64 -host_arch=x64\r\nif errorlevel 1 exit /b %errorlevel%\r\n"'+safe(process.execPath)+'" "'+safe(fileURLToPath(import.meta.url))+'" --worker "'+stateFile+'"\r\nexit /b %errorlevel%\r\n',{flag:'wx'});
const log=fs.openSync(path.join(out,'producer.log'),'wx');let r;try{r=spawnSync(process.env.ComSpec,['/d','/s','/c','""'+cmd+'""'],{windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore',log,log],timeout:1200000});}finally{fs.closeSync(log);}
if(hash(lock)!==lockSha||git(checkout,['rev-parse','HEAD'])!==pin||git(checkout,['status','--porcelain','--untracked-files=no'])||sourceInputs.some(f=>hash(path.join(dep,f.path))!==f.sha256))throw Error('Source changed during build');
console.log(JSON.stringify({status:r.status,error:r.error?.message,output:out}));if(r.status!==0||r.error)process.exitCode=1;
