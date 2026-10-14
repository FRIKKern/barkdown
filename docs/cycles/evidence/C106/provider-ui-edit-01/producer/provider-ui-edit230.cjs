const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown',base=__dirname,appRoot=root+'/app',req=createRequire(appRoot+'/package.json'),{_electron:electron}=req('playwright');
const {createProfileRegistry}=req('./main/profile-registry'),{createStore}=req('./main/store');
const source='a3175a355c572248059d24b6f3ac4e6210003c54',runtime='C:/Users/Frikk/Documents/GitHub/barkdown/runtime/C105-full-current-08',native='C:/Users/Frikk/AppData/Local/OpenAI/Codex/bin/2e5e00daee91c61d/codex.exe';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();assert.equal(git(['rev-parse','HEAD']),source);assert.equal(git(['status','--porcelain']),'');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(hash(fs.readFileSync(native)),'d13914ced6c7af174d8d638db938284231227312104b06a25e9608c632a7daec');
const upstream=req('./main/local-barkpark-source').releaseOf(runtime)?.upstream;assert.equal(upstream,'2ff67c882cf0951676c8322bbcc15e19f2f98545');
const out=base+'/C106-provider-ui-edit-230';fs.mkdirSync(out);
const userData=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-ui-edit-'))),registry=createProfileRegistry(path.join(userData,'profile-data')),profile=registry.createProfile({name:'Windows UI provider proof'}),storeDir=registry.storeFor(profile.id).storeDir;
createStore(storeDir).writeJson('settings.json',{provider:'codex',barkpark:{enabled:false,local:{enabled:false}}});createStore(path.join(userData,'app-settings')).writeJson('appearance.json',{theme:'dark'});registry.selectProfile(profile.id);
const identity=crypto.randomUUID(),slug='windows-ui-'+identity.slice(0,8),seed='Original managed Paper '+identity,marker='Windows UI append '+identity,title='Windows UI proof '+identity;
const report={at:new Date().toISOString(),source,appTree:git(['rev-parse','HEAD:app']),runtimeUpstream:upstream,testOnlyUnadopted:true,platform:process.platform,release:os.release(),status:'running',userData,storeDir,profileId:profile.id,slug,seed,marker,title,checks:[],launches:[],screenshots:[],modelSubmissions:0,limits:['One real source-app managed-profile Codex turn on the existing device login; no all-provider/daily-use or installer acceptance.','Private2ff test runtime remains unadopted; no real library/global configuration/source pin change.']};
const persist=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');persist();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let app,page,runId=null,cancelled=false;
const deadline=(promise,ms,label)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]).finally(()=>clearTimeout(timer));};
const env={...process.env,BARKDOWN_CARRIED_RUNTIME:runtime,BARKDOWN_PROVIDER:'codex',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',OPENAI_API_KEY:''};delete env.ELECTRON_RUN_AS_NODE;delete env.BARKDOWN_MOCK_KEYCHAIN;
async function launch(){
 app=await electron.launch({executablePath:req('electron'),args:[appRoot,'--profiles',`--user-data=${userData}`],env,timeout:180000});
 const child=app.process();child.stdout?.on('data',b=>fs.appendFileSync(out+'/electron.log',b));child.stderr?.on('data',b=>fs.appendFileSync(out+'/electron.log',b));
 const pid=await app.evaluate(()=>process.pid);report.launches.push({pid,startedAt:new Date().toISOString()});persist();
 page=await app.firstWindow({timeout:180000});page.setDefaultTimeout(30000);page.on('pageerror',error=>{(report.pageErrors||=[]).push(error.message);persist();});
 await page.waitForFunction(()=>window.__barkdown?.state.loaded,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:1360,height:980}));
 const started=Date.now();for(;;){const state=await page.evaluate(()=>window.barkdown.barkpark.localStatus());report.lastRuntimeStatus=state;
 if(state.phase==='ready')break;if(state.phase==='failed'||Date.now()-started>180000)throw Error('Managed runtime not ready: '+JSON.stringify(state));await sleep(500);}
 assert.equal((await page.evaluate(()=>window.barkdown.profiles.status())).profileId,profile.id);persist();
}
async function shot(name){const file=out+'/'+name+'.png';await page.screenshot({path:file});report.screenshots.push({name,file,sha256:hash(fs.readFileSync(file))});persist();}
async function quit(){if(!app)return;const pid=await app.evaluate(()=>process.pid);await deadline(app.close(),90000,'Owned Electron quit');report.launches.find(r=>r.pid===pid).closedAt=new Date().toISOString();app=null;page=null;persist();
 const data=path.join(storeDir,'local-barkpark','runtime'),pidFile=path.join(data,'pgdata','postmaster.pid');assert.equal(fs.existsSync(pidFile),false,'Owned PostgreSQL stopped after quit');
 const record=req('./main/runtime-orphan').createRuntimeRecord({dataDir:data,log:()=>{}}).read();assert.equal(record,null,'Owned runtime process record cleared');
 (report.cleanupChecks||=[]).push({at:new Date().toISOString(),postmasterPidAbsent:true,runtimeProcessRecordCleared:true});persist();}
