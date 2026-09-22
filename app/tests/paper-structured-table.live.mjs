// Real Paper + production agent-edit adapter on a disposable server; no model-generated fixtures.
import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const require=createRequire(import.meta.url);
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1')throw new Error('Use status-shots-isolated.mjs; this suite writes a disposable paper.');
const bp=(args,input)=>JSON.parse(execFileSync('bp',[...args,'-o','json'],{shell:true,encoding:'utf8',maxBuffer:20e6,...(input==null?{stdio:['ignore','pipe','pipe']}:{input})}));
for(const [id,title] of [['barkdown','Barkdown'],['scratch','Scratch']]){bp(['doc','create-or-replace','tag','--set',`_id=${id}`,'--set',`title=${title}`]);bp(['doc','publish','tag',id]);}
const slug='editor-structured-table';
const fixtures=[
 {type:'heading',level:1,text:'Structured table editing'},
 {type:'table',rows:[['First line\nSecond line','Beta Gamma']]},
 {type:'table',head:['Detailed column heading with enough words to wrap naturally','Value'],rows:[[{content:[{type:'strong',children:[{type:'text',value:'Rich first\nSecond'}]}],align:'right'},'Beta Gamma']],headCol:true,cols:[{width:220},{width:200}]},
 {type:'table',head:[{content:[{type:'text',value:'Centered'}],align:'center'},'Value'],rows:[[{content:[{type:'text',value:'Center value'}],align:'center'},'Beta Gamma']]},
 {type:'paragraph',content:[{type:'text',value:'This unrelated paragraph must survive.'}]},
];
bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:'Structured table editing',description:'Disposable evidence for acknowledged rich-content edits preserving marks, links and human selections inside lists, tables and multiline documents. No personal content.',tags:[{tag:'barkdown',strength:90,rationale:'owned by the Barkdown editor suite'},{tag:'scratch',strength:40,rationale:'disposable test fixture'}],blocks:fixtures}));
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-structured-table-'));
const capture=process.env.BARKDOWN_EDITOR_CAPTURE==='1';
const out=path.resolve((capture?'../docs/visual/structured-table/runs/':'test-results/paper-structured-table/')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const results=[];let video,page,editorBundle,client;
const scenarios=[
 {name:'headerless',index:1,cells:[{row:0,column:0,text:'Agent first\nAgent second',align:'right'}],expected:'Agent first'},
 {name:'rich-multiline',index:2,cells:[{row:0,column:0,content:[{type:'strong',children:[{type:'text',value:'Agent rich\nSecond'}]}],align:'center'}],expected:'Agent rich'},
 {name:'alignment-only',index:3,cells:[{row:0,column:0,align:'right'}],expected:'Center value'},
];
try{
 page=await app.firstWindow();video=page.video();await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(slug=>window.__barkdown.openTarget({kind:'doc',id:slug,source:'barkpark',title:slug}),slug);
 await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json'),'utf8'));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.server,process.env.BARKDOWN_SHOTS_SERVER);assert.ok(editorBundle.version);
 client=new Client({name:'rich-read-proof',version:'1.0.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('main/mcp-server.js'),path.join(userData,'barkdown')],env:process.env}));
 const read=()=>{const raw=bp(['doc','get','paper',slug,'--perspective','raw']);return raw.document||raw;};
 const structuredRead=async()=>{const result=await client.callTool({name:'read_document',arguments:{id:'bp:'+slug,format:'structured'}});assert.ok(!result.isError,JSON.stringify(result));const exported=JSON.parse(result.content[0].text);assert.deepEqual(exported.blocks,read().blocks);assert.equal(exported.rev,read().rev);return exported;};
 const refresh=()=>page.evaluate(async()=>{await [...window.__barkdown.controllers.values()].find(c=>c.el.matches('.bw-paper-pane')).refresh();});
 for(const scenario of scenarios){
  const before=await structuredRead(),block=before.blocks[scenario.index];
  await page.evaluate(index=>{const e=document.querySelector('bp-paper-canvas')._editor;let base=0;for(let i=0;i<index;i++)base+=e.state.doc.child(i).nodeSize;let found;e.state.doc.child(index).descendants((node,pos)=>{if(node.isText&&node.text.includes('Beta'))found=base+1+pos+node.text.indexOf('Beta');});if(found===undefined)throw new Error('Selection fixture missing');e.commands.focus();e.commands.setTextSelection({from:found+4,to:found});},scenario.index);
  const call=()=>client.callTool({name:'edit_table',arguments:{id:'bp:'+slug,blockId:block.id,cells:scenario.cells,summary:'Refine '+scenario.name+' cell'}});
  let result=await call();assert.ok(!result.isError,JSON.stringify(result));await refresh();
  const selection=await page.evaluate(()=>{const e=document.querySelector('bp-paper-canvas')._editor,s=e.state.selection;return{text:e.state.doc.textBetween(s.from,s.to),backwards:s.anchor>s.head};});assert.equal(selection.text,'Beta');assert.equal(selection.backwards,true);
  await page.screenshot({path:path.join(out,scenario.name+'-selection.png')});
  const agentState=read();assert.ok(JSON.stringify(agentState.blocks[scenario.index]).includes(scenario.expected));assert.equal(agentState.blocks[scenario.index].headCol,block.headCol);assert.deepEqual(agentState.blocks[scenario.index].cols,block.cols);if(!block.head)assert.equal(agentState.blocks[scenario.index].head,undefined);
  // The existing visible Undo uses the same receipt and real revision guard.
  await page.locator('.bw-paper-pane #agent-edit button').click();await page.waitForFunction(()=>!document.querySelector('bp-paper-canvas').hasPendingChanges());
  await page.waitForFunction(rev=>document.querySelector('.bw-paper-pane #save-state')?.textContent==='Saved · rev '+rev,agentState.rev+1,{timeout:30000});assert.deepEqual(read().blocks,before.blocks,'Undo restores exact structured source');
  await structuredRead();result=await call();assert.ok(!result.isError,JSON.stringify(result));await refresh();
  // Undo may reload the document, so deliberately select the unaffected cell again.
  await page.evaluate(index=>{const e=document.querySelector('bp-paper-canvas')._editor;let base=0;for(let i=0;i<index;i++)base+=e.state.doc.child(i).nodeSize;let found;e.state.doc.child(index).descendants((node,pos)=>{if(node.isText&&node.text.includes('Beta'))found=base+1+pos+node.text.indexOf('Beta');});e.commands.focus();e.commands.setTextSelection({from:found,to:found+4});},scenario.index);
  await page.waitForFunction(()=>document.activeElement===document.querySelector('bp-paper-canvas')._editor.view.dom);
  await page.evaluate(()=>{window.__e004Input=[];const dom=document.querySelector('bp-paper-canvas')._editor.view.dom;for(const name of ['keydown','beforeinput','input'])dom.addEventListener(name,event=>{const e=document.querySelector('bp-paper-canvas')._editor;window.__e004Input.push({name,key:event.key,data:event.data,anchor:e.state.selection.anchor,head:e.state.selection.head,text:e.state.doc.textContent});},{capture:true});});
  await page.keyboard.type('Human');await page.waitForFunction(()=>/Saved · rev/.test(document.querySelector('.bw-paper-pane #save-state')?.textContent||'')&&!document.querySelector('bp-paper-canvas').hasPendingChanges(),null,{timeout:30000});
  if(scenario.name==='rich-multiline') {
   const geometry=await page.evaluate(()=>{const cells=[...document.querySelectorAll('.bw-paper-pane .ProseMirror th')];const cell=cells.find(c=>c.textContent.includes('Agent rich'));const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let text;while(walker.nextNode())if(walker.currentNode.textContent.includes('Agent rich')){text=walker.currentNode;break;}const value=text.textContent;const rect=(word)=>{const range=document.createRange();const start=value.indexOf(word);range.setStart(text,start);range.setEnd(text,start+word.length);const r=range.getBoundingClientRect();return {y:r.y,height:r.height};};return {whiteSpace:getComputedStyle(cell).whiteSpace,first:rect('Agent rich'),second:rect('Second')};});
   assert.equal(geometry.whiteSpace,'pre-wrap');assert.ok(geometry.second.y>geometry.first.y,'row-header newline has separate rendered line');scenario.geometry=geometry;
   await page.setViewportSize({width:900,height:900});await page.screenshot({path:path.join(out,'rich-multiline-narrow.png')});
   const narrow=await page.evaluate(()=>{const c=[...document.querySelectorAll('.bw-paper-pane .ProseMirror th')].find(c=>c.textContent.includes('Detailed column'));return {height:c.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(c).lineHeight),text:c.textContent,whiteSpace:getComputedStyle(c).whiteSpace};});assert.equal(narrow.whiteSpace,'pre-wrap');assert.ok(narrow.height>narrow.lineHeight*2,'long header wraps in narrow pane');scenario.narrow=narrow;await page.setViewportSize({width:1400,height:900});
  }
  fs.writeFileSync(path.join(out,scenario.name+'-input.json'),JSON.stringify(await page.evaluate(()=>window.__e004Input),null,2));
  const saved=read();assert.ok(JSON.stringify(saved.blocks[scenario.index]).includes('Human Gamma'));assert.ok(JSON.stringify(saved.blocks[scenario.index]).includes(scenario.expected));assert.deepEqual(saved.blocks.at(-1),before.blocks.at(-1));
  await page.evaluate(()=>{document.querySelector('bp-paper-canvas').__e004BeforeReload=true;});
  await page.locator('.bw-paper-pane button[title="Reload from server"]').click();await page.waitForFunction(()=>{const c=document.querySelector('bp-paper-canvas');return c&&!c.__e004BeforeReload&&c.querySelector('.ProseMirror');},null,{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>document.querySelector('bp-paper-canvas').blocks),saved.blocks,'reload retains exact server blocks');
  const exported=await structuredRead();fs.writeFileSync(path.join(out,scenario.name+'-export.json'),JSON.stringify(exported,null,2));
  await page.screenshot({path:path.join(out,scenario.name+'-saved.png')});results.push({name:scenario.name,beforeRev:before.rev,agentRev:agentState.rev,savedRev:saved.rev,selection,geometry:scenario.geometry,narrow:scenario.narrow,serverBlock:saved.blocks[scenario.index]});
 }
 console.log('Structured tables '+results.length+'/3 green');
}catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{await client?.close();await app.close();if(video){const file=await video.path();if(fs.existsSync(file))fs.renameSync(file,path.join(out,'structured-table.webm'));}const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm)$/.test(f)||f.endsWith('-export.json')||f.endsWith('-input.json')).map(file=>[file,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex')]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','.'],{encoding:'utf8'}).trim()!=='',barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,editorBundle,results,artifacts,motion:'Continuous Electron recording, real Paper/server and production MCP edit_table; no model turn.'},null,2)+'\n');console.log('E004 evidence:',out);}
