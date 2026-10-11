import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const { systemRoot, systemTool, powershell, nativePath }=require('../main/windows-system-tools');
const {externalResource}=require('../main/external-resource');
test('Windows system tools and contained batch execution do not require developer PATH', {skip:process.platform!=='win32',timeout:300000},async()=>{
  assert.ok(path.isAbsolute(powershell()));assert.ok(fs.existsSync(powershell()));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown wrapper Chø '));
  const bin=path.join(root,'owned batch.cmd');fs.writeFileSync(bin,'@echo off\r\necho owned-wrapper-marker\r\nexit /b 7\r\n');
  const env={SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),PATH:[systemTool(''),systemRoot()].join(';'),PATHEXT:'.COM;.EXE;.BAT;.CMD',TEMP:root,TMP:root,BARKDOWN_RELEASE_MODE:'migrate',BARKDOWN_RELEASE_BIN:bin};
  const diagnostics={host:process.platform,os:os.release(),cases:[],scope:'Disposable batch and actual contained launcher; no environment values or credentials recorded.'};
  const report=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../test-results/windows-runtime-wrapper',new Date().toISOString().replace(/[:.]/g,'-')+'.json');
  const launch=(name,completionMs,{observeStart=false,startupMs=60000}={})=>new Promise(resolve=>{
    const started=Date.now();
    const child=spawn(powershell(),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',externalResource('local-barkpark-launch.ps1')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',error,observedAt=null,timeoutPhase=null;
    const expire=phase=>{timeoutPhase=phase;error=Object.assign(new Error('Contained launch exceeded '+phase+' deadline'),{code:'ETIMEDOUT'});child.kill('SIGTERM');};
    let timer=setTimeout(()=>expire(observeStart?'startup':'completion'),observeStart?startupMs:completionMs);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',data=>{
      stdout+=data;
      if(observeStart&&!error&&observedAt===null&&stdout.includes('owned-wrapper-start-marker')){
        observedAt=Date.now();clearTimeout(timer);timer=setTimeout(()=>expire('completion'),completionMs);
      }
    });
    child.stderr.on('data',data=>{stderr+=data;});
    child.once('error',value=>{error=value;});
    child.once('close',(status,signal)=>{
      clearTimeout(timer);
      const result={status,signal,error,stdout,stderr};
      diagnostics.cases.push({name,startupBudgetMs:observeStart?startupMs:null,completionBudgetMs:completionMs,elapsedMs:Date.now()-started,startObservedMs:observedAt===null?null:observedAt-started,afterStartMs:observedAt===null?null:Date.now()-observedAt,status,signal,errorCode:error?.code||null,timeoutPhase,startMarker:stdout.includes('owned-wrapper-start-marker'),exitMarker:stdout.includes('owned-wrapper-marker'),stderr});
      resolve(result);
    });
  });
  try {
    // This is an execution/containment assertion, not a 15-second startup SLO.
    // Hosted run37751444169 exhausted that old cap without preserving spawn errors.
    // Keep one bounded attempt and exact exit/output checks; no retry or product budget changes.
    const result=await launch('ordinary',60000);
    assert.equal(result.error,undefined,JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(result.status,7,result.stderr);assert.match(result.stdout,/owned-wrapper-marker/);
    const effect=path.join(root,'completion.txt');env.BARKDOWN_TEST_EFFECT=effect;
    // Separate launcher startup from the deliberately slow contained work. Hosted
    // run37756099491 observed 31.5s startup, so a wall timer can expire before spawn.
    // A real pre-marker delay also proves the completion timer starts at the marker.
    fs.writeFileSync(bin,'@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "Start-Sleep -Milliseconds 2000"\r\necho owned-wrapper-start-marker\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "Start-Sleep -Milliseconds 16000"\r\necho completed> "%BARKDOWN_TEST_EFFECT%"\r\necho owned-wrapper-marker\r\nexit /b 7\r\n');
    const timed=await launch('controlled-old-cap',15000,{observeStart:true});
    assert.equal(timed.error?.code,'ETIMEDOUT',JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(timed.status,null);assert.match(timed.stdout,/owned-wrapper-start-marker/);
    assert.equal(diagnostics.cases.at(-1).timeoutPhase,'completion');
    assert.ok(diagnostics.cases.at(-1).startObservedMs>=2000);
    assert.ok(diagnostics.cases.at(-1).afterStartMs>=15000);
    assert.doesNotMatch(timed.stdout,/owned-wrapper-marker/);
    // Give the killed contained child enough time to have produced the delayed effect
    // if it escaped ownership. Preserve the fixture rather than deleting a success marker.
    await new Promise(resolve=>setTimeout(resolve,3000));
    assert.equal(fs.existsSync(effect),false,'timeout cannot leave the contained delayed child writing');
    const delayed=await launch('controlled-sufficient-budget',60000,{observeStart:true});
    assert.equal(delayed.error,undefined,JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(delayed.status,7,delayed.stderr);assert.match(delayed.stdout,/owned-wrapper-marker/);
    assert.ok(diagnostics.cases.at(-1).afterStartMs>=16000,'actual delayed work completed');
    assert.equal(fs.readFileSync(effect,'utf8').trim(),'completed');
    const alias=nativePath(root),original=fs.statSync(root,{bigint:true}),resolved=fs.statSync(alias,{bigint:true});
    assert.match(alias,/^[\x20-\x7e]+$/);assert.equal(resolved.ino,original.ino);assert.equal(resolved.dev,original.dev);
    assert.equal(nativePath(root),alias,'cached alias keeps the same file identity');assert.equal(nativePath(systemRoot()),systemRoot());
    diagnostics.status='passed';
  } finally {
    diagnostics.status||='failed';
    if (diagnostics.status==='failed' && diagnostics.cases.length) {
      // Diagnose a failed -File assertion; this separate debugger invocation can
      // never satisfy the ordinary assertion or become a retry. Static phase tags
      // distinguish host entry, debugger setup, invocation, compilation and dispatch.
      // The diagnostic itself can stall before the script: retain both sides of setup.
      const script=externalResource('local-barkpark-launch.ps1');
      const lines=fs.readFileSync(script,'utf8').split('\n');
      const phases=[['compile-entered',"Add-Type -TypeDefinition"],['compile-completed',"[BarkdownRuntimeJob]::Contain()"],['contained',"if ($env:BARKDOWN_RELEASE_MODE)"],['dispatch',"'migrate' {"]];
      const breakpoints=phases.map(([name,text])=>{
        const line=lines.findIndex(l=>l.includes(text))+1;
        if(!line)throw new Error('Launcher diagnostic phase missing: '+name);
        return "[Console]::Error.WriteLine('wrapper-phase:breakpoint-"+name+"-entered'); "+
          'Set-PSBreakpoint -Script $env:BARKDOWN_TEST_LAUNCH_SCRIPT -Line '+line+" -Action { [Console]::Error.WriteLine('wrapper-phase:"+name+"') } | Out-Null; "+
          "[Console]::Error.WriteLine('wrapper-phase:breakpoint-"+name+"-completed')";
      });
      const command=["[Console]::Error.WriteLine('wrapper-phase:powershell-entered')",...breakpoints,
        "[Console]::Error.WriteLine('wrapper-phase:script-invocation-entered')",'& $env:BARKDOWN_TEST_LAUNCH_SCRIPT',
        "[Console]::Error.WriteLine('wrapper-phase:script-invocation-completed')",'exit $LASTEXITCODE'].join('; ');
      const started=Date.now();
      const probe=spawnSync(powershell(),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',command],{env:{...env,BARKDOWN_TEST_LAUNCH_SCRIPT:script},windowsHide:true,encoding:'utf8',timeout:15000});
      diagnostics.failureProbe={case:diagnostics.cases.at(-1).name,scope:'Separate 15-second -Command/debugger diagnostic after failed -File assertion; never acceptance or retry',elapsedMs:Date.now()-started,status:probe.status,signal:probe.signal,errorCode:probe.error?.code||null,stdout:probe.stdout||'',stderr:probe.stderr||'',phases:(probe.stderr||'').split(/\r?\n/).filter(l=>l.startsWith('wrapper-phase:'))};
    }
    fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify(diagnostics,null,2)+'\n');
  }
});
