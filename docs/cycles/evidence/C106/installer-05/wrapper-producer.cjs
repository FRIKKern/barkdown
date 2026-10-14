const fs=require('fs'),{spawnSync}=require('child_process');
const original='C:/Users/Frikk/Documents/GitHub/barkdown',root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown';
const log=original+'/.git/C106-installer-build-05.log',fd=fs.openSync(log,'wx'),start=Date.now();
const r=spawnSync(process.execPath,['scripts/build-windows-app.mjs',original+'/runtime/barkpark-944a57a1-win32-x64-release-05',original+'/.git/C106 NSIS Chø 05',root+'/docs/cycles/evidence/C098/carried-package-03/runtime-inventory.json'],{cwd:root,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
const receipt={at:new Date().toISOString(),exitCode:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-start,log,output:original+'/.git/C106 NSIS Chø 05',source:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Actual unsigned NSIS assembly; no application install/uninstall or real profile'};
fs.writeFileSync(original+'/.git/C106-installer-build-05.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));process.exitCode=r.status===0?0:1;
