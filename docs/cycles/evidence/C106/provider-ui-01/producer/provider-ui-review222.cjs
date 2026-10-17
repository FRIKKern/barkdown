const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown',base='C:/Users/Frikk/Documents/GitHub/barkdown/.git',prior=JSON.parse(fs.readFileSync(base+'/C106-provider-ui-221/result.json'));
assert.equal(prior.status,'passed');const out=base+'/C106-provider-ui-review-222';fs.mkdirSync(out);fs.mkdirSync(out+'/frames');
const req=createRequire(root+'/app/package.json'),{_electron:electron}=req('playwright');
const env={...process.env,HOME:prior.data+'/home',USERPROFILE:prior.data+'/home',CODEX_HOME:prior.data+'/home/.codex',CLAUDE_CONFIG_DIR:prior.data+'/home/.claude',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',OPENAI_API_KEY:'',BARKDOWN_PROVIDER:''};delete env.ELECTRON_RUN_AS_NODE;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),report={at:new Date().toISOString(),source:prior.source,status:'running',frames:[],steps:[]};
let app,page,stopped=false,capture;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const write=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');write();
(async()=>{try{
 app=await electron.launch({executablePath:req('electron'),args:[root+'/app','--profiles',`--user-data=${prior.data}/user-data`],env,timeout:60000});report.pid=app.process().pid;
 page=await app.firstWindow({timeout:60000});page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.__barkdown?.state.loaded);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:900,height:760}));
 const before=await page.evaluate(()=>window.barkdown.settings.get());assert.equal(before.providerBinary.codex,prior.executable);
 const start=Date.now();capture=(async()=>{while(!stopped){const at=Date.now();const file=out+'/frames/'+String(report.frames.length).padStart(4,'0')+'.png';await page.screenshot({path:file});report.frames.push({file,ms:at-start});await sleep(Math.max(0,125-(Date.now()-at)));}})();
 const step=text=>report.steps.push({ms:Date.now()-start,text});
 step('Open Settings with supported Ctrl+, shortcut');await page.keyboard.press('Control+,');await page.locator('button[data-pane="assistant"]').click();await page.locator('#codex-binary').scrollIntoViewIfNeeded();await page.locator('[data-tool-status="codex"]').filter({hasText:'from this setting'}).waitFor();await sleep(1000);
 assert.equal(await page.locator('#codex-binary').inputValue(),prior.executable);step('Persisted installed CLI remains selected; submit a relative path');await page.locator('#codex-binary').fill('codex');await page.locator('[data-act="save"]').click();await page.getByText('The Codex path must be absolute',{exact:false}).waitFor();await sleep(800);
 assert.equal((await page.evaluate(()=>window.barkdown.settings.get())).providerBinary.codex,prior.executable);step('Cancel refused edit and reopen; wait for actual toast expiry');await page.locator('[data-act="cancel"]').click();await page.keyboard.press('Control+,');await page.locator('button[data-pane="assistant"]').click();await page.locator('#codex-binary').scrollIntoViewIfNeeded();await page.locator('[data-tool-status="codex"]').filter({hasText:'from this setting'}).waitFor();
 await page.getByText('The Codex path must be absolute',{exact:false}).waitFor({state:'hidden'});
 await page.getByText('No assistant sign-in found.',{exact:false}).waitFor({state:'hidden'});
 assert.equal(await page.locator('#codex-binary').inputValue(),prior.executable);step('Settled narrow Settings; field, path identity and footer readable');await sleep(1000);
 stopped=true;await capture;capture=null;
 await page.screenshot({path:out+'/narrow-settled.png'});
 report.geometry=await page.evaluate(()=>{const get=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {viewport:{width:innerWidth,height:innerHeight},field:get('#codex-binary'),save:get('[data-act="save"]'),cancel:get('[data-act="cancel"]')};});
 for(const key of ['field','save','cancel']){const b=report.geometry[key],v=report.geometry.viewport;assert(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1);}
 assert.equal((await page.evaluate(()=>window.barkdown.providers.tools(true))).codex.version,prior.chosen.version);
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);}
finally{stopped=true;if(capture)await capture.catch(e=>report.captureError=String(e));if(app){await app.close();report.closed=true;}write();}
if(report.status==='passed'){
 const args=['-loop','0'];for(let i=0;i<report.frames.length;i++){const f=report.frames[i],next=report.frames[i+1];const delay=Math.max(1,Math.round(((next?.ms??f.ms+125)-f.ms)/10));args.push('-delay',String(delay),f.file);}
 args.push('-resize','884x','-dither','FloydSteinberg','-layers','Optimize',out+'/settings.gif');execFileSync('magick',args,{windowsHide:true,maxBuffer:4e6,timeout:60000});
 report.gif={file:out+'/settings.gif',bytes:fs.statSync(out+'/settings.gif').size,sha256:hash(fs.readFileSync(out+'/settings.gif'))};report.settled={file:out+'/narrow-settled.png',sha256:hash(fs.readFileSync(out+'/narrow-settled.png'))};write();
}
console.log(JSON.stringify({status:report.status,frames:report.frames.length,steps:report.steps,gif:report.gif,error:report.error}));if(report.status!=='passed')process.exitCode=1;
})();
