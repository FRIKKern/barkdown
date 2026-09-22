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
const slug='editor-rich-takeover';
const fixtures=[
 {type:'heading',level:1,text:'Rich editor takeover'},
 {type:'paragraph',content:[{type:'text',value:'Alpha Beta Gamma'}]},
 {type:'paragraph',content:[{type:'link',href:'https://example.org/old',children:[{type:'text',value:'Alpha Beta Gamma'}]}]},
 {type:'list',ordered:false,items:[[{type:'text',value:'Alpha'}],[{type:'text',value:'Beta Gamma'}]]},
 {type:'table',head:['Name','Value'],rows:[['Alpha','Beta Gamma']]},
 {type:'paragraph',content:[{type:'text',value:'Original multiline target'}]},
 {type:'paragraph',content:[{type:'text',value:'Beta Gamma'}]},
 {type:'table',rows:[['Headerless content','Keep this table']]},
 {type:'table',head:['Multiline cell'],rows:[['Cell first line\nCell second line']]},
];
bp(['bulldocs','publish',slug,'--file','-','--yes'],JSON.stringify({slug,title:'Rich editor takeover',description:'Disposable evidence for acknowledged rich-content edits preserving marks, links and human selections inside lists, tables and multiline documents. No personal content.',tags:[{tag:'barkdown',strength:90,rationale:'owned by the Barkdown editor suite'},{tag:'scratch',strength:40,rationale:'disposable test fixture'}],blocks:fixtures}));
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-rich-takeover-'));
const capture=process.env.BARKDOWN_EDITOR_CAPTURE==='1';
const out=path.resolve((capture?'../docs/visual/rich-takeover/runs/':'test-results/paper-rich-takeover/')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const app=await electron.launch({executablePath:require('electron'),args:[path.resolve('.'),`--user-data=${userData}`],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const results=[];let video,page,editorBundle,client;
const scenarios=[
 {name:'marks',index:1,select:1,markdown:'**Alpha Beta Gamma**',expected:'strong'},
 {name:'link',index:2,select:2,markdown:'[Alpha Beta Gamma](https://example.org/new)',expected:'https://example.org/new',backwards:true},
 {name:'list',index:3,select:3,markdown:'- An agent expands Alpha\n- Beta Gamma',expected:'An agent expands Alpha'},
 {name:'table',index:4,select:4,markdown:'| Name | Value |\n| --- | --- |\n| An agent expands Alpha | Beta Gamma |',expected:'An agent expands Alpha'},
 {name:'multiline',index:5,select:6,markdown:'First line  \nSecond line',expected:'Second line'},
];
try{
 page=await app.firstWindow();video=page.video();await page.waitForSelector('#bw-pages .bw-page-row');await page.setViewportSize({width:1400,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async server=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:{enabled:true,viaCli:true,writes:true,server}});await window.__barkdown.refreshLibrary();},process.env.BARKDOWN_SHOTS_SERVER);
 await page.evaluate(slug=>window.__barkdown.openTarget({kind:'doc',id:slug,source:'barkpark',title:slug}),slug);
 await page.waitForSelector('.bw-paper-pane .ProseMirror',{timeout:60000});
 editorBundle=JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json'),'utf8'));assert.equal(editorBundle.source,'server');assert.equal(editorBundle.server,process.env.BARKDOWN_SHOTS_SERVER);assert.ok(editorBundle.version);
 client=new Client({name:'rich-read-proof',version:'1.0.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('main/mcp-server.js'),path.join(userData,'barkdown')],env:process.env}));
 const readTool=await client.callTool({name:'read_document',arguments:{id:'bp:'+slug}});
 const readText=readTool.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
 fs.writeFileSync(path.join(out,'structured-read.txt'),readText);
 assert.ok(!readTool.isError,readText);assert.ok(readText.includes('Markdown representation unavailable'));assert.ok(readText.includes('Headerless content')&&readText.includes('Cell first line')&&readText.includes('Cell second line'),'real read_document retains unsupported Markdown content as structured blocks');
 fs.writeFileSync(path.join(out,'structured-read.txt'),readText);
 const read=()=>{const raw=bp(['doc','get','paper',slug,'--perspective','raw']);return raw.document||raw;};
 for(const scenario of scenarios){
  await page.evaluate(({select,backwards})=>{const e=document.querySelector('bp-paper-canvas')._editor;let base=0;for(let i=0;i<select;i++)base+=e.state.doc.child(i).nodeSize;let found;e.state.doc.child(select).descendants((node,pos)=>{if(node.isText&&node.text.includes('Beta'))found=base+1+pos+node.text.indexOf('Beta');});if(found===undefined)throw new Error('Selection fixture missing');e.commands.focus();e.commands.setTextSelection({from:backwards?found+4:found,to:backwards?found:found+4});e.view.dispatch(e.state.tr.scrollIntoView());},scenario);
  const receipt=await app.evaluate(async({app},{slug,scenario})=>{const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js');const before=await req('./barkpark').cliGetPaper(slug);return req('./agent-edits').apply({id:'bp:'+slug,baseRev:before.rev,mode:'replace_block',blockIndex:scenario.index,markdown:scenario.markdown,summary:'Refine '+scenario.name},{enabled:true,writes:true,viaCli:true});},{slug,scenario});
  await page.evaluate(async()=>{await [...window.__barkdown.controllers.values()].find(c=>c.el.matches('.bw-paper-pane')).refresh();});
  const selection=await page.evaluate(()=>{const e=document.querySelector('bp-paper-canvas')._editor,s=e.state.selection;return{text:e.state.doc.textBetween(s.from,s.to),backwards:s.anchor>s.head,pending:document.querySelector('bp-paper-canvas').hasPendingChanges()};});
  assert.equal(selection.text,'Beta',scenario.name+' retains selected word');assert.equal(selection.backwards,!!scenario.backwards);assert.equal(selection.pending,false);assert.equal(read().rev,receipt.afterRev,'presentation adds no write');
  await page.screenshot({path:path.join(out,scenario.name+'-selection.png')});
  await page.keyboard.type('Human');await page.waitForFunction(()=>/Saved · rev/.test(document.querySelector('.bw-paper-pane #save-state')?.textContent||'')&&!document.querySelector('bp-paper-canvas').hasPendingChanges(),null,{timeout:30000});
  const saved=read();if(scenario.name==='multiline')assert.equal(require('../shared/portabledoc').pdInlineToText(saved.blocks[scenario.index].content),'First line\nSecond line','server retains explicit hard break');const changed=JSON.stringify(saved.blocks[scenario.index]);assert.ok(changed.includes(scenario.expected),'acknowledged '+scenario.name+' content survives');assert.ok(JSON.stringify(saved.blocks[scenario.select]).includes('Human Gamma'),'human replaces intended selection');assert.ok(saved.rev>receipt.afterRev);assert.equal((await page.locator('.bw-paper-pane #save-state').innerText()).trim(),'Saved · rev '+saved.rev,'visible revision agrees with server');
  await page.screenshot({path:path.join(out,scenario.name+'-saved.png')});results.push({name:scenario.name,beforeRev:receipt.beforeRev,agentRev:receipt.afterRev,savedRev:saved.rev,selection,serverBlock:saved.blocks[scenario.index],humanBlock:saved.blocks[scenario.select]});
 }
 console.log('Rich takeover '+results.length+'/5 green');
}catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{await client?.close();await app.close();if(video){const file=await video.path();if(fs.existsSync(file))fs.renameSync(file,path.join(out,'rich-takeover.webm'));}const artifacts=Object.fromEntries(fs.readdirSync(out).filter(f=>/\.(png|webm)$/.test(f)).map(file=>[file,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex')]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['status','--porcelain','--','.'],{encoding:'utf8'}).trim()!=='',barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,barkparkDirty:process.env.BARKDOWN_SHOTS_BP_DIRTY,server:process.env.BARKDOWN_SHOTS_SERVER,buildFingerprint:process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,editorBundle,results,artifacts,motion:'Continuous Electron recording, real Paper/server and production agent adapter; no model turn.'},null,2)+'\n');console.log('E003 evidence:',out);}
