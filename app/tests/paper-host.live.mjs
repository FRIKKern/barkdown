// Real Paper + disposable Barkpark. Transport delay/failure is injected around the real CLI write.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const require = createRequire(import.meta.url);
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1') throw new Error('Run through status-shots-isolated.mjs; this test writes disposable papers.');
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args,'-o','json'], { shell: true, encoding: 'utf8', maxBuffer: 20e6, ...(input == null ? {stdio:['ignore','pipe','pipe']} : {input}) }));
for (const [id,title] of [['barkdown','Barkdown'],['scratch','Scratch']]) { bp(['doc','create-or-replace','tag','--set',`_id=${id}`,'--set',`title=${title}`]); bp(['doc','publish','tag',id]); }
const SLUG = 'editor-save-safety', OTHER = 'editor-other-paper';
for (const slug of [SLUG,OTHER]) bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:slug,description:'Scratch paper for the Barkdown Paper host ownership regression. It exercises delayed acknowledgement, reload, navigation, offline retry and persisted Undo against a disposable local server.',tags:[{tag:'barkdown',strength:90,rationale:'owned by the Barkdown editor suite'},{tag:'scratch',strength:40,rationale:'disposable test fixture'}],blocks:[{type:'heading',level:1,text:slug},{type:'paragraph',content:[{type:'text',value:'Keep this original sentence.'}]}]}));
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-paper-host-'));
const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const results=[];
const capture = process.env.BARKDOWN_EDITOR_CAPTURE === '1';
const out = path.resolve(capture ? '../docs/visual/paper-save/runs/' + new Date().toISOString().replace(/[:.]/g,'-') : 'test-results/paper-host');
fs.mkdirSync(out,{recursive:true});
const frames=[];
try {
  const page=await app.firstWindow(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('#bw-pages .bw-page-row'); await page.setViewportSize({width:1400,height:900});
  await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
  await page.evaluate(slug=>window.__barkdown.openTarget({kind:'doc',id:slug,source:'barkpark',title:slug}),SLUG);
  const pm=page.locator('.bw-paper-pane:not([hidden]) .ProseMirror'); await pm.waitFor({timeout:60000});
  const shot=async name=>{
    // Health stills show settled controls; wait real finite UI transitions without disabling effects.
    await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    const file=name+'.png';await page.screenshot({path:path.join(out,file)});frames.push(file);
  };
  await shot('01-original');
  const evaluate=fn=>page.evaluate(fn);
  const saved=()=>page.waitForFunction(()=>/Saved · rev/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent||'')&&!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas').hasPendingChanges(),null,{timeout:30000});
  const serverText=()=>{const raw=bp(['doc','get','paper',SLUG,'--perspective','raw']);return JSON.stringify((raw.document||raw).blocks);};
  const type=async text=>{await pm.click();await page.keyboard.press('Control+End');await page.keyboard.type(text);};
  // Gate only this app process's adapter; the real CLI endpoint is invoked when released.
  await app.evaluate(({app})=>{const bp=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js')('./barkpark');const original=bp.cliApplyOps;globalThis.__paperTest={mode:'delay',release:null};bp.cliApplyOps=async(...args)=>{if(globalThis.__paperTest.mode==='delay')await new Promise(resolve=>{globalThis.__paperTest.release=resolve;});if(globalThis.__paperTest.mode==='fail')throw new Error('Injected offline transport');return original(...args);};});
  await type(' Acknowledged after navigation.');
  await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent==='Saving…');
  await shot('02-saving');
  await page.locator('.bw-paper-pane:not([hidden]) [title="Reload from server"]').click();
  assert.ok((await pm.innerText()).includes('Acknowledged after navigation.'));
  await page.evaluate(other=>{const c=[...window.__barkdown.controllers.values()].find(c=>c.el.matches('.bw-paper-pane'));c.tab.path=[other];c.navigate();},OTHER);
  assert.equal(await evaluate(()=>[...window.__barkdown.controllers.values()].find(c=>c.el.matches('.bw-paper-pane')).tab.path.at(-1)),SLUG);
  assert.equal(await evaluate(()=>[...window.__barkdown.controllers.values()].find(c=>c.el.matches('.bw-paper-pane')).canClose()),false);
  await page.keyboard.press('Control+w'); assert.equal(await pm.count(),1,'keyboard close must retain dirty Paper');
  await page.locator('.bw-tab.active [data-tab]').dispatchEvent('auxclick',{button:1});assert.equal(await pm.count(),1,'middle-click close must retain dirty Paper');
  await shot('03-retained-during-navigation');
  await app.evaluate(()=>{globalThis.__paperTest.mode='pass';globalThis.__paperTest.release();});await saved();
  assert.ok(serverText().includes('Acknowledged after navigation.'));
  await shot('04-acknowledged');
  const other=bp(['doc','get','paper',OTHER,'--perspective','raw']);assert.ok(!JSON.stringify(other).includes('Acknowledged after navigation.'));
  results.push('delayed real save: reload, navigation and close retain the human edit in its original paper');
  await pm.click();await page.keyboard.press('Control+End');await page.keyboard.press('Control+z');await saved();
  assert.ok(!serverText().includes('Acknowledged after navigation.'));
  await shot('05-undo-saved');
  await page.keyboard.press('Control+Shift+z');await saved();assert.ok(serverText().includes('Acknowledged after navigation.'));
  results.push('Undo and redo persist the same text the real canvas shows');
  await app.evaluate(()=>{globalThis.__paperTest.mode='fail';});await type(' Retained offline.');
  await page.waitForSelector('.bw-paper-pane:not([hidden]) [data-act="retry"]');
  await page.setViewportSize({width:760,height:900});await shot('06-offline-narrow');await page.setViewportSize({width:1400,height:900});
  await page.locator('.bw-paper-pane:not([hidden]) [title="Reload from server"]').click();assert.ok((await pm.innerText()).includes('Retained offline.'));
  assert.ok(!serverText().includes('Retained offline.'));
  await app.evaluate(()=>{globalThis.__paperTest.mode='pass';});await page.locator('.bw-paper-pane:not([hidden]) [data-act="retry"]').click();await saved();assert.ok(serverText().includes('Retained offline.'));
  results.push('refused write survives reload and Retry saves the retained edit');
  await shot('07-retry-saved');
  await app.evaluate(()=>{globalThis.__paperTest.mode='fail';});await type(' Explicitly discarded draft.');await page.waitForSelector('.bw-paper-pane:not([hidden]) [data-act="discard"]');
  await page.locator('.bw-paper-pane:not([hidden]) [data-act="discard"]').click();await page.getByRole('alertdialog').waitFor();await shot('08-discard-confirmation');
  await page.locator('#bw-dialog [data-cancel]').click();assert.ok((await pm.innerText()).includes('Explicitly discarded draft.'));
  await page.locator('.bw-paper-pane:not([hidden]) [data-act="discard"]').click();await page.locator('#bw-dialog [data-ok]').click();
  await page.waitForFunction(()=>!document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('Explicitly discarded draft.'));
  assert.ok(!serverText().includes('Explicitly discarded draft.'));assert.ok((await pm.innerText()).includes('Retained offline.'));
  results.push('explicit discard is cancelable and restores the real saved paper without writing the draft');
  await app.evaluate(()=>{globalThis.__paperTest.mode='pass';});await shot('09-discarded-to-saved');
  await page.locator('.bw-paper-pane:not([hidden]) [title="Reload from server"]').click();await pm.waitFor();await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('Retained offline.'));
  assert.deepEqual(errors,[]);
  const {GIFEncoder,quantize,applyPalette}=require('gifenc');const {PNG}=require('pngjs');const gif=GIFEncoder();
  // Actual action checkpoints; narrow view remains a separate still so GIF geometry stays honest.
  for(const file of frames.filter(f=>!f.includes('narrow'))){const png=PNG.sync.read(fs.readFileSync(path.join(out,file)));const palette=quantize(png.data,256);gif.writeFrame(applyPalette(png.data,palette),png.width,png.height,{palette,delay:900});}gif.finish();fs.writeFileSync(path.join(out,'save-recovery.gif'),gif.bytes());
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','.'],{encoding:'utf8'}).trim()!=='',barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,server:process.env.BARKDOWN_SHOTS_SERVER,isolated:true,results,frames,motion:'Step captures of actual UI actions; transport delays/failures are explicitly injected around real server calls. No live model turn.'},null,2)+'\n');
  console.log(JSON.stringify({summary:`${results.length}/${results.length} green`,results},null,2));
} finally { await app.close(); }
