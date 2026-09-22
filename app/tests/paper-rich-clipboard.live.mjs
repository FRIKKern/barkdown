// Actual Paper clipboard policy, media upload, native history and acknowledged reload.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
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
const slug='editor-rich-clipboard';
const seed=[{type:'heading',level:1,text:'Clipboard content stays yours'},{type:'paragraph',content:[{type:'text',value:'Before selected After'}]},{type:'paragraph',content:[{type:'text',value:'This surrounding paragraph must survive.'}]}];
bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:'Clipboard content stays yours',description:'Disposable real Paper clipboard policy, host media uploads, native history and acknowledged reload proof.',tags:[{tag:'barkdown',strength:90,rationale:'owned clipboard regression'},{tag:'scratch',strength:40,rationale:'disposable clipboard fixture'}],blocks:seed}));
const capture=process.env.BARKDOWN_EDITOR_CAPTURE==='1';
const out=path.resolve((capture?'../docs/visual/rich-clipboard/runs/':'test-results/paper-rich-clipboard/')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-rich-clipboard-'));
const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const read=()=>{const r=bp(['doc','get','paper',slug,'--perspective','raw']);return r.document||r;};
const htmlImage='<img src="https://clipboard-original.invalid/image.png" alt="Copied diagram">';
const htmlTable='<table><tr><td>Important table text</td></tr></table>';
let page,video,editorBundle;const results=[],externalRequests=[];
try{
 page=await app.firstWindow();video=page.video();await page.route('https://clipboard-original.invalid/**',route=>{externalRequests.push(route.request().url());return route.abort();});
 await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(slug=>window.__barkdown.openTarget({kind:'doc',id:slug,source:'barkpark',title:slug}),slug);await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json'),'utf8'));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.server,process.env.BARKDOWN_SHOTS_SERVER);
 const saved=async previous=>{
  await page.waitForFunction(rev=>{const c=document.querySelector('bp-paper-canvas');const host=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));const status=document.querySelector('.bw-paper-pane #save-state')?.textContent||'';return c&&host&&!host.isDirty()&&!c.hasPendingChanges()&&c.recoverySnapshot().blocks.filter(b=>b.type==='image').every(b=>b.src)&&Number(status.match(/Saved · rev (\d+)/)?.[1])>rev;},previous,{timeout:45000});return read();
 };
 const selectWord=()=>page.evaluate(()=>{const e=document.querySelector('bp-paper-canvas')._editor;let at;e.state.doc.descendants((n,p)=>{if(n.type.name==='paragraph'&&n.textContent.startsWith('Before '))at=p;});e.commands.focus();e.commands.setTextSelection({from:at+8,to:at+16});return e.state.selection.toJSON();});
 const paste=payload=>page.evaluate(async p=>{
  const c=document.querySelector('bp-paper-canvas'),data=new DataTransfer();if(p.html)data.setData('text/html',p.html);if(p.text)data.setData('text/plain',p.text);
  if(p.file){const raster=document.createElement('canvas');raster.width=120;raster.height=64;const ctx=raster.getContext('2d');ctx.fillStyle='#bedc98';ctx.fillRect(0,0,120,64);ctx.fillStyle='#25351b';ctx.font='14px sans-serif';ctx.fillText('Clipboard image',8,36);const blob=await new Promise(resolve=>raster.toBlob(resolve,'image/png'));data.items.add(new File([blob],'clipboard.png',{type:'image/png'}));}
  c._editor.view.dom.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 },payload);
 const reject=async payload=>{
  const before=read(),selection=await selectWord();await paste(payload);
  await page.locator('[data-bp-paste-notice]').waitFor();assert.deepEqual(await page.evaluate(()=>document.querySelector('bp-paper-canvas').recoverySnapshot().blocks),before.blocks);
  assert.deepEqual(await page.evaluate(()=>document.querySelector('bp-paper-canvas')._editor.state.selection.toJSON()),selection);
  await page.evaluate(()=>document.querySelector('bp-paper-canvas').flushPendingChanges());assert.equal(read().rev,before.rev);return before;
 };
 const initial=read();await selectWord();await page.screenshot({path:path.join(out,'01-selected.png')});
 await reject({html:htmlImage,text:'Image description'});await page.screenshot({path:path.join(out,'02-image-recovery.png')});await page.keyboard.press('Escape');
 await reject({html:htmlTable,text:'Important table text',file:true});await page.setViewportSize({width:900,height:900});
 await page.keyboard.press('Escape');await reject({html:htmlTable,text:'Important table text',file:true});
 const notice=await page.locator('[data-bp-paste-notice]').boundingBox();assert.ok(notice.x>=0&&notice.x+notice.width<=900&&notice.y>=0&&notice.y+notice.height<=900);await page.screenshot({path:path.join(out,'03-mixed-recovery-narrow.png')});
 await page.keyboard.press('Escape');await page.keyboard.down('Control');await page.keyboard.down('Shift');await paste({html:htmlTable,text:'Plain text',file:true});await page.keyboard.up('Shift');await page.keyboard.up('Control');
 const plain=await saved(initial.rev);assert.ok(JSON.stringify(plain.blocks).includes('Before Plain text After'));assert.equal(plain.blocks.some(b=>b.type==='image'),false);await page.screenshot({path:path.join(out,'04-plain-saved.png')});
 await page.keyboard.press('Control+z');const undone=await saved(plain.rev);assert.deepEqual(undone.blocks,initial.blocks);await page.screenshot({path:path.join(out,'05-undo.png')});
 await page.keyboard.press('Control+Shift+z');const redone=await saved(undone.rev);assert.deepEqual(redone.blocks,plain.blocks);
 await page.setViewportSize({width:1400,height:900});await page.locator('.ProseMirror > p').last().click();await page.keyboard.press('End');
 await paste({html:'<div>'+htmlImage+'</div>',file:true});const uploaded=await saved(redone.rev);const firstImage=uploaded.blocks.find(b=>b.type==='image');assert.ok(firstImage.src);assert.equal(firstImage.alt,'Copied diagram');assert.equal(firstImage.src.includes('clipboard-original.invalid'),false);assert.deepEqual(externalRequests,[]);await page.screenshot({path:path.join(out,'06-equivalent-upload.png')});
 await page.locator('.ProseMirror > p').first().click();await page.keyboard.press('End');await paste({file:true});const fileOnly=await saved(uploaded.rev);assert.equal(fileOnly.blocks.filter(b=>b.type==='image').length,2);await page.screenshot({path:path.join(out,'07-file-only.png')});
 await page.locator('.ProseMirror > p').first().click();await page.keyboard.press('End');await page.keyboard.type(' human');const human=await saved(fileOnly.rev);assert.ok(JSON.stringify(human.blocks).includes('Before Plain text After human'));
 await page.evaluate(()=>document.querySelector('bp-paper-canvas').__e009=true);await page.locator('.bw-paper-pane button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');return c&&!c.__e009&&c._editor;});assert.deepEqual(await page.evaluate(()=>document.querySelector('bp-paper-canvas').blocks),human.blocks);
 await page.waitForFunction(()=>{const images=[...document.querySelectorAll('bp-paper-canvas .bp-canvas-image img')];return images.length===2&&images.every(img=>img.complete&&img.naturalWidth>0);});await page.screenshot({path:path.join(out,'08-reloaded.png')});await page.setViewportSize({width:900,height:900});await page.screenshot({path:path.join(out,'09-narrow.png')});
 results.push({name:'rich clipboard preservation, actual media upload, native history and reload',revisions:{initial:initial.rev,plain:plain.rev,undone:undone.rev,redone:redone.rev,uploaded:uploaded.rev,fileOnly:fileOnly.rev,human:human.rev},notice,externalRequests,blocks:human.blocks});fs.writeFileSync(path.join(out,'server.json'),JSON.stringify(human,null,2));console.log('E009 real Paper clipboard/upload/history/reload passed');
}catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{
 await app.close();if(video){const f=await video.path();if(fs.existsSync(f))fs.renameSync(f,path.join(out,'rich-clipboard.webm'));}
 const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm)$/.test(f)||f==='server.json').map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','.'],{encoding:'utf8'}).trim()!=='',barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,editorBundle,results,artifacts,motion:'Actual production ClipboardEvent/DataTransfer, native history keys, real host media upload and Paper saves. Not a model turn or OS clipboard-producer parity claim.'},null,2)+'\n');console.log('E009 evidence:',out);
}
