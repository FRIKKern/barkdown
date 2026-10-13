import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const out='docs/cycles/evidence/C105/integration-vix-compile-02';fs.mkdirSync(out);
const source=path.resolve('../barkpark-windows-media-delete'),file='api/lib/barkpark/media/image_backend/vix.ex';
const before=spawnSync('git',['show','30693049515d0ae13ce9ae50ef21d6c320bfff44:'+file],{cwd:source,encoding:'utf8'});assert.equal(before.status,0);fs.writeFileSync(out+'/before.ex',before.stdout);fs.copyFileSync(path.join(source,file),out+'/candidate.ex');fs.copyFileSync('.git/c105-vix-compile.exs',out+'/check.exs');
const tools=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/reader-assembly-01/result.json'));
const start=Date.now(),runs=[];
for(const [file,expect] of [['before.ex','error'],['candidate.ex','clean']]){
 const argv=[tools.elixir,path.resolve(out+'/check.exs'),path.resolve(out+'/'+file),path.join(source,'api/lib/barkpark/media/image_backend.ex'),expect];
 const cmd=path.resolve(out+'/'+expect+'.cmd'),log=out+'/'+expect+'.log';
 fs.writeFileSync(cmd,'@echo off\r\nsetlocal DisableDelayedExpansion\r\ncall '+argv.map(a=>'"'+a+'"').join(' ')+'\r\nexit /b %errorlevel%\r\n');
 const fd=fs.openSync(log,'wx');let r;try{r=spawnSync('cmd.exe',['/d','/s','/c','""'+cmd+'""'],{env:{...process.env,PATH:tools.erlangBin+';'+process.env.PATH},windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore',fd,fd],timeout:30000});}finally{fs.closeSync(fd);}
 const text=fs.readFileSync(log,'utf8'),count=/compiler_errors=(\d+) image_available=false/.exec(text);
 runs.push({file,expect,exitCode:r.status,error:r.error?.message,compilerErrors:count?Number(count[1]):null,passed:r.status===0&&!r.error&&count!==null&&(expect==='error'?Number(count[1])>0:Number(count[1])===0)});
}
const passed=runs.every(r=>r.passed);
fs.writeFileSync(out+'/result.json',JSON.stringify({status:passed?'passed':'failed',elapsedMs:Date.now()-start,source:'bf824f8c25264065d8a79dd5dbb39ab46df4a507',runs,originalCompilerErrorWithoutVix:passed,repairedCompiledWithoutVix:passed,scope:'Separate compiler diagnostic processes with optional Vix absent; full Windows build/native and hosted tests remain separate'},null,2)+'\n');console.log(JSON.stringify({status:passed?'passed':'failed',elapsedMs:Date.now()-start}));if(!passed)process.exitCode=1;
