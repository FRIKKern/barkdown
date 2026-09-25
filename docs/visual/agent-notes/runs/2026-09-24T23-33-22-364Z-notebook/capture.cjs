const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {createRequire}=require('module'),{pathToFileURL}=require('url'),{execFileSync}=require('child_process');
const root=process.cwd(), appDir=path.join(root,'app'),req=createRequire(path.join(appDir,'package.json'));
const { _electron:electron}=require(path.join(root,'node_modules/playwright'));
(async()=>{
const {createToolFixture}=await import(pathToFileURL(path.join(appDir,'tests/fixtures/anthropic-tools-http.mjs')));
const source=process.env.BARKDOWN_DEMO_SOURCE;
const run=path.join(root,'docs/visual/agent-notes/runs',new Date().toISOString().replace(/[:.]/g,'-')+'-notebook');fs.mkdirSync(run,{recursive:true});
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'bd-readme-notebook-')),framesDir=path.join(userData,'frames');fs.mkdirSync(framesDir);
const git=(a,cwd=root)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
const requestId=crypto.randomUUID(),id='drafts.bd-note-'+requestId,title='Room for a good idea';
const intro='A working notebook for the things we are reading, building and figuring out together.';
const revised='A place for half-formed ideas, useful discoveries and the next thing worth making.';
const markdown=[intro,'> Start with a small idea. Give it room to grow.','## On the desk today','- [x] Collect a few good references\n- [ ] Shape the first draft\n- [ ] Leave a note for tomorrow','| Space | What lives here | Next step |\n| --- | --- | --- |\n| Field notes | Observations and sketches | Find the thread |\n| Reading list | Links worth coming back to | Add a thought |\n| Small experiments | Things we can try today | Make it real |','> Keep the messy first draft. The useful part is being able to work on it together.','```sh\nnpm run desktop\n```'].join('\n\n');
let app,page,video,owner,record=false,capturePromise,start,frames=[];
const manifest={host:git(['rev-parse','HEAD']),upstream:'f2528db1291aa40c05d41e8cabf7c44cb751a481',upstreamArtifacts:'preserved runtime c667b359b8155ce88b356ae1f192e24263f11e669cb7d1765f653da20011ad3e from the preceding successful capture',sourceDirty:git(['status','--porcelain','--','app'])!=='',theme:'dark',viewport:{width:1600,height:1000},chatWidth:35,model:'Scripted responses through actual SDK and private Paper runtime',results:[],errors:[],actions:[],retainedFrames:framesDir};
const fold=async()=>{for(let i=0;i<12;i++){const item=page.locator('details.bw-step[open] > summary').first();if(!await item.count())break;await item.click({timeout:2000});await page.waitForTimeout(60);}};
const fixture=await createToolFixture(async(body,index)=>{
 const result=body.messages.at(-1).content?.find?.(x=>x.type==='tool_result');if(result)assert(!result.is_error,result.content);
 if(index===0)return{name:'create_document',input:{title:'Reading list',markdown:'## Worth a closer look\n\n- Interfaces that get out of the way\n- A notebook that stays with you\n- Making an agent\'s work visible',requestId:crypto.randomUUID()}};
 if(index===1)return{name:'create_document',input:{title:'Small experiments',markdown:'## Try something small\n\n1. Gather an idea.\n2. Make a first version.\n3. Keep what feels useful.',requestId:crypto.randomUUID()}};
 if(index===2)return{name:'create_document',input:{title,markdown,requestId}};
 if(index===3)return{text:'Your notebook is ready: a place for field notes, a reading list and small experiments. I added a checklist and a table so the next steps stay easy to scan.'};
 if(index===4)return{name:'read_document',input:{id:'bp:'+id,format:'structured'}};
 if(index===5){const doc=JSON.parse(result.content);assert.equal(doc.blocks[1].type,'paragraph');await fold();return{name:'edit_document',input:{id:'bp:'+id,mode:'replace_block',blockIndex:1,markdown:revised,summary:'Give the opening a warmer voice'}};}
 if(index===6)return{text:'A warmer opening, with the rest of your notebook kept intact. You can Undo the change in the paper.'};
 throw Error('Unexpected model step '+index);
});
const pause=ms=>page.waitForTimeout(ms);
const pm=()=>page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
const visible=async text=>{await page.waitForFunction(t=>document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes(t),text,{timeout:90000});await page.waitForFunction(()=>!document.querySelector('[data-agent-phase]'));};
const read=()=>page.evaluate(({id,owner})=>window.barkdown.barkpark.get(id,undefined,owner),{id,owner});
const saved=()=>page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent.startsWith('Saved')&&!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')?.hasPendingChanges());
const shot=async name=>{await page.screenshot({path:path.join(run,name+'.png')});};
const mark=name=>manifest.actions.push({name,elapsedMs:Date.now()-start});
try{
 app=await electron.launch({executablePath:req('electron'),args:[appDir,'--profiles','--user-data='+userData],recordVideo:{dir:run,size:{width:1600,height:1000}},timeout:180000,env:{...process.env,BARKDOWN_TEST_BP_SOURCE:source,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',ANTHROPIC_BASE_URL:fixture.url}});
 page=await app.firstWindow({timeout:180000});video=page.video();page.setDefaultTimeout(30000);page.on('pageerror',e=>manifest.errors.push(e.message));
 await page.waitForFunction(()=>window.__barkdown?.state.loaded,null,{timeout:180000});await page.setViewportSize(manifest.viewport);
 await page.evaluate(async source=>{const b=window.__barkdown;b.state.settings=await window.barkdown.settings.set({theme:'dark',chatWidth:35,provider:'api',apiKey:'synthetic-fixture',barkpark:{enabled:true,writes:true,viaCli:false,local:{enabled:true,source}}});b.state.chats[b.state.current].provider='api';document.documentElement.dataset.theme='dark';b.render();},source);
 await page.locator('#bw-prompt').fill('Set up a notebook for our next idea, with a reading list and a few small experiments.');await page.locator('#bw-prompt').press('Enter');await visible(intro);await page.waitForFunction(()=>!window.__barkdown.state.chats[window.__barkdown.state.current].runId);
 owner=await page.evaluate(()=>{const s=window.__barkdown.state;return s.chats[s.current].tabs.find(t=>t.id===s.chats[s.current].active).paperOwner;});
 let before=await read();assert.equal(before.title,title);assert(before.blocks.some(b=>b.type==='table'));
 const quote=before.blocks.filter(b=>b.type==='blockquote').at(-1);assert(quote);
 await page.evaluate(async({id,binding,rev,quote})=>{await window.barkdown.barkpark.applyOps(id,[{op:'replace-block',id:quote.id,block:{...quote,type:'callout',tone:'info'}}],rev,binding);},{id,binding:before.binding,rev:before.rev,quote});
 await page.locator('.bw-paper-pane:not([hidden]) button[title="Reload from server"]').click();await visible('Keep the messy first draft');
 await page.evaluate(async()=>{const b=window.__barkdown;await b.refreshLibrary();const docs=b.state.barkparkDocs;for(const d of docs){if(d.paperOwner)b.addPage('bp:v1:'+d.paperOwner+':'+encodeURIComponent(d.id));}b.render();});
 await page.locator('#bw-splitter').press('Home');for(let i=0;i<5;i++)await page.locator('#bw-splitter').press('ArrowLeft');await fold();await pause(1000);await shot('01-notebook');before=await read();
 fs.writeFileSync(path.join(run,'before.json'),JSON.stringify(before.blocks,null,2));
 console.log('Notebook ready',run);
 start=Date.now();record=true;
 capturePromise=(async()=>{while(record){const began=Date.now(),name=String(frames.length).padStart(4,'0')+'.png';await page.screenshot({path:path.join(framesDir,name)});frames.push({file:name,atMs:Date.now()-start});await pause(Math.max(1,125-(Date.now()-began)));}})();
 mark('Read the notebook');await pause(1800);
 await page.locator('#bw-prompt').pressSequentially('Make the opening warmer.',{delay:45});await pause(500);mark('Agent rewrites one paragraph');await page.locator('#bw-prompt').press('Enter');await visible(revised);await page.waitForFunction(()=>!window.__barkdown.state.chats[window.__barkdown.state.current].runId);await fold();await pause(1100);await shot('02-agent-edit');
 const changed=await read();assert.equal(changed.blocks[0].text,title);assert.deepEqual(changed.blocks.filter(b=>b.type==='table'),before.blocks.filter(b=>b.type==='table'));
 mark('Undo the agent edit');await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').click();await visible(intro);assert.deepEqual((await read()).blocks,before.blocks);await pause(1200);
 mark('Complete a checklist item');const boxes=pm().locator('input[type="checkbox"]');console.log('Checkboxes',await boxes.count());await boxes.nth(1).check();await saved();await pause(900);
 mark('Edit a table cell');const cell=pm().locator('.bp-table__td').filter({hasText:'Make it real'}).first();await cell.click();await page.keyboard.press('Home');await page.keyboard.down('Shift');await page.keyboard.press('End');await page.keyboard.up('Shift');await page.keyboard.type('Try it today',{delay:65});await saved();await pause(1200);await shot('03-human-edit');
 assert((await read()).markdown.includes('Try it today'));
 mark('Find a note');await page.locator('#bw-prompt').click();await page.keyboard.press('Control+k');await page.locator('#bw-palette-input').waitFor({state:'visible'});await pause(450);await page.locator('#bw-palette-input').pressSequentially('Reading',{delay:110});await pause(1100);await page.keyboard.press('Escape');await pause(1800);await shot('04-finished');assert(!(await read()).markdown.includes('Try it todayReading'));
 manifest.results.push('Three actual managed Paper notes created through SDK tools','Targeted paragraph edit preserves table and title','Undo restores the exact pre-edit blocks','Human checkbox and table cell edits saved to the private Paper server');
 assert.deepEqual(manifest.errors,[]);assert.deepEqual(fixture.errors,[]);assert.equal(fixture.requests.length,7);
}catch(e){manifest.failure=e.stack;console.error(e);if(page&&!page.isClosed())await shot('failure').catch(()=>{});process.exitCode=1;}
finally{record=false;if(capturePromise)await capturePromise.catch(e=>manifest.errors.push(e.message));if(app)await app.close();if(video)fs.renameSync(await video.path(),path.join(run,'full-session.webm'));await fixture.close();manifest.frames=frames;manifest.durationMs=frames.length?frames.at(-1).atMs:0;manifest.artifacts=Object.fromEntries(fs.readdirSync(run).filter(f=>fs.statSync(path.join(run,f)).isFile()).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(run,f))).digest('hex')]));fs.writeFileSync(path.join(run,'manifest.json'),JSON.stringify(manifest,null,2));console.log('Capture:',run,'Frames:',framesDir);}
})().catch(e=>{console.error(e);process.exitCode=1;});
