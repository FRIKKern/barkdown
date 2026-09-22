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
const seed=[{id:'origin',type:'paragraph',content:[{type:'text',value:'Before after'}]},{id:'reference',type:'paragraph',content:[{type:'link',href:'https://example.org/#origin',children:[{type:'text',value:'Reference stays'}]}]}];
publishFixture({slug,title:'Stable native split identities',description:'Disposable real native paragraph split, stable block identity, subsequent edit and reload proof.',blocks:seed});
let app,page,video,bundle;const results=[];
const read=()=>getPaper(slug);
const snap=()=>page.evaluate(()=>document.querySelector('bp-paper-canvas').recoverySnapshot().blocks);
async function saved(previous){
 await page.waitForFunction(rev=>{const c=document.querySelector('bp-paper-canvas'),h=[...window.__barkdown.controllers.values()].find(x=>x.el?.contains(c));return c&&h&&!h.isDirty()&&!c.hasPendingChanges()&&Number(document.querySelector('.bw-paper-pane #save-state')?.textContent?.match(/Saved · rev (\d+)/)?.[1])>rev;},previous,{timeout:45000});
 const p=read();assert.deepEqual(await snap(),p.blocks,'full server and live identity/content agreement');assert.deepEqual(await snap(),p.blocks,'repeated snapshot identity stability');return p;
}
try{
 app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
 page=await app.firstWindow();video=page.video();await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(id=>window.__barkdown.openTarget({kind:'doc',id,source:'barkpark',title:id}),slug);await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 bundle=await page.evaluate(()=>window.__barkdown.state.canvasBundle);assert.equal(bundle.source,'server');assert.equal(bundle.sha,'6bda88cdd38b6ab33cb4623bbe75963f2058db60');
 const initial=read(),pm=page.locator('.bw-paper-pane .ProseMirror');await pm.locator('p').first().click();await page.keyboard.press('Home');for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 const split=await saved(initial.rev);assert.equal(split.blocks[0].id,'origin');assert.notEqual(split.blocks[1].id,'origin');assert.deepEqual(split.blocks[2],initial.blocks[1]);assert.equal(split.blocks[0].content[0].value,'Before ');assert.equal(split.blocks[1].content[0].value,'after');
 const ids=split.blocks.map(b=>b.id);assert.equal(new Set(ids).size,3);await page.screenshot({path:path.join(out,'01-split-saved.png')});
 await page.keyboard.type('Human ');const typed=await saved(split.rev);assert.deepEqual(typed.blocks.map(b=>b.id),ids);assert.equal(typed.blocks[1].content[0].value,'Human after');await page.screenshot({path:path.join(out,'02-human-saved.png')});
 await page.keyboard.press('Control+z');const undone=await saved(typed.rev);assert.deepEqual(undone.blocks,split.blocks,'Undo retains the saved child identity');await page.screenshot({path:path.join(out,'03-undo.png')});
 await page.keyboard.press('Control+Shift+z');const redone=await saved(undone.rev);assert.deepEqual(redone.blocks,typed.blocks);await page.screenshot({path:path.join(out,'04-redo.png')});
 await page.evaluate(()=>document.querySelector('bp-paper-canvas').__identityOld=true);await page.locator('.bw-paper-pane button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');return c&&!c.__identityOld&&c._editor;});assert.deepEqual(await snap(),redone.blocks);await page.screenshot({path:path.join(out,'05-reloaded.png')});await page.setViewportSize({width:900,height:900});await page.screenshot({path:path.join(out,'06-narrow.png')});
 results.push({name:'native split, subsequent input, Undo/Redo and reload preserve complete server identities',ids,revisions:[initial.rev,split.rev,typed.rev,undone.rev,redone.rev]});fs.writeFileSync(path.join(out,'server.json'),JSON.stringify(redone,null,2)+'\n');
}catch(e){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),e.stack);throw e;}
finally{
 if(app)await app.close();if(video){const f=await video.path();if(fs.existsSync(f))fs.renameSync(f,path.join(out,'block-identity.webm'));}
 const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm|json)$/.test(f)).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,bundle,results,artifacts},null,2)+'\n');console.log('E012 evidence:',out);
}
