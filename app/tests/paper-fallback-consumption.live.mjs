import { openFixturePaper } from './lib/paper-fixture.mjs';
// E011 preparation: real Paper transport with only editor JS/CSS refused.
// Adapted from E010 fixture88358f9; E012 replay binds the reviewed bf23f773c vendor consumption.
// Native upload delivery race and server assertions are preserved; no fake saves.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { startEditorAssetProxy, refusedEditorAssets } from './helpers/editor-asset-proxy.mjs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1')throw Error('Use the isolated source-runtime wrapper.');
const bp=(args,input)=>JSON.parse(execFileSync('bp',[...args,'-o','json'],{shell:true,encoding:'utf8',maxBuffer:20e6,...(input==null?{stdio:['ignore','pipe','pipe']}:{input})}));
for(const [id,title] of [['barkdown','Barkdown'],['scratch','Scratch']]){
 bp(['doc','create-or-replace','tag','--set',`_id=${id}`,'--set',`title=${title}`]);bp(['doc','publish','tag',id]);
}
const slug='editor-fallback-consumption';
const seed=[{type:'heading',level:1,text:'Image uploads survive Undo'},{type:'paragraph',content:[{type:'text',value:'Human text stays.'}]},{type:'paragraph',content:[{type:'text',value:'This surrounding paragraph must survive.'}]}];
bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:'Image uploads survive Undo',description:'Disposable real Paper clipboard policy, host media uploads, native history and acknowledged reload proof.',tags:[{tag:'barkdown',strength:90,rationale:'owned clipboard regression'},{tag:'scratch',strength:40,rationale:'disposable clipboard fixture'}],blocks:seed}));
const capture=process.env.BARKDOWN_EDITOR_CAPTURE==='1';
const out=path.resolve((capture?'../docs/visual/fallback-consumption/runs/':'test-results/paper-fallback-consumption/')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-upload-history-'));
const proxy=await startEditorAssetProxy(process.env.BARKDOWN_SHOTS_SERVER);
let app;
const launch=()=>electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const read=()=>{const r=bp(['doc','get','paper',slug,'--perspective','raw']);return r.document||r;};
const htmlImage='<img src="https://clipboard-original.invalid/image.png" alt="Copied diagram">';
const htmlTable='<table><tr><td>Important table text</td></tr></table>';
let page,video,editorBundle;const results=[],externalRequests=[];
try{
 app=await launch();
 page=await app.firstWindow();video=page.video();await page.route('https://clipboard-original.invalid/**',route=>{externalRequests.push(route.request().url());return route.abort();});
 await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});
 await page.evaluate(async ({server,token})=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:false,writes:true,server,token}});await window.__barkdown.refreshLibrary();},{server:proxy.url,token:process.env.BARKPARK_API_TOKEN});
 await openFixturePaper(page, slug);await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 editorBundle=await page.evaluate(()=>window.__barkdown.state.canvasBundle);
 assert.equal(editorBundle.source,'vendored');
 const expectedJs='3a94a2964b37358f3ec791f009a2f52b28cffb0d';
 const expectedCss='38197e09d17efc468a3dc875dbd59571e3aeb7c8';
 const loaded=await page.evaluate(()=>({js:document.querySelector('script[data-canvas-bundle]')?.src,css:document.querySelector('link[data-canvas-bundle]')?.href}));
 for(const [kind,expected] of [['js',expectedJs],['css',expectedCss]]){
  const actual=fileURLToPath(loaded[kind]);const vendor=path.resolve('renderer/vendor',kind==='js'?'bp-paper-editor.bundle.js':'bp-paper-editor.css');
  assert.equal(path.resolve(actual).toLowerCase(),vendor.toLowerCase());
  assert.equal(require('crypto').createHash('sha1').update(fs.readFileSync(actual)).digest('hex'),expected);
 }
 assert.equal(editorBundle.sha,expectedJs);
 assert.equal(fs.existsSync(path.join(userData,'canvas-bundle/current.json')),false,'fresh fallback must not create a successful server cache');
 for(const asset of refusedEditorAssets)assert.ok(proxy.counts.refused[asset]>0,asset);


 const snapshot=()=>page.evaluate(()=>document.querySelector('bp-paper-canvas').recoverySnapshot().blocks);
 const clean=()=>page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');const host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));return c&&host&&!host.isDirty()&&!c.hasPendingChanges();},null,{timeout:45000});
 const saved=async rev=>{await page.waitForFunction(rev=>{const c=document.querySelector('bp-paper-canvas'),host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));return c&&host&&!host.isDirty()&&!c.hasPendingChanges()&&Number(document.querySelector('.bw-paper-pane #save-state')?.textContent?.match(/Saved · rev (\d+)/)?.[1])>rev;},rev,{timeout:45000});const paper=read();assert.deepEqual(await snapshot(),paper.blocks);return paper;};
 await page.evaluate(()=>{const c=document.querySelector('bp-paper-canvas'),original=c.mediaUploader;window.__uploadHistory={calls:0};c.mediaUploader=async file=>{window.__uploadHistory.calls++;const result=await original(file);window.__uploadHistory.result=result;return new Promise(resolve=>{window.__uploadHistory.release=()=>resolve(result);});};});
 const initial=read();await page.locator('.ProseMirror > p').first().click();await page.keyboard.press('End');
 await page.evaluate(async()=>{const raster=document.createElement('canvas');raster.width=150;raster.height=72;const g=raster.getContext('2d');g.fillStyle='#bedc98';g.fillRect(0,0,150,72);g.fillStyle='#203018';g.font='15px sans-serif';g.fillText('Real uploaded image',7,39);const blob=await new Promise(resolve=>raster.toBlob(resolve,'image/png'));const data=new DataTransfer();data.items.add(new File([blob],'history.png',{type:'image/png'}));document.querySelector('bp-paper-canvas')._editor.view.dom.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>typeof window.__uploadHistory.release==='function');await page.screenshot({path:path.join(out,'01-upload-pending.png')});
 await page.keyboard.press('Control+z');await clean();assert.deepEqual(await snapshot(),initial.blocks);assert.deepEqual(read().blocks,initial.blocks);await page.screenshot({path:path.join(out,'02-undo-before-delivery.png')});
 await page.evaluate(()=>window.__uploadHistory.release());await page.waitForTimeout(100);assert.deepEqual(await snapshot(),initial.blocks);
 const revBeforeRedo=read().rev;await page.keyboard.press('Control+Shift+z');const restored=await saved(revBeforeRedo);assert.equal(restored.blocks.filter(b=>b.type==='image').length,1);assert.ok(restored.blocks.find(b=>b.type==='image').src);assert.equal(await page.evaluate(()=>window.__uploadHistory.calls),1);assert.equal(await page.locator('.bp-canvas-image-badge:visible').count(),0);await page.screenshot({path:path.join(out,'03-redo-acknowledged-image.png')});
 let current=restored;for(let i=0;i<2;i++){await page.keyboard.press('Control+z');const undone=await saved(current.rev);assert.deepEqual(undone.blocks,initial.blocks);await page.keyboard.press('Control+Shift+z');current=await saved(undone.rev);assert.equal(current.blocks.find(b=>b.type==='image').src,restored.blocks.find(b=>b.type==='image').src);assert.equal(await page.evaluate(()=>window.__uploadHistory.calls),1);}
 await page.locator('.ProseMirror > p').first().click();await page.keyboard.press('End');await page.keyboard.type(' Next human edit.');const human=await saved(current.rev);assert.ok(JSON.stringify(human.blocks).includes('Human text stays. Next human edit.'));await page.screenshot({path:path.join(out,'04-human-saved.png')});
 await page.evaluate(()=>document.querySelector('bp-paper-canvas').__e010=true);await page.locator('.bw-paper-pane button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');return c&&!c.__e010&&c._editor;});assert.deepEqual(await snapshot(),human.blocks);await page.waitForFunction(()=>{const images=[...document.querySelectorAll('bp-paper-canvas .bp-canvas-image img')];return images.length===1&&images.every(i=>i.complete&&i.naturalWidth>0);});await page.screenshot({path:path.join(out,'05-reloaded.png')});await page.setViewportSize({width:900,height:900});await page.screenshot({path:path.join(out,'06-narrow.png')});
 results.push({name:'actual upload completion during Undo, repeated Redo and saved human reload',revisions:{initial:initial.rev,restored:restored.rev,human:human.rev},blocks:human.blocks});fs.writeFileSync(path.join(out,'server.json'),JSON.stringify(human,null,2));console.log('E011 real Paper upload history/reload passed');
}catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{
 try { if(app)await app.close(); } finally { await proxy.close(); } if(video){const f=await video.path();if(fs.existsSync(f))fs.renameSync(f,path.join(out,'fallback-consumption.webm'));}
 const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm)$/.test(f)||f==='server.json').map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','.'],{encoding:'utf8'}).trim()!=='',barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,editorBundle,proxy:{refused:proxy.counts.refused,forwarded:proxy.counts.forwarded},expectedVendorCommit:'bf23f773ce59ef148a6e6eeb1374f64d9e2aa81f',results,artifacts,motion:'Actual Paper host media upload with response delivery held at the uploader boundary, native history keys and real server assertions. No fabricated save acknowledgement; response delay is controlled race coverage.'},null,2)+'\n');console.log('E011 evidence:',out);
}
