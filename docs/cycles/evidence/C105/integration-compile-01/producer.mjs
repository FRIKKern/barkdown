import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const out='docs/cycles/evidence/C105/integration-compile-01';fs.mkdirSync(out);
fs.copyFileSync('.git/c105-owner-compile.mjs',out+'/producer.mjs');fs.copyFileSync('.git/c105-owner-compile.exs',out+'/compile.exs');
const pkg=JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/pty-package-build-01/result.json'));
const source=path.resolve('../barkpark-windows-media-delete'),release=path.join(pkg.out,'win-unpacked/resources/runtime');
const script=path.resolve(out,'compile.exs'),ebin=path.resolve(out,'ebin');
const cmd=path.resolve('.git/c105-owner-compile.cmd');fs.writeFileSync(cmd,'@echo off\r\ncall "'+path.resolve('.git/elixir-1.19.5/bin/elixir.bat')+'" "'+script+'" "'+release+'" "'+source+'" "'+ebin+'"\r\nexit /b %errorlevel%\r\n');
const env={...process.env,PATH:'C:\\Users\\Frikk\\scoop\\apps\\erlang\\current\\bin;'+process.env.PATH};
const fd=fs.openSync(out+'/compile.log','wx'),started=Date.now();let r;try{r=spawnSync('cmd.exe',['/d','/c',cmd],{env,windowsHide:true,stdio:['ignore',fd,fd],timeout:120000});}finally{fs.closeSync(fd);}
const files=['api/lib/barkpark/media/storage/delete_operation.ex','api/lib/barkpark/tenancy/workspace_bundle/catalog.ex','api/lib/barkpark/tenancy/workspace_bundle.ex','api/test/barkpark/media/pending_delete_boundary_test.exs','api/test/barkpark/media/media_pending_delete_interrupt_live.exs'];
const report={status:r.status===0&&!r.error&&!r.signal?'passed':'failed',startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,exitCode:r.status,signal:r.signal,error:r.error?.message,toolchain:'Elixir1.19.5/installedOTP28; not CI OTP27',files:files.map(f=>({file:f,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,f))).digest('hex')})),limits:['Changed owner modules compile against carried dependencies; not full current-main build','New ExUnit tests parsed, not executed by this check; complete tests must run in upstream CI','App pin and runtime payload unchanged']};
fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status==='failed')process.exitCode=1;
