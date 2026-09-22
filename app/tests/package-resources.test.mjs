// Actual packaged archive/native-file inventory. Does not launch Electron or a runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),asar=require('@electron/asar');
const {externalResource}=require('../main/external-resource');
const archive=path.resolve('release/win-unpacked/resources/app.asar');
const report={archive,checks:[],scope:'Static packaged bytes and real external PowerShell verifier loading only; no Electron/runtime launched.'};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const file of ['shared/markdown.js','shared/portabledoc.js','shared/table-edits.js']) {
 const expected=fs.readFileSync(file),actual=asar.extractFile(archive,file);assert.deepEqual(actual,expected);report.checks.push({file,sha256:hash(actual),status:'pass'});
}
for(const name of ['goal-worker-host.ps1','local-barkpark-launch.ps1','local-barkpark-boot.exs']) {
 const physical=externalResource(name,path.join(archive,'main'));const actual=fs.readFileSync(physical);assert.deepEqual(actual,fs.readFileSync(path.join('main',name)));report.checks.push({file:name,physical,sha256:hash(actual),status:'pass'});
}
const helper=externalResource('goal-worker-host.ps1',path.join(archive,'main'));
const probe={jobName:'Local\\BarkdownPackageProbe-'+crypto.randomUUID(),helperPid:2147483647,helperStarted:'0',phase:'prepared'};
const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Verify'],{input:JSON.stringify(probe)+'\n',encoding:'utf8',windowsHide:true,timeout:30000});
assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'true');report.verifier={exitCode:r.status,stdout:r.stdout.trim(),note:'Synthetic absent-job query proves packaged PS1 executable/readable; not real job teardown proof.'};
const target=process.env.BARKDOWN_PACKAGE_REPORT;if(target)fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log('PASS packaged shared/native resource bytes and actual PowerShell -File loading');
