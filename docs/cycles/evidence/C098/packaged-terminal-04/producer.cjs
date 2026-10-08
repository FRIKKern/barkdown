'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const [bundle,out,storeDir,folder]=process.argv.slice(2),start=performance.now();
const packagedRequire=createRequire(path.join(bundle,'resources','app.asar','package.json'));
const service=packagedRequire('./main/terminal').createTerminalService();
const owner={profileId:crypto.randomUUID(),chatId:'c098-prerequisite',id:'terminal'};
const ps=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
const report={status:'running',startedAt:new Date().toISOString(),host:{execPath:process.execPath,node:process.version,platform:process.platform,arch:process.arch,os:os.release(),path:process.env.PATH},owner,storeDir,folder,checks:[],limits:['Actual packaged terminal service and production owned worker; no GUI terminal journey or installer acceptance','OS-only PATH; shell environment hydration is deliberately not installed in this Node-mode evidence host','This developer host has system runtime libraries installed; not clean-machine acceptance','Modern Windows ConPTY branch only; alternate WinPTY and ARM64 adapters remain unproven']};
const persist=()=>fs.writeFileSync(path.join(out,'native-result.json'),JSON.stringify(report,null,2)+'\n');
const check=(name,details={})=>{report.checks.push({name,...details});persist();console.log(name)};
let text='',session;
const events=[];
const options={...owner,storeDir,root:folder,cols:100,rows:30,send:event=>{events.push(event);if(event.type==='data')text+=event.data;}};
const wait=async predicate=>{const end=Date.now()+15000;while(!predicate()){if(Date.now()>end)throw Error('Terminal observation timed out: '+text.slice(-2000));await new Promise(r=>setTimeout(r,50));}};
const command=async(line,marker)=>{service.input({...owner,sessionId:session.sessionId},line);await wait(()=>text.includes(marker));};
const rawCommand=async line=>service.input({...owner,sessionId:session.sessionId},line);
persist();
(async()=>{
 try{
  assert.equal(path.resolve(process.execPath).toLowerCase(),path.join(bundle,'Barkdown.exe').toLowerCase());
  session=await service.start(options);assert.equal(session.cwd,folder);assert.equal(session.shell,'PowerShell');
  await wait(()=>/PS[^\r\n]*>\s*$/.test(text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'')));
  // Split emitted markers prevent typed command echo from satisfying observations.
  await command("Write-Output ('native-'+'ready'); Write-Output ('cwd='+$PWD.Path); Write-Output ('width='+$Host.UI.RawUI.WindowSize.Width); Write-Output ('env='+$env:TERM); Write-Output ('probe-'+'one-done')",'probe-one-done');
  assert.ok(text.includes('native-ready'));assert.ok(text.includes('cwd='+folder));assert.ok(text.includes('env=xterm-256color'));assert.ok(text.includes('width=100'));
  const receiptFile=path.join(storeDir,'goal-processes',session.sessionId+'.receipt.json');
  const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));assert.equal(receipt.phase,'assigned');assert.ok(receipt.childPid>0);
  report.assigned=receipt;report.session=session;check('Packaged service starts real PowerShell in captured folder',{width:100});
  const moduleCode=`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $p=Get-Process -Id ${receipt.childPid}; $modules=@($p.Modules | ForEach-Object { [pscustomobject]@{name=$_.ModuleName;file=$_.FileName;size=$_.ModuleMemorySize} }); [pscustomobject]@{pid=$p.Id;start=$p.StartTime.ToUniversalTime().ToString('o');modules=$modules} | ConvertTo-Json -Depth 5 -Compress`;
  const moduleBytes=execFileSync(ps,['-NoProfile','-NonInteractive','-Command',moduleCode],{windowsHide:true,timeout:15000});fs.writeFileSync(path.join(out,'loaded-modules.raw.json'),moduleBytes);
  report.loaded=JSON.parse(moduleBytes.toString('utf8').replace(/^\uFEFF/,''));
  const native=report.loaded.modules.filter(m=>m.name.toLowerCase().endsWith('.node'));assert.equal(native.length,1);
  assert.equal(native[0].name.toLowerCase(),'conpty.node');
  assert.ok(native[0].file.toLowerCase().startsWith(path.join(bundle,'resources','app.asar.unpacked','node_modules','node-pty','prebuilds','win32-x64').toLowerCase()+path.sep));
  native[0].sha256=crypto.createHash('sha256').update(fs.readFileSync(native[0].file)).digest('hex');
  assert.equal(report.loaded.modules.some(m=>/^node\.(exe|dll)$/i.test(m.name)),false);
  assert.ok(report.loaded.modules.some(m=>m.name.toLowerCase()==='barkdown.exe'));
  report.selectedNative=native;check('Actual worker loads carried x64 ConPTY under Barkdown.exe',{native});
  service.resize({...owner,sessionId:session.sessionId},52,20);
  await command("Write-Output ('width='+$Host.UI.RawUI.WindowSize.Width); Write-Output ('probe-'+'two-done')",'probe-two-done');
  assert.ok(text.includes('width=52'));check('Native terminal resize reaches PowerShell',{width:52});
  await rawCommand("Write-Output ('interrupt-'+'started'); Start-Sleep -Seconds 60; Write-Output ('unexpected-'+'sleep-end')");
  await wait(()=>text.includes('interrupt-started'));service.write({...owner,sessionId:session.sessionId},'\u0003');
  await command("Write-Output ('interrupt-'+'returned')",'interrupt-returned');assert.equal(text.includes('unexpected-sleep-end'),false);
  check('Ctrl+C interrupts actual foreground sleep');
  await service.stop({...owner,sessionId:session.sessionId});
  const stopped=JSON.parse(fs.readFileSync(receiptFile,'utf8'));assert.equal(stopped.phase,'stopped');assert.equal(stopped.activeProcesses,0);assert.equal(service.hasSessions(),false);
  report.stopped=stopped;report.finalStatus=await service.status({...owner,storeDir});assert.equal(report.finalStatus.state,'stopped');
  check('Production Job verifier settles stopped with zero active descendants');report.status='passed';
 }catch(error){report.status='failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
 finally{
  try{await service.shutdown();report.shutdown='verified';}catch(error){report.shutdown={error:error.message};report.status='failed';process.exitCode=1;}
  fs.writeFileSync(path.join(out,'terminal-stream.txt'),text);fs.writeFileSync(path.join(out,'terminal-events.json'),JSON.stringify(events,null,2)+'\n');
  report.finishedAt=new Date().toISOString();report.elapsedMs=Math.round(performance.now()-start);persist();
 }
})();
