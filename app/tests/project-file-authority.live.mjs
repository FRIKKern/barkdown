// Actual Electron and main IPC, with one explicit transport acknowledgement barrier.
// Requires the coordinator's named input window; all files/user data are disposable.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-file-authority-ui-'));
const folder=path.join(root,'files'), userData=path.join(root,'user-data');fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder,'a.md'),'A original');fs.writeFileSync(path.join(folder,'b.md'),'B original');
const out=process.env.BARKDOWN_FILE_AUTHORITY_OUT||path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','app'],{encoding:'utf8'}).trim()!=='',root,frames:[],passed:false,stopped:false,scope:'Actual Electron CodeMirror/files IPC; delayed acknowledgement is a fixture barrier after a real disk write.'};
let app,page;
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});report.frames.push(name+'.png')};
const open=async file=>page.evaluate(file=>window.__barkdown.openTarget({kind:'project',path:file}),file);
const editor=()=>page.locator('.bw-pane:not([hidden]) .cm-content');
try {
 app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),'--profiles',`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:''}});
 page=await app.firstWindow();await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});
 await page.evaluate(folder=>window.__barkdown.setFolder(folder),folder);await open('a.md');await editor().waitFor();await editor().fill('A human draft');await shot('01-draft');
 await open('missing.md');await page.getByText('File unavailable · other unsaved drafts are preserved',{exact:true}).waitFor();
 await page.getByText('This file or its working folder is no longer available.',{exact:true}).waitFor();
 assert.equal(await editor().count(),0);assert.equal(await page.locator('.bw-pane:not([hidden]) [data-act="save"]').isDisabled(),true);await shot('02-unavailable');
 assert.equal(fs.existsSync(path.join(folder,'missing.md')),false);assert.equal(fs.readFileSync(path.join(folder,'a.md'),'utf8'),'A original');
 await page.getByRole('button',{name:'Return to a.md',exact:true}).click();await editor().waitFor();assert.equal(await editor().innerText(),'A human draft');await shot('03-draft-restored');
 // Install a barrier around the real writer. It changes response timing only.
 await app.evaluate(({app})=>{const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');const files=req('./main/files');const original=files.write;globalThis.authorityFixture={writes:[]};files.write=async(...args)=>{const result=original(...args);globalThis.authorityFixture.writes.push({root:args[0],file:args[1],text:args[2]});await new Promise(resolve=>globalThis.authorityFixture.release=resolve);return result};globalThis.authorityFixture.restore=()=>files.write=original});
 await editor().click();await page.keyboard.press('Control+s');
 for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.authorityFixture.release)))break;await new Promise(r=>setTimeout(r,20))}
 assert.equal(await app.evaluate(()=>Boolean(globalThis.authorityFixture.release)),true);
 await editor().fill('A newer human draft');await open('b.md');await editor().waitFor();assert.equal(await editor().innerText(),'B original');
 await app.evaluate(()=>globalThis.authorityFixture.release());
 await open('a.md');await editor().waitFor();await page.waitForFunction(()=>!document.querySelector('.bw-pane:not([hidden]) [data-act="save"]').disabled);
 assert.equal(await editor().innerText(),'A newer human draft');assert.equal(fs.readFileSync(path.join(folder,'a.md'),'utf8'),'A human draft');assert.equal(fs.readFileSync(path.join(folder,'b.md'),'utf8'),'B original');await shot('04-newer-draft-retained');
 report.delayedWrites=await app.evaluate(()=>globalThis.authorityFixture.writes);assert.deepEqual(report.delayedWrites,[{root:folder,file:'a.md',text:'A human draft'}]);await app.evaluate(()=>globalThis.authorityFixture.restore());
 await editor().click();await page.keyboard.press('Control+s');await page.getByText('a.md · saved',{exact:true}).waitFor();assert.equal(fs.readFileSync(path.join(folder,'a.md'),'utf8'),'A newer human draft');await shot('05-explicit-latest-save');
 fs.unlinkSync(path.join(folder,'a.md'));await editor().fill('Retained after disk removal');await editor().click();await page.keyboard.press('Control+s');await page.getByRole('button',{name:'Recreate',exact:true}).waitFor();await shot('06-explicit-recreation');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(fs.existsSync(path.join(folder,'a.md')),false);assert.equal(await editor().innerText(),'Retained after disk removal');
 await open('missing.md');await page.setViewportSize({width:736,height:900});await page.getByText('File unavailable · other unsaved drafts are preserved',{exact:true}).waitFor();await page.getByText('This file or its working folder is no longer available.',{exact:true}).waitFor();await shot('07-narrow-unavailable');
 report.finalFiles={missingExists:fs.existsSync(path.join(folder,'missing.md')),deletedAExists:fs.existsSync(path.join(folder,'a.md')),b:fs.readFileSync(path.join(folder,'b.md'),'utf8')};
 report.passed=true;console.log('PASS actual project file identity, missing reference, delayed save, newer draft and explicit deleted-file recovery');
} catch(error){report.error=error.stack;if(page&&!page.isClosed())await shot('failure').catch(()=>{});throw error}
finally {if(app){await app.evaluate(()=>{globalThis.authorityFixture?.release?.();globalThis.authorityFixture?.restore?.()}).catch(()=>{});await app.close();report.stopped=true}fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log('Evidence:',out)}
