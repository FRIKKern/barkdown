const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict'), crypto=require('node:crypto'), {createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown', base='C:/Users/Frikk/Documents/GitHub/barkdown/.git';
const requireApp=createRequire(root+'/app/package.json'), {_electron:electron}=requireApp('playwright');
const executable='C:/Users/Frikk/AppData/Local/OpenAI/Codex/bin/2e5e00daee91c61d/codex.exe';
const out=base+'/C106-provider-ui-221'; fs.mkdirSync(out);
const data=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-cli-ui-')), home=path.join(data,'home'); fs.mkdirSync(home);
const userData=path.join(data,'user-data');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=git(['rev-parse','HEAD']).trim(), appTree=git(['rev-parse','HEAD:app']).trim();
assert.equal(git(['status','--porcelain','--','app']).trim(),'');
assert(fs.statSync(executable).isFile());
const record={at:new Date().toISOString(),source,appTree,platform:process.platform,release:os.release(),status:'running',data,executable,executableSha256:hash(fs.readFileSync(executable)),checks:[],frames:[],launches:[],limits:['Disposable UI/settings proof only; no model request, production backend or installer execution.','Internal versioned user CLI location may change after its own update.']};
const persist=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(record,null,2)+'\n'); persist();
let app, page;
const environment={...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),CLAUDE_CONFIG_DIR:path.join(home,'.claude'),ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',OPENAI_API_KEY:'',BARKDOWN_PROVIDER:''};
delete environment.ELECTRON_RUN_AS_NODE;
async function launch(){
 app=await electron.launch({executablePath:requireApp('electron'),args:[root+'/app','--profiles',`--user-data=${userData}`],env:environment,timeout:60000});
 const child=app.process(); record.launches.push({pid:child.pid,startedAt:new Date().toISOString()});
 child.stdout?.on('data',b=>fs.appendFileSync(out+'/electron.log',b)); child.stderr?.on('data',b=>fs.appendFileSync(out+'/electron.log',b));
 page=await app.firstWindow({timeout:60000});page.setDefaultTimeout(20000);
 await page.waitForFunction(()=>window.__barkdown?.state.loaded);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:1180,height:850}));
 const actual=await app.evaluate(({app})=>app.getPath('userData')); assert.equal(path.resolve(actual),path.resolve(userData));
}
async function open(){await page.keyboard.press('Control+,');await page.locator('button[data-pane="assistant"]').click();await page.locator('#codex-binary').waitFor();}
async function close(){if(!app)return; const pid=app.process().pid;await app.close();record.launches.find(r=>r.pid===pid).closedAt=new Date().toISOString(); app=null;persist();}
async function shot(name){await page.locator('#codex-binary').scrollIntoViewIfNeeded(); const file=out+'/'+name+'.png'; await page.screenshot({path:file});const geometry=await page.evaluate(()=>{
const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {viewport:{width:innerWidth,height:innerHeight},field:box(document.querySelector('#codex-binary')),save:box(document.querySelector('[data-act="save"]')),dialog:box(document.querySelector('.bw-settings'))};});
for(const key of ['field','save']){const b=geometry[key];assert(b.x>=0&&b.y>=0&&b.x+b.width<=geometry.viewport.width+1&&b.y+b.height<=geometry.viewport.height+1,JSON.stringify({key,geometry}));}
record.frames.push({name,file,sha256:hash(fs.readFileSync(file)),geometry});persist();}
async function save(){await page.locator('[data-act="save"]').click();await page.waitForFunction(()=>document.querySelector('#bw-dialog').hidden);}
const started=Date.now();
(async()=>{try{
 await launch();
 // Only initial dark appearance is prepared through IPC. The CLI selection itself uses the visible field and Save.
 await page.evaluate(()=>window.barkdown.settings.set({theme:'dark'})); await page.reload();await page.waitForFunction(()=>window.__barkdown?.state.loaded);
 const before=await page.evaluate(()=>window.barkdown.settings.get());assert.equal(before.providerBinary.codex,'');
 record.before=(await page.evaluate(()=>window.barkdown.providers.tools(true))).codex;
 await open(); await page.locator('[data-tool-status="codex"]').filter({hasText:/Found|not found|path/i}).waitFor();
 await shot('01-before-selection');
 await page.locator('#codex-binary').fill(executable);await save();
 const chosen=await page.evaluate(()=>window.barkdown.settings.get());assert.equal(chosen.providerBinary.codex,executable);
 const tool=(await page.evaluate(()=>window.barkdown.providers.tools(true))).codex;
 assert.equal(tool.ok,true);assert.equal(tool.source,'settings');assert.equal(path.resolve(tool.path),path.resolve(executable));assert.equal(tool.version,'0.162.0-alpha.17.2');record.chosen=tool;
 record.checks.push('Visible Codex field and Save persist the actual installed executable; fresh native --version inspection reports Settings provenance and expected version.');persist();
 await open();await page.locator('[data-tool-status="codex"]').filter({hasText:'from this setting'}).waitFor();assert.equal(await page.locator('#codex-binary').inputValue(),executable);await shot('02-selected');
 await page.locator('#codex-binary').fill('codex');await page.locator('[data-act="save"]').click();
 await page.getByText('The Codex path must be absolute',{exact:false}).waitFor();
 assert.equal(await page.locator('#bw-dialog').evaluate(e=>e.hidden),false);assert.equal((await page.evaluate(()=>window.barkdown.settings.get())).providerBinary.codex,executable);
 await shot('03-relative-refused');await page.locator('[data-act="cancel"]').click();await page.waitForFunction(()=>document.querySelector('#bw-dialog').hidden);
 record.checks.push('Relative path Save is refused visibly; dialog remains open, prior persisted selection survives, and Cancel discards the attempted edit.');persist();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:900,height:760}));await open();assert.equal(await page.locator('#codex-binary').inputValue(),executable);await page.locator('[data-tool-status="codex"]').filter({hasText:'from this setting'}).waitFor();await shot('04-narrow');await page.locator('[data-act="cancel"]').click();
 record.checks.push('At native 900×760 window bounds the selected field and Save remain within the actual screenshot viewport.');persist();
 await close();await launch();
 const restored=await page.evaluate(()=>window.barkdown.settings.get());assert.equal(restored.providerBinary.codex,executable);
 await open();assert.equal(await page.locator('#codex-binary').inputValue(),executable);await page.locator('[data-tool-status="codex"]').filter({hasText:'from this setting'}).waitFor();
 const reread=(await page.evaluate(()=>window.barkdown.providers.tools(true))).codex;assert.equal(reread.ok,true);assert.equal(reread.source,'settings');assert.equal(reread.version,tool.version);assert.equal(path.resolve(reread.path),path.resolve(executable));record.restored=reread;
 await shot('05-restarted');record.checks.push('A new Electron main process reads the same selected path/version from disk and renders it without any repair write.');
 assert.equal(git(['status','--porcelain','--','app']).trim(),'');assert.equal(git(['rev-parse','HEAD:app']).trim(),appTree);
 record.status='passed';
}catch(error){record.status='failed';record.error=String(error.stack||error);try{await page?.screenshot({path:out+'/failure.png'});}catch{}}
finally{try{await close();}catch(error){record.status='failed';record.cleanupError=String(error.stack||error);}record.elapsedMs=Date.now()-started;persist();console.log(JSON.stringify({status:record.status,elapsedMs:record.elapsedMs,checks:record.checks,frames:record.frames.map(r=>r.name),error:record.error,output:out}));if(record.status!=='passed')process.exitCode=1;}})();
