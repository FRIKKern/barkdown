// Actual Paper split identities, subsequent edits, native history and reload.
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {publishFixture,getPaper} from './lib/paper-fixture.mjs';
const require=createRequire(import.meta.url);
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1')throw Error('Use the private source-runtime wrapper.');
const slug='stable-native-split';
const out=path.resolve((process.env.BARKDOWN_EDITOR_CAPTURE==='1'?'../docs/visual/block-identity/runs/':'test-results/block-identity/')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-block-identity-'));
const checklistOnly=process.env.BARKDOWN_IDENTITY_CHECKLIST_ONLY==='1';
const seed=checklistOnly?[{id:'checklist',type:'list',ordered:false,task:true,items:[{checked:false,content:[{type:'text',value:'Checklist intent'}]}]},{id:'reference',type:'paragraph',content:[{type:'text',value:'Unrelated reference'}]}]:[{id:'origin',type:'paragraph',content:[{type:'text',value:'Before after'}]},{id:'reference',type:'paragraph',content:[{type:'link',href:'https://example.org/#origin',children:[{type:'text',value:'Reference stays'}]}]}];
publishFixture({slug,title:'Stable native split identities',description:'Disposable real native paragraph split, stable block identity, subsequent edit and reload proof.',blocks:seed});
let app,page,video,bundle;const results=[],acknowledgements=[],keyboard=[];
const read=()=>getPaper(slug);
const snap=()=>page.evaluate(()=>document.querySelector('bp-paper-canvas').recoverySnapshot().blocks);
async function saved(previous){
 await page.waitForFunction(rev=>{const c=document.querySelector('bp-paper-canvas'),h=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));return c&&h&&!h.isDirty()&&!c.hasPendingChanges()&&Number(document.querySelector('.bw-paper-pane #save-state')?.textContent?.match(/Saved · rev (\d+)/)?.[1])>rev;},previous,{timeout:45000});
 const p=read();assert.deepEqual(await snap(),p.blocks,'full server and live identity/content agreement');assert.deepEqual(await snap(),p.blocks,'repeated snapshot identity stability');acknowledgements.push(p);fs.writeFileSync(path.join(out,'acknowledgements.json'),JSON.stringify(acknowledgements,null,2)+'\n');return p;
}
const keyState=()=>page.evaluate(()=>{const c=document.querySelector('bp-paper-canvas'),e=c._editor,s=e.state,h=s.plugins.find(p=>p.key.startsWith('history$'))?.getState(s);return{active:document.activeElement?.outerHTML.slice(0,250),documentFocus:document.hasFocus(),editorFocus:e.isFocused,selection:s.selection.toJSON(),undo:h?.done?.eventCount,redo:h?.undone?.eventCount,keys:window.__identityKeys?.slice(-12),save:document.querySelector('.bw-paper-pane #save-state')?.textContent,blocks:c.recoverySnapshot().blocks};});
try{
 app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
 page=await app.firstWindow();video=page.video();await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(id=>window.__barkdown.openTarget({kind:'doc',id,source:'barkpark',title:id}),slug);await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 bundle=await page.evaluate(()=>window.__barkdown.state.canvasBundle);assert.equal(bundle.source,'server');assert.equal(bundle.sha,'eae19e0b329103611ed8c4046f5fc4eb92cfbbb0');
 await page.evaluate(()=>{window.__identityKeys=[];document.addEventListener('keydown',event=>{const record={key:event.key,ctrl:event.ctrlKey,shift:event.shiftKey,target:event.target.tagName,documentFocus:document.hasFocus()};window.__identityKeys.push(record);queueMicrotask(()=>{record.prevented=event.defaultPrevented;});},true);});
 await page.evaluate(()=>{
  const c=document.querySelector('bp-paper-canvas');window.__identityTrace=[];let context='native';
  const history=()=>{const s=c._editor.state,h=s.plugins.find(p=>p.key.startsWith('history$'))?.getState(s);return{undo:h?.done?.eventCount,redo:h?.undone?.eventCount};};
  for(const name of ['applyServerBlocks','acknowledgeOps','_emitOps','_stampMaterializedIds','_applyExternalContent']){const original=c[name];c[name]=function(...args){const previous=context;context=name;window.__identityTrace.push({kind:'call',name,args:JSON.parse(JSON.stringify(args)),history:history()});try{return original.apply(this,args);}finally{window.__identityTrace.push({kind:'return',name,history:history()});context=previous;}};}
  c._editor.on('transaction',({transaction})=>{window.__identityTrace.push({kind:'transaction',context,steps:transaction.steps.map(s=>s.toJSON()),metaKeys:Object.keys(transaction.meta),addToHistory:transaction.getMeta('addToHistory'),uiEvent:transaction.getMeta('uiEvent'),docChanged:transaction.docChanged,selection:transaction.selection.toJSON(),history:history(),doc:transaction.doc.toJSON()});});
 });
 const initial=read(),pm=page.locator('.bw-paper-pane .ProseMirror');
 if(checklistOnly){
  await pm.locator('ul[data-type="taskList"] input').first().click();const checked=await saved(initial.rev);assert.equal(checked.blocks[0].items[0].checked,true);await page.screenshot({path:path.join(out,'01-checked.png')});
  await pm.locator('ul[data-type="taskList"] p').first().click();keyboard.push({stage:'before-checkbox-undo',state:await keyState()});await page.keyboard.press('Control+z');keyboard.push({stage:'after-checkbox-undo',state:await keyState()});fs.writeFileSync(path.join(out,'keyboard.json'),JSON.stringify(keyboard,null,2)+'\n');
  const undone=await saved(checked.rev);assert.deepEqual(undone.blocks,initial.blocks);await page.screenshot({path:path.join(out,'02-undo.png')});await page.keyboard.press('Control+Shift+z');const redone=await saved(undone.rev);assert.deepEqual(redone.blocks,checked.blocks);await page.screenshot({path:path.join(out,'03-redo.png')});
  results.push({name:'independent seeded checklist native history',revisions:[initial.rev,checked.rev,undone.rev,redone.rev]});
 }else{
 await pm.locator('p').first().click();await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('bp-paper-canvas')._editor.state.selection.from===1);for(let i=0;i<7;i++){await page.keyboard.press('ArrowRight');await page.waitForFunction(pos=>document.querySelector('bp-paper-canvas')._editor.state.selection.from===pos,i+2);}await page.keyboard.press('Enter');
 const split=await saved(initial.rev);assert.equal(split.blocks[0].id,'origin');assert.notEqual(split.blocks[1].id,'origin');assert.deepEqual(split.blocks[2],initial.blocks[1]);assert.equal(split.blocks[0].content[0].value,'Before ');assert.equal(split.blocks[1].content[0].value,'after');
 const ids=split.blocks.map(b=>b.id);assert.equal(new Set(ids).size,3);await page.screenshot({path:path.join(out,'01-split-saved.png')});
 await page.keyboard.type('Human ');const typed=await saved(split.rev);assert.deepEqual(typed.blocks.map(b=>b.id),ids);assert.equal(typed.blocks[1].content[0].value,'Human after');await page.screenshot({path:path.join(out,'02-human-saved.png')});
 await page.keyboard.press('Control+z');const undone=await saved(typed.rev);assert.deepEqual(undone.blocks,split.blocks,'Undo retains the saved child identity');await page.screenshot({path:path.join(out,'03-undo.png')});
 await page.keyboard.press('Control+Shift+z');const redone=await saved(undone.rev);assert.deepEqual(redone.blocks,typed.blocks);await page.screenshot({path:path.join(out,'04-redo.png')});
 await pm.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.type('[ ] checklist');
 const checklist=await saved(redone.rev),list=checklist.blocks.find(b=>b.task===true);assert.ok(list);assert.equal(list.items[0].checked,false);assert.deepEqual(checklist.blocks.find(b=>b.id==='reference'),initial.blocks[1]);await page.screenshot({path:path.join(out,'05-checklist.png')});
 await pm.locator('ul[data-type="taskList"] input').first().click();const checked=await saved(checklist.rev);assert.equal(checked.blocks.find(b=>b.id===list.id).items[0].checked,true);await page.screenshot({path:path.join(out,'06-checked.png')});
 await pm.locator('ul[data-type="taskList"] p').first().click();keyboard.push({stage:'before-checkbox-undo',state:await keyState()});await page.keyboard.press('Control+z');keyboard.push({stage:'after-checkbox-undo',state:await keyState()});fs.writeFileSync(path.join(out,'keyboard.json'),JSON.stringify(keyboard,null,2)+'\n');const checkUndo=await saved(checked.rev);assert.deepEqual(checkUndo.blocks,checklist.blocks);await page.keyboard.press('Control+Shift+z');const final=await saved(checkUndo.rev);assert.deepEqual(final.blocks,checked.blocks);await page.screenshot({path:path.join(out,'07-checklist-redo.png')});
 await page.evaluate(()=>document.querySelector('bp-paper-canvas').__identityOld=true);await page.locator('.bw-paper-pane button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');return c&&!c.__identityOld&&c._editor;});assert.deepEqual(await snap(),final.blocks);await page.screenshot({path:path.join(out,'08-reloaded.png')});await page.setViewportSize({width:900,height:900});await page.screenshot({path:path.join(out,'09-narrow.png')});
 results.push({name:'native split, checklist, subsequent input, Undo/Redo and reload preserve complete server identities',ids,checklistId:list.id,revisions:[initial.rev,split.rev,typed.rev,undone.rev,redone.rev,checklist.rev,checked.rev,checkUndo.rev,final.rev]});fs.writeFileSync(path.join(out,'server.json'),JSON.stringify(final,null,2)+'\n');
}
}catch(e){if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});const state=await keyState().catch(()=>null);fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(state,null,2)+'\n');}fs.writeFileSync(path.join(out,'failure.txt'),e.stack);throw e;}
finally{
 try{if(page){const trace=await page.evaluate(()=>window.__identityTrace||[]).catch(()=>[]);fs.writeFileSync(path.join(out,'transactions.json'),JSON.stringify(trace,null,2)+'\n');}}finally{if(app)await app.close();}
 if(video){const f=await video.path();if(fs.existsSync(f))fs.renameSync(f,path.join(out,'block-identity.webm'));}
 const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm|json)$/.test(f)).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,checklistOnly,bundle,results,artifacts},null,2)+'\n');console.log('E012 evidence:',out);
}
