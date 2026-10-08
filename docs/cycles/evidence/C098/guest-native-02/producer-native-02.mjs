import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const out='docs/cycles/evidence/C098/guest-native-02',start=Date.now();fs.mkdirSync(out);
for(const file of ['.git/c098-guest-native-02.mjs','.git/c098-guest-capability-01.ps1'])fs.copyFileSync(file,out+'/'+path.basename(file).replace('c098-guest-','producer-'));
const fd=fs.openSync(out+'/native.log','wx');let child;
try{child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('.git/c098-guest-capability-01.ps1'),'-Output',path.resolve(out+'/native.json')],{cwd:path.resolve(out),windowsHide:true,timeout:60000,stdio:['ignore',fd,fd],env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:'C:/Windows/System32',TEMP:process.env.TEMP,TMP:process.env.TMP,PSModuleAnalysisCachePath:path.resolve(out+'/ModuleAnalysisCache')}});}finally{fs.closeSync(fd);}
const execution={exitCode:child.status,signal:child.signal,error:child.error?.message||null,elapsedMs:Date.now()-start};fs.writeFileSync(out+'/execution.json',JSON.stringify(execution,null,2)+'\n');
if(child.status!==0||child.error||child.signal)throw Error('Native capability collection failed, retained');
const result=JSON.parse(fs.readFileSync(out+'/native.json'));fs.writeFileSync(out+'/source.json',JSON.stringify(['.git/c098-guest-native-02.mjs','.git/c098-guest-capability-01.ps1'].map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}),null,2)+'\n');
console.log(JSON.stringify({execution,...result}));
