// Real callout styling and native edit journey; disposable server only.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
const require=createRequire(import.meta.url);
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1')throw Error('Run through status-shots-isolated.mjs');
const bp=(args,input)=>JSON.parse(execFileSync('bp',[...args,'-o','json'],{shell:true,encoding:'utf8',maxBuffer:20e6,...(input==null?{stdio:['ignore','pipe','pipe']}:{input})}));
for(const [id,title] of [['barkdown','Barkdown'],['scratch','Scratch']]){bp(['doc','create-or-replace','tag','--set',`_id=${id}`,'--set',`title=${title}`]);bp(['doc','publish','tag',id]);}
const slug='callout-design-review', text=value=>[{type:'text',value}];
const tones=['info','success','warning','danger','neutral','loss','peace'];
const copy=[['A little context','Good notes leave room for thought. Keep the useful detail close, without interrupting the page.'],['Ready to continue','The changes are saved. Pick up where you left off.'],['Before you begin','Keep a copy of the original before making a change that is difficult to reverse.'],['Something needs attention','This change could not be saved. Your writing is still here.'],['A quiet aside','Some details are worth keeping, even when they are not the main story.'],['What we learned','Record the tradeoffs as carefully as the outcome.'],['Room to reflect','Leave space for a different perspective.']];
bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:'Notes worth noticing',description:'Disposable visual review of all seven real Paper callout tones, native editable titles and bodies, folded content, theme contrast and narrow text wrapping.',tags:[{tag:'barkdown',strength:90,rationale:'owned by the Barkdown editor suite'},{tag:'scratch',strength:40,rationale:'disposable test fixture'}],blocks:[{type:'heading',level:1,text:'Notes worth noticing'},{type:'paragraph',content:text('A softer place for context, cautions and small discoveries.')},...tones.map((tone,i)=>({type:'callout',tone,title:copy[i][0],content:text(copy[i][1])})),{type:'callout',tone:'info',content:text('An untitled note keeps the same rhythm and comfortable reading width.')},{type:'callout',tone:'neutral',title:'A detail for later',collapsible:true,collapsed:true,content:text('This detail can be opened, edited and folded away again.')}]}));
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-callouts-'));
const out=path.resolve('../docs/visual/callouts/runs/'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const frames=[],results=[];
try{
 const page=await app.firstWindow();await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:1200});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(id=>window.__barkdown.openTarget({kind:'doc',id,source:'barkpark',title:'Notes worth noticing'}),slug);
 await page.evaluate(()=>{const r=document.getElementById('app');r.style.setProperty('--bw-chat','36fr');r.style.setProperty('--bw-work','64fr');document.querySelector('#bw-splitter')?.setAttribute('aria-valuenow','36');});
 const pm=page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');await pm.waitFor({timeout:60000});
 const shot=async name=>{await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
 const save=()=>page.waitForFunction(()=>/Saved · rev/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent||'')&&!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas').hasPendingChanges(),null,{timeout:30000});
 for(const theme of ['light','dark']){
  await page.emulateMedia({colorScheme:theme});await pm.locator('h1').scrollIntoViewIfNeeded();await shot(theme+'-upper');await pm.locator('.bp-callout').last().scrollIntoViewIfNeeded();await shot(theme+'-lower');
 }
 await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:760,height:1000});await pm.locator('h1').scrollIntoViewIfNeeded();await shot('narrow-upper');await pm.locator('.bp-callout').last().scrollIntoViewIfNeeded();await shot('narrow-lower');
 assert.equal(await pm.locator('.bp-callout').count(),9);
 for(const tone of tones)assert.ok(await pm.locator('.bp-callout--'+tone).count());
 const geometry=await pm.locator('.bp-callout').evaluateAll(nodes=>nodes.map(n=>({width:n.clientWidth,scroll:n.scrollWidth})));
 assert.ok(geometry.every(g=>g.scroll<=g.width+1),'callout content must wrap within narrow cards');results.push('All seven tones, untitled and folded cards render without narrow horizontal overflow');
 await page.setViewportSize({width:1400,height:1200});
 const first=pm.locator('.bp-callout').first();
 const title=first.locator('[aria-label="Callout title"]');assert.equal(await title.evaluate(n=>getComputedStyle(n).display),'block');await title.click();await page.keyboard.press('End');await page.keyboard.type(' to keep');await save();assert.ok(JSON.stringify(bp(['doc','get','paper',slug,'--perspective','raw'])).includes('A little context to keep'));results.push('Separate title remains natively editable and saves to the real server');
 await first.locator('.bp-callout__body').click();await page.keyboard.press('End');await page.keyboard.type(' A thought to keep.');await save();await shot('body-edited');
 assert.ok(JSON.stringify(bp(['doc','get','paper',slug,'--perspective','raw'])).includes('A thought to keep.'));results.push('Native callout body editing acknowledged by the real server');
 const folded=pm.locator('details.bp-callout');await folded.locator('summary').click();await save();assert.equal(await folded.getAttribute('open'),'');await shot('detail-open');
 await page.locator('.bw-paper-pane:not([hidden]) [title="Reload from server"]').click();await pm.waitFor();await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('A thought to keep.'));
 assert.equal(await pm.locator('details.bp-callout').getAttribute('open'),'');results.push('Body and native disclosure state survive server reload');
 execFileSync('magick',['-delay','100',...frames.filter(f=>!f.includes('narrow')).map(f=>path.join(out,f)),'-dither','FloydSteinberg','-colors','256','-loop','0',path.join(out,'callouts.gif')]);frames.push('callouts.gif');
 const artifacts=Object.fromEntries(frames.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolated:true,results,artifacts,limits:'Stills of actual Paper actions; no model turn or continuous-motion claim.'},null,2)+'\n');console.log(JSON.stringify({out,results},null,2));
}finally{await app.close();}