async function readFixture(){return app.evaluate(async()=>{const {app}=require('electron'),r=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js'),f=globalThis.uiProviderFixture;
 const response=await fetch(f.config.server+'/v1/data/doc/production/paper/'+f.slug+'?perspective=raw',{headers:{authorization:'Bearer '+f.config.token},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Fixture read '+response.status);const raw=await response.json(),paper=raw.document||raw.result?.document||raw.result||raw;
 const receipt=r('./agent-edits').latest('bp:'+f.slug,f.config);return {paper,receipt,storeDir:r('./store').dir()};});}
async function bindFixture(){return app.evaluate(async({app,safeStorage},fixture)=>{const r=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js'),store=r('./store'),descriptor=store.readJson('runtime.json'),encrypted=store.readJson('local-credentials.json').token;
 const token=encrypted.startsWith('enc:')?safeStorage.decryptString(Buffer.from(encrypted.slice(4),'base64')):Buffer.from(encrypted.slice(6),'base64').toString();
 const config={enabled:true,server:'http://127.0.0.1:'+descriptor.port,token,dataset:'production',writes:true,viaCli:false};globalThis.uiProviderFixture={...fixture,config};return {storeDir:store.dir(),runtimePort:descriptor.port};
},{slug});}
async function openFixture(){await page.evaluate(async slug=>{await window.__barkdown.refreshLibrary();const entry=window.__barkdown.state.barkparkDocs.find(p=>p.id===slug);if(!entry?.paperOwner)throw Error('Fixture absent from owned catalog');window.__barkdown.openTarget({kind:'doc',id:slug,source:'barkpark',title:entry.title,paperOwner:entry.paperOwner});},slug);
 await page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror').waitFor({timeout:60000});}
const text=block=>(block.content||[]).map(t=>t.value??t.text??'').join('');
const started=Date.now();
(async()=>{try{
 await launch();
 // Native runtime and fixture preparation is distinct from the UI model submission below.
 const bound=await bindFixture();assert.equal(path.resolve(bound.storeDir),path.resolve(storeDir));report.runtimePort=bound.runtimePort;
 await app.evaluate(async({app},fixture)=>{const r=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js'),{config}=globalThis.uiProviderFixture;
 const response=await fetch(config.server+'/v1/data/mutate/production',{method:'POST',headers:{authorization:'Bearer '+config.token,'content-type':'application/json'},body:JSON.stringify({mutations:[{createOrReplace:{_id:'ui-proof',_type:'tag',title:'UI proof'}},{publish:{id:'ui-proof',type:'tag'}}]}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Fixture tag '+response.status);
 await r('./barkpark').publish(config,{slug:fixture.slug,title:fixture.title,description:'Disposable managed-profile Windows UI provider proof with one acknowledged append and retained original data.',tags:[{tag:'ui-proof',strength:95,rationale:'Owned synthetic UI provider fixture'}],blocks:[{id:'seed',type:'paragraph',content:[{type:'text',value:fixture.seed}]}]});
 },{slug,title,seed});
 const before=await readFixture();assert.equal(before.paper.rev,1);assert.equal(before.paper.title,title);assert.deepEqual(before.paper.blocks.map(text),[seed]);report.before={rev:before.paper.rev,blocks:before.paper.blocks};persist();
 await page.keyboard.press('Control+,');await page.locator('button[data-pane="assistant"]').click();await page.locator('#codex-binary').fill(native);await page.locator('[data-act="save"]').click();await page.waitForFunction(()=>document.querySelector('#bw-dialog').hidden);
 const tool=(await page.evaluate(()=>window.barkdown.providers.tools(true))).codex;assert.equal(tool.ok,true);assert.equal(tool.source,'settings');assert.equal(tool.version,'0.162.0-alpha.17.2');report.selectedTool=tool;
 await openFixture();await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').filter({hasText:seed}).waitFor();
 await page.locator('#bw-assistant').click();await page.locator('[data-provider="codex"]').click();await page.locator('[data-model=""]').click();
 const context=await page.evaluate(()=>{const s=window.__barkdown.state,c=s.chats[s.current];return {chatId:c.id,provider:c.provider||s.settings.provider,folder:c.folder,profileId:s.profileId,userMessages:c.messages.filter(m=>m.role==='user').length};});
 assert.equal(context.provider,'codex');assert.equal(context.folder||null,null);assert.equal(context.profileId,profile.id);assert.equal(context.userMessages,0);report.context=context;
 await shot('01-before-submit');
 await page.evaluate(({id,marker,profileId})=>{window.__uiProviderProof={events:[],unexpected:null,cancelRequested:false};window.barkdown.agent.onEvent(event=>{
 const proof=window.__uiProviderProof;proof.events.push(structuredClone(event));let reason=null;
 if(event.profileId&&event.profileId!==profileId)reason='Event profile mismatch';
 if(event.type==='tool_start'){const tool=String(event.tool||'').replace(/^mcp__barkdown__/,'');if(!['read_document','edit_document'].includes(tool)||event.input?.id!==id||(tool==='edit_document'&&(event.input.mode!=='append'||event.input.markdown!==marker)))reason='Unexpected tool or target';}
 if(event.type==='approval'){reason='Unexpected approval';window.barkdown.agent.approve(event.runId,event.approvalId,false).catch(()=>{});}
 if(reason){proof.unexpected||=reason;if(event.runId&&!proof.cancelRequested){proof.cancelRequested=true;window.barkdown.agent.cancel(event.runId).catch(error=>{proof.cancelError=error.message;});}}
 });},{id:'bp:'+slug,marker,profileId:profile.id});
 const prompt=`Use only Barkdown document MCP tools. Read document bp:${slug}. Append exactly one paragraph containing exactly ${JSON.stringify(marker)} with edit_document mode append, preserving the existing paragraph and title. Then read the same document again to verify the saved change. Do not create another document, use shell commands, change files, browse, switch profile or request permissions. Finally reply done.`;
 report.prompt=prompt;report.submittedAt=new Date().toISOString();report.modelSubmissions++;persist();
 await page.locator('#bw-prompt').fill(prompt);await page.locator('#bw-prompt').press('Enter');
 await page.waitForFunction(()=>{const proof=window.__uiProviderProof;return proof.unexpected||proof.events.some(e=>e.type==='done'||e.type==='error'||e.type==='error_note')||document.querySelector('.bw-toast.error');},null,{timeout:120000});
 const proof=await page.evaluate(()=>window.__uiProviderProof);report.events=proof.events;report.unexpected=proof.unexpected;runId=proof.events.find(e=>e.runId)?.runId||null;report.runId=runId;persist();
 if(proof.unexpected)throw Error(proof.unexpected);const error=proof.events.find(e=>e.type==='error'||e.type==='error_note');if(error)throw Error(error.message||JSON.stringify(error));assert(runId,'UI submission dispatched an owned run');
 await page.waitForFunction(()=>{const s=window.__barkdown.state,c=s.chats[s.current],last=c.messages.at(-1);return !c.runId&&last?.role==='assistant'&&last.streaming===false;},null,{timeout:30000});
 const final=await page.evaluate(()=>({events:window.__uiProviderProof.events,chat:window.__barkdown.state.chats[window.__barkdown.state.current]}));report.events=final.events;report.finalChat=final.chat;
 assert(final.events.some(e=>e.type==='done'&&!e.cancelled));assert.equal(final.chat.messages.at(-1).error||null,null);assert.deepEqual(final.chat.messages.filter(m=>m.role==='user').map(m=>m.text),[prompt]);
 const starts=new Map(),ack=[];for(const e of final.events){if(e.type==='tool_start')starts.set(e.toolUseId,e);if(e.type==='tool_result'){assert.equal(e.ok,true);const s=starts.get(e.toolUseId);if(s?.input?.id==='bp:'+slug)ack.push(String(s.tool).replace(/^mcp__barkdown__/,''));}}
 assert.deepEqual(ack,['read_document','edit_document','read_document']);report.acknowledgedTools=ack;
 const after=await readFixture();assert.equal(path.resolve(after.storeDir),path.resolve(storeDir));assert.equal(after.paper.rev,before.paper.rev+1);assert.equal(after.paper.title,title);assert.deepEqual(after.paper.blocks.map(text),[seed,marker]);assert(after.receipt?.paperOwner);assert.equal(after.receipt.documentId,'bp:'+slug);assert.equal(after.receipt.beforeRev,1);assert.equal(after.receipt.afterRev,2);assert.equal(after.receipt.mode,'append');report.after=after;
 await page.waitForFunction(marker=>document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes(marker),marker,{timeout:30000});
 report.visibleText=await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText();assert.equal(report.visibleText.trim(),seed+'\n\n'+marker);
 const driverDeadline=Date.now()+30000;let workspace,attempt;for(;;){workspace=JSON.parse(fs.readFileSync(path.join(storeDir,'workspace.json')));const attempts=Object.values(workspace.ownership?.attempts||{});assert.equal(attempts.length,1);attempt=attempts[0];if(attempt.driverFinished)break;if(Date.now()>driverDeadline)throw Error('Owned driver finish not persisted');await sleep(100);}
 assert.equal(attempt.status,'completed');assert.equal(attempt.runId,runId);report.attempt=attempt;report.usage=final.events.filter(e=>e.type==='usage');
 report.checks.push('Actual composer Enter started one owned Codex turn with the saved real CLI; acknowledged exact read/edit/read and no unexpected tools or approvals.','Live Paper1→2 retains seed/title, exactly one marker and matching owner-bound append receipt.','Already-open canvas reflects the mutation without refresh/reopen repair; managed attempt completed with driverFinished true.');persist();await shot('02-edit-visible');
 await quit();
 await launch();await bindFixture();const restarted=await readFixture();assert.equal(restarted.paper.rev,2);assert.equal(restarted.paper.title,title);assert.deepEqual(restarted.paper.blocks.map(text),[seed,marker]);assert.equal(restarted.receipt.id,after.receipt.id);
 const restored=await page.evaluate(()=>{const s=window.__barkdown.state;return {profileId:s.profileId,chats:s.chats};});assert.equal(restored.profileId,profile.id);assert.deepEqual(restored.chats[context.chatId].messages.filter(m=>m.role==='user').map(m=>m.text),[prompt]);assert.equal(restored.chats[context.chatId].runId||null,null);
 await openFixture();await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').filter({hasText:marker}).waitFor();report.restarted={rev:restarted.paper.rev,receiptId:restarted.receipt.id,chatId:context.chatId,profileId:profile.id,modelSubmissions:report.modelSubmissions};report.checks.push('Clean app/runtime restart retains the Paper, exact edit receipt and owned conversation with no second model turn.');await shot('03-restarted');
 assert.equal(git(['rev-parse','HEAD']),source);assert.equal(git(['status','--porcelain']),'');report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);if(page){try{const proof=await page.evaluate(()=>window.__uiProviderProof||null);if(proof){report.events=proof.events;runId||=proof.events.find(e=>e.runId)?.runId||null;}await shot('failure');}catch(e){report.diagnosticError=String(e);}}
}finally{
 if(report.status==='failed'&&page&&runId&&!cancelled){try{await deadline(page.evaluate(id=>window.barkdown.agent.cancel(id),runId),30000,'Owned run cancellation');cancelled=true;report.cancelledOnFailure=true;}catch(error){report.cancelError=String(error);}}
 try{await quit();}catch(error){report.status='failed';report.cleanupError=String(error.stack||error);}
 report.elapsedMs=Date.now()-started;persist();console.log(JSON.stringify({status:report.status,elapsedMs:report.elapsedMs,modelSubmissions:report.modelSubmissions,checks:report.checks,error:report.error,cleanupError:report.cleanupError,out}));if(report.status!=='passed')process.exitCode=1;
}})();
