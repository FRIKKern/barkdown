// Fresh foreign bindings must not grant authority over another library's evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const require=createRequire(import.meta.url),bp=require('../main/barkpark'),{createStore}=require('../main/store'),{createDocuments}=require('../main/documents'),{createAgentEdits}=require('../main/agent-edits');
const appDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
if(process.env.BARKDOWN_SHOTS_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(server||'')||!token)throw Error('Owned private runtime required');
const out=path.resolve(appDir,'../docs/visual/paper-evidence/runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-paper-evidence-')),store=createStore(path.join(userData,'barkdown')),documents=createDocuments(store),edits=createAgentEdits({store,documents}),config={server,token,dataset:'production',enabled:true,writes:true,viaCli:false};
const frames=[],results=[],requests=[],errors=[];let app,page,video,client;
const id='evidence-proof',text='This library keeps the original note and its own edit history.';
async function request(route,body,status=200){const r=await fetch(server+route,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
await request('/v1/data/mutate/production',{mutations:[{create:{_id:'evidenceproof',_type:'tag',title:'Evidence proof'}},{publish:{id:'evidenceproof',type:'tag'}}]});
await request('/v1/plugins/bulldocs/papers/'+id+'/create',{slug:id,title:'An edit belongs somewhere',description:'Private native receipt ownership and restart proof for library boundaries.',tags:[{tag:'evidenceproof',strength:95,rationale:'Isolated retained edit ownership evidence'}],blocks:[{id:'original',type:'paragraph',content:[{type:'text',value:text}]}]},201);
const baseline=await bp.getPaper(config,id),receipt=await edits.apply({id:'bp:'+id,baseRev:baseline.rev,mode:'append',markdown:'An acknowledged edit in the original library.',summary:'Original-library edit'},config);
const proposal=documents.addPaperProposal(id,{mode:'append',markdown:'This proposal belongs to the original library.',summary:'Original-library proposal'},config);
documents.addPaperProposal(id,{id:'legacy-proposal',mode:'append',markdown:'An older proposal whose connection was not recorded.',summary:'Earlier proposal retained for reference'});
const legacyPath='agent-edits/'+crypto.createHash('sha256').update('bp:'+id).digest('hex')+'.json';
store.writeJson(legacyPath,{id:'legacy-receipt',documentId:'bp:'+id,beforeRev:baseline.rev,afterRev:receipt.afterRev,summary:'Earlier unowned edit',before:{blocks:baseline.blocks}});
const legacyBytes=fs.readFileSync(store.filePath(legacyPath)),proposalBytes=fs.readFileSync(store.filePath('paper-proposals.json')),before=await bp.getPaper(config,id);
const foreignPaper={...before.raw,_id:id,title:'A different library',rev:before.rev,blocks:[{id:'foreign-body',type:'paragraph',content:[{type:'text',value:'Same identifier and revision, different library.'}]}]};
const foreign=http.createServer(async(req,res)=>{
 for await(const _ of req){}requests.push({method:req.method,url:req.url});
 // The foreign recorder has no storage. Serve only the real editor assets from
 // the owned fixture runtime; never forward a data read or mutation there.
 if(req.method==='GET'&&['/assets/bp-paper-editor.bundle.js','/assets/bp-paper-editor.css'].includes(req.url)){
  const asset=await fetch(server+req.url);res.writeHead(asset.status,{'content-type':asset.headers.get('content-type')});res.end(Buffer.from(await asset.arrayBuffer()));return;
 }
 res.writeHead(200,{'content-type':'application/json'});
 if(req.url.startsWith('/v1/data/query/')){res.end(JSON.stringify({documents:[foreignPaper],perspective:'published',limit:200,offset:0,count:1,total:1,hasMore:false}));return;}
 if(req.url==='/status.json'){res.end('{}');return;}
 res.end(JSON.stringify({document:foreignPaper}));
});await new Promise(r=>foreign.listen(0,'127.0.0.1',r));const foreignServer='http://127.0.0.1:'+foreign.address().port;
const shot=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,name+'.png')});frames.push(name+'.png');};
const configure=async extra=>page.evaluate(async values=>{window.__barkdown.state.settings=await window.barkdown.settings.set({barkpark:values});for(const c of window.__barkdown.controllers.values())c.connectionChanged?.();},{...config,...extra});
const pm=()=>page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
const ready=async()=>{await pm().waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('bp-paper-canvas')?._editor);};
const launch=async()=>{app=await electron.launch({executablePath:require('electron'),args:[appDir,'--user-data='+userData],recordVideo:{dir:out,size:{width:1400,height:900}},env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});page=await app.firstWindow();video=page.video();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__barkdown?.state.loaded);await page.setViewportSize({width:1400,height:900});};
const close=async name=>{await app.close();app=null;fs.renameSync(await video.path(),path.join(out,name+'.webm'));};
const lookup=()=>page.evaluate(async id=>{const p=await window.barkdown.barkpark.get(id);return {paper:p,edit:await window.barkdown.docs.agentEdit('bp:'+id,p.binding),proposals:await window.barkdown.docs.paperProposals(id,p.binding)};},id);
try{
 await launch();await configure();await page.evaluate(id=>window.__barkdown.openDirect(id,'barkpark'),id);await ready();await page.waitForSelector('#agent-edit button');await shot('01-original-owned-evidence');
 assert.equal((await lookup()).edit.id,receipt.id);
 await configure({server:foreignServer});await page.reload();await page.waitForFunction(()=>window.__barkdown?.state.loaded);await ready();await page.waitForFunction(()=>document.querySelector('#agent-edit')?.textContent.includes('Original connection unknown'));
 const b=await lookup();assert.equal(b.paper.rev,receipt.afterRev);assert.equal(b.edit.id,'legacy-receipt');assert(b.edit.undoUnavailable);assert.deepEqual(b.proposals.map(p=>p.id),['legacy-proposal']);assert.equal(await page.locator('#agent-edit button').count(),0);assert.equal(await page.locator('[data-id="legacy-proposal"] [data-act="keep"]').isDisabled(),true);assert.equal(await page.locator('[data-id="legacy-proposal"] [data-act="discard"]').isDisabled(),true);await page.locator('[data-id="legacy-proposal"] summary').click();await shot('02-fresh-foreign-evidence-readonly');
 const requestCount=requests.length;
 const refusals=await page.evaluate(async({id,receiptId,proposalId,binding,rev})=>{const d=window.barkdown.docs,checks={undo:()=>d.undoAgentEdit('bp:'+id,receiptId,binding),legacyUndo:()=>d.undoAgentEdit('bp:'+id,'legacy-receipt',binding),keep:()=>d.resolvePaperProposal(id,proposalId,true,rev,binding),discard:()=>d.resolvePaperProposal(id,proposalId,false,rev,binding),legacyKeep:()=>d.resolvePaperProposal(id,'legacy-proposal',true,rev,binding),legacyDiscard:()=>d.resolvePaperProposal(id,'legacy-proposal',false,rev,binding)};const results={};for(const [name,fn] of Object.entries(checks)){try{await fn();results[name]='UNEXPECTED';}catch(e){results[name]=e.message;}}return results;},{id,receiptId:receipt.id,proposalId:proposal.id,binding:b.paper.binding,rev:b.paper.rev});
 for(const [name,result] of Object.entries(refusals))assert.match(result,/paper_evidence_owner/,name);assert.equal(requests.length,requestCount);assert.equal(requests.filter(r=>r.method!=='GET').length,0);assert.deepEqual((await bp.getPaper(config,id)).blocks,before.blocks);assert.deepEqual(fs.readFileSync(store.filePath(legacyPath)),legacyBytes);assert.deepEqual(fs.readFileSync(store.filePath('paper-proposals.json')),proposalBytes);results.push('Fresh valid foreign binding with same ID/revision refuses six owned/unknown evidence operations without further requests; both originals remain exact');
 await page.setViewportSize({width:820,height:900});await shot('03-narrow-unattributed-reference');await page.setViewportSize({width:1400,height:900});
 await configure();await close('foreign-refusal');await launch();await ready();await page.waitForSelector('#agent-edit button');assert.equal((await lookup()).edit.id,receipt.id);await shot('04-restarted-original-undo');
 await page.locator('#agent-edit button').click();await page.waitForFunction(()=>!document.querySelector('#agent-edit button'));assert.deepEqual((await bp.getPaper(config,id)).blocks,baseline.blocks);await shot('05-original-exact-undo');results.push('Return to original HTTP connection and actual Electron restart restore its own receipt; native guarded Undo restores exact original blocks');
 // A separate stdio process produces a CLI-bound receipt; the native editor must agree.
 await configure({viaCli:true});await page.reload();await page.waitForFunction(()=>window.__barkdown?.state.loaded);await ready();
 client=new Client({name:'barkdown-evidence-test',version:'1'});const transport=new StdioClientTransport({command:process.execPath,args:[path.join(appDir,'main/mcp-server.js'),store.dir()],env:{...process.env,BARKDOWN_RUN_CONNECTION:JSON.stringify({...config,viaCli:true})}});await client.connect(transport);
 const cliBefore=await bp.getPaper(config,id);let reply=await client.callTool({name:'read_document',arguments:{id:'bp:'+id}});assert(!reply.isError);reply=await client.callTool({name:'edit_document',arguments:{id:'bp:'+id,mode:'append',markdown:'An edit through the captured CLI route.',summary:'CLI-owned edit'}});assert(!reply.isError,JSON.stringify(reply));await client.close();client=null;
 await page.evaluate(async()=>{for(const c of window.__barkdown.controllers.values())await c.refresh?.();});await page.waitForSelector('#agent-edit button');await shot('06-mcp-cli-owned-edit');
 await close('original-recovery');await launch();await ready();await page.waitForSelector('#agent-edit button');await shot('07-restarted-cli-undo');await page.locator('#agent-edit button').click();await page.waitForFunction(()=>!document.querySelector('#agent-edit button'));assert.deepEqual((await bp.getPaper(config,id)).blocks,cliBefore.blocks);await shot('08-cli-exact-undo');results.push('Real stdio MCP read/edit uses explicitly captured CLI routing; native restart finds the same owner and exact guarded Undo passes');
 // The tab strip must use its mounted Paper owner too, and only rename a
 // favorite after acknowledgement. A refused attempt remains a title draft.
 const rename=async title=>{await page.locator('#bw-tabs .bw-tab.active [data-tab]').dblclick();await page.locator('.bw-tab-rename').fill(title);await page.locator('.bw-tab-rename').press('Enter');};
 await page.locator('#bw-tabs .bw-tab.active').hover();await page.locator('#bw-tabs .bw-tab.active [data-fav]').click();
 const unchangedTitle=(await bp.getPaper(config,id)).title;
 const draftStatus=async()=>{const r=await fetch(server+'/v1/data/doc/production/paper/drafts.'+id+'?perspective=raw',{headers:{authorization:'Bearer '+token}});return r.status;};
 assert.equal(await draftStatus(),404);
 await rename('A title with spaces & literal meaning');await page.locator('#title-error').waitFor();
 assert.match(await page.locator('#title-error').innerText(),/No title was saved/);
 assert.equal((await bp.getPaper(config,id)).title,unchangedTitle);assert.equal(await draftStatus(),404);
 assert.equal(await page.evaluate(()=>window.__barkdown.state.favorites[0].label),unchangedTitle);
 assert.equal(await page.locator('.bw-paper-pane #title').inputValue(),'A title with spaces & literal meaning');
 await shot('09-unsupported-rename-retains-title');await page.locator('[data-act="discard-title"]').click();
 await configure({viaCli:true,server:foreignServer});const beforeRenameRequests=requests.length;
 await rename('A title that must not reach another library');await page.locator('#title-error').waitFor();
 assert.equal(await page.locator('#bw-tabs .bw-tab.active .bw-tab-label').innerText(),unchangedTitle);
 assert.equal(await page.locator('.bw-paper-pane #title').inputValue(),'A title that must not reach another library');
 assert.equal(await page.evaluate(()=>window.__barkdown.state.favorites[0].label),unchangedTitle);
 assert.equal(requests.length,beforeRenameRequests);assert.equal((await bp.getPaper(config,id)).title,unchangedTitle);await shot('10-refused-rename-keeps-labels-and-draft');
 await configure({viaCli:true});await page.locator('[data-act="discard-title"]').click();await shot('11-original-title-restored');
 results.push('Unsupported title operation refuses before writing a draft twin; native foreign rename refuses without requests, retains the attempted title and preserves tab/favorite labels until explicit discard');
 assert.deepEqual(fs.readFileSync(store.filePath(legacyPath)),legacyBytes);assert.deepEqual(fs.readFileSync(store.filePath('paper-proposals.json')),proposalBytes);assert.deepEqual(errors,[]);console.log('PASS native retained evidence ownership',JSON.stringify(results));
}catch(error){if(app&&page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),error.stack);throw error;}
finally{await client?.close().catch(()=>{});if(app)await close('restart-or-failure');await new Promise(r=>foreign.close(r));const artifacts=Object.fromEntries(fs.readdirSync(out).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,foreignRequests:requests,results,frames,artifacts,limits:['Actual private Paper and non-persisting foreign read recorder; no real user library','Original unknown evidence is retained readably, never assigned a guessed owner','Credential rotation or connection access-mode change deliberately creates a different owner; no automatic reassignment','CLI route is captured; externally replaced CLI credentials are not frozen','No authority activation, deployment or portability claim']},null,2)+'\n');console.log('Evidence gallery:',out);}
