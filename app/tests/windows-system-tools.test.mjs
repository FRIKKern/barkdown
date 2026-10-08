import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const { systemRoot, systemTool, powershell, nativePath }=require('../main/windows-system-tools');
const {externalResource}=require('../main/external-resource');
test('Windows system tools and contained batch execution do not require developer PATH', {skip:process.platform!=='win32',timeout:180000},()=>{
  assert.ok(path.isAbsolute(powershell()));assert.ok(fs.existsSync(powershell()));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown wrapper Chø '));
  const bin=path.join(root,'owned batch.cmd');fs.writeFileSync(bin,'@echo off\r\necho owned-wrapper-marker\r\nexit /b 7\r\n');
  const env={SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),PATH:[systemTool(''),systemRoot()].join(';'),PATHEXT:'.COM;.EXE;.BAT;.CMD',TEMP:root,TMP:root,BARKDOWN_RELEASE_MODE:'migrate',BARKDOWN_RELEASE_BIN:bin};
  const diagnostics={host:process.platform,os:os.release(),cases:[],scope:'Disposable batch and actual contained launcher; no environment values or credentials recorded.'};
  const report=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../test-results/windows-runtime-wrapper',new Date().toISOString().replace(/[:.]/g,'-')+'.json');
  const launch=(name,timeout)=>{
    const started=Date.now();
    const result=spawnSync(powershell(),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',externalResource('local-barkpark-launch.ps1')],{env,windowsHide:true,encoding:'utf8',timeout});
    diagnostics.cases.push({name,timeoutMs:timeout,elapsedMs:Date.now()-started,status:result.status,signal:result.signal,errorCode:result.error?.code||null,startMarker:result.stdout?.includes('owned-wrapper-start-marker')||false,exitMarker:result.stdout?.includes('owned-wrapper-marker')||false,stderr:result.stderr||''});
    return result;
  };
  try {
    // This is an execution/containment assertion, not a 15-second startup SLO.
    // Hosted run37751444169 exhausted that old cap without preserving spawn errors.
    // Keep one bounded attempt and exact exit/output checks; no retry or product budget changes.
    const result=launch('ordinary',60000);
    assert.equal(result.error,undefined,JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(result.status,7,result.stderr);assert.match(result.stdout,/owned-wrapper-marker/);
    const effect=path.join(root,'completion.txt');env.BARKDOWN_TEST_EFFECT=effect;
    fs.writeFileSync(bin,'@echo off\r\necho owned-wrapper-start-marker\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "Start-Sleep -Milliseconds 16000"\r\necho completed> "%BARKDOWN_TEST_EFFECT%"\r\necho owned-wrapper-marker\r\nexit /b 7\r\n');
    const timed=launch('controlled-old-cap',15000);
    assert.equal(timed.error?.code,'ETIMEDOUT',JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(timed.status,null);assert.match(timed.stdout,/owned-wrapper-start-marker/);
    assert.doesNotMatch(timed.stdout,/owned-wrapper-marker/);
    // Give the killed contained child enough time to have produced the delayed effect
    // if it escaped ownership. Preserve the fixture rather than deleting a success marker.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);
    assert.equal(fs.existsSync(effect),false,'timeout cannot leave the contained delayed child writing');
    const delayed=launch('controlled-sufficient-budget',60000);
    assert.equal(delayed.error,undefined,JSON.stringify(diagnostics.cases.at(-1)));
    assert.equal(delayed.status,7,delayed.stderr);assert.match(delayed.stdout,/owned-wrapper-marker/);
    assert.ok(diagnostics.cases.at(-1).elapsedMs>=16000,'actual delayed work completed');
    assert.equal(fs.readFileSync(effect,'utf8').trim(),'completed');
    diagnostics.status='passed';
  } finally {
    diagnostics.status||='failed';fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify(diagnostics,null,2)+'\n');
  }
  const alias=nativePath(root),original=fs.statSync(root,{bigint:true}),resolved=fs.statSync(alias,{bigint:true});
  assert.match(alias,/^[\x20-\x7e]+$/);assert.equal(resolved.ino,original.ino);assert.equal(resolved.dev,original.dev);
  assert.equal(nativePath(root),alias,'cached alias keeps the same file identity');assert.equal(nativePath(systemRoot()),systemRoot());
});
