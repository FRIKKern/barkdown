import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url), files=require('../main/files');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-project-authority-'));
fs.writeFileSync(path.join(root,'a.md'),'A original');
assert.throws(()=>files.tree(path.join(root,'missing-folder')), /ENOENT/, 'missing working folder must not become an empty successful tree');
const bundle=await build({entryPoints:[fileURLToPath(new URL('../renderer/src/tabs/project.js',import.meta.url))],bundle:true,write:false,format:'iife',globalName:'ProjectPane'});
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
const writes=[];
try {
 await page.exposeFunction('readFile',(r,f)=>files.read(r,f));
 await page.exposeFunction('writeFile',(r,f,t,m)=>{writes.push({root:r,file:f,text:t});return files.write(r,f,t,m)});
 await page.setContent('<div id="host"></div><div id="bw-toasts"></div><div id="bw-dialog" hidden></div>');
 await page.evaluate(root=>{window.folder=root;window.barkdown={files:{read:(...a)=>window.readFile(...a),write:(...a)=>window.writeFile(...a),tree:async()=>({name:'Fixture',children:[]})}}},root);
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{window.tab={file:'a.md'};window.pane=ProjectPane.mountProject(window.tab,document.querySelector('#host'),{folder:()=>window.folder,tabChanged(){},isExpanded:()=>false,startFolderChat(){},toggleExpanded(){},userIsEditing(){},dirtyChanged(){},fileSaved(){}})});
 await page.locator('.cm-content').waitFor();await page.locator('.cm-content').fill('A unsaved human text');
 await page.evaluate(()=>window.pane.openFile('missing.md'));
 await page.evaluate(()=>document.querySelector('[data-act="save"]').onclick());

 const result={root,writes,missingCreated:fs.existsSync(path.join(root,'missing.md')),original:fs.readFileSync(path.join(root,'a.md'),'utf8'),selected:await page.evaluate(()=>window.tab.file),visible:await page.locator('.cm-content').count()?await page.locator('.cm-content').innerText():null};
 console.log(JSON.stringify(result,null,2));
 assert.equal(result.missingCreated,false,'failed navigation must never save the previous buffer into the missing destination');
 assert.equal(result.original,'A original','failed navigation must not implicitly save the original');
 fs.writeFileSync(path.join(root,'binary.bin'),Buffer.from([0,1,2]));
 await page.evaluate(()=>window.pane.openFile('binary.bin'));
 assert.equal(await page.locator('.cm-content').count(),0);
 assert.equal(await page.locator('[data-act="save"]').isDisabled(),true);
 assert.deepEqual([...fs.readFileSync(path.join(root,'binary.bin'))],[0,1,2]);
 // Returning to the old file restores its unsaved draft; failed read has no authority.
 await page.getByRole('button',{name:'Return to a.md',exact:true}).click();
 assert.equal(await page.locator('.cm-content').innerText(),'A unsaved human text');
 // Delay acknowledgement after the actual write, then type more and navigate.
 await page.evaluate(()=>{
   const write=window.barkdown.files.write;
   window.barkdown.files.write=async(...args)=>{
     const result=await write(...args);
     await new Promise(resolve=>{window.releaseSave=resolve});return result;
   };
   window.pendingSave=document.querySelector('[data-act="save"]').onclick();
 });
 await page.waitForFunction(()=>typeof window.releaseSave==='function');
 await page.locator('.cm-content').fill('A newer draft during save');
 fs.writeFileSync(path.join(root,'b.md'),'B original');
 await page.evaluate(()=>window.pane.openFile('b.md'));
 await page.evaluate(async()=>{window.releaseSave();await window.pendingSave});
 assert.equal(fs.readFileSync(path.join(root,'a.md'),'utf8'),'A unsaved human text');
 assert.equal(fs.readFileSync(path.join(root,'b.md'),'utf8'),'B original');
 assert.equal(await page.locator('.cm-content').innerText(),'B original');
 await page.evaluate(()=>window.pane.openFile('a.md'));
 assert.equal(await page.locator('.cm-content').innerText(),'A newer draft during save');
 assert.equal(await page.evaluate(()=>ProjectPane.dirtyCount()),1,'newer typing is not falsely acknowledged');
 // A stale read finishing after a newer choice cannot replace that choice.
 fs.writeFileSync(path.join(root,'slow.md'),'Slow file');
 await page.evaluate(()=>{
   const read=window.barkdown.files.read;
   window.barkdown.files.read=async(...args)=>{const result=await read(...args);if(args[1]==='slow.md')await new Promise(resolve=>window.releaseRead=resolve);return result};
   window.pendingRead=window.pane.openFile('slow.md');
 });
 await page.waitForFunction(()=>typeof window.releaseRead==='function');
 await page.evaluate(()=>window.pane.openFile('b.md'));
 await page.evaluate(async()=>{window.releaseRead();await window.pendingRead});
 assert.equal(await page.locator('.cm-content').innerText(),'B original');
 assert.equal(await page.evaluate(()=>window.tab.file),'b.md');
 assert.equal(writes.length,1,'exactly one explicit successful save');
 // Declining an external-change conflict must not authorize the next Save.
 await page.evaluate(()=>{window.barkdown.files.write=(...args)=>window.writeFile(...args)});
 await page.evaluate(()=>window.pane.openFile('a.md'));
 fs.writeFileSync(path.join(root,'a.md'),'Externally changed A');
 const later=new Date(Date.now()+5000);fs.utimesSync(path.join(root,'a.md'),later,later);
 for(let i=0;i<2;i++) {
  await page.evaluate(()=>{window.pendingSave=document.querySelector('[data-act="save"]').onclick()});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.evaluate(()=>window.pendingSave);
  assert.equal(fs.readFileSync(path.join(root,'a.md'),'utf8'),'Externally changed A');
 }
 assert.equal(await page.locator('.cm-content').innerText(),'A newer draft during save');

 // A cached draft is retained, but deleting its disk file requires explicit recreation.
 fs.unlinkSync(path.join(root,'a.md'));
 await page.evaluate(()=>{window.pendingSave=document.querySelector('[data-act="save"]').onclick()});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>window.pendingSave);
 assert.equal(fs.existsSync(path.join(root,'a.md')),false);
 await page.evaluate(()=>{window.pendingSave=document.querySelector('[data-act="save"]').onclick()});
 await page.getByRole('button',{name:'Recreate',exact:true}).click();
 await page.evaluate(()=>window.pendingSave);
 assert.equal(fs.readFileSync(path.join(root,'a.md'),'utf8'),'A newer draft during save');
 assert.throws(()=>files.write(path.join(root,'absent-root'),'new.md','text'),/ENOENT/);
 assert.equal(fs.existsSync(path.join(root,'absent-root')),false,'Save cannot resurrect a missing working folder');
 console.log('PASS failed open, preserved draft, delayed save acknowledgement and stale read authority');

} finally {await browser.close()}
