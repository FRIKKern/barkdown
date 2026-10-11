// Private evidence adapter: packaged executable/discovery in place of source launch; same lifecycle assertions.
// Actual Windows Electron consumer of the carried runtime, with disposable profile data.
// Source Electron is deliberately distinct from installed/clean-machine acceptance.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { LINE_END } from "file:///C:/Users/Frikk/Documents/GitHub/barkdown/app/tests/helpers/keys.mjs";
const require = createRequire("C:\\Users\\Frikk\\Documents\\GitHub\\barkdown\\app\\package.json");
const { PNG } = require('pngjs');
const { createProfileRegistry } = require('./main/profile-registry');
const { createStore } = require('./main/store');
const { createRuntimeRecord } = require('./main/runtime-orphan');
const { releaseOf, toolchain } = require('./main/local-barkpark-source');
const { powershell, systemRoot, systemTool } = require('./main/windows-system-tools');
if (process.platform !== 'win32') throw new Error('This proof requires Windows');
const appRoot = "C:\\Users\\Frikk\\Documents\\GitHub\\barkdown\\app";
const [releaseArg, evidenceArg] = process.argv.slice(2);
if (!releaseArg || !evidenceArg) throw new Error('Usage: node app/tests/runtime-release-windows-electron.live.mjs <complete release> <new evidence>');
const bundle = path.resolve(releaseArg), source = path.join(bundle, 'resources', 'runtime'), out = path.resolve(evidenceArg);
assert.ok(fs.existsSync(path.join(bundle, 'Barkdown.exe')), 'Packaged executable exists');
const packaged = releaseOf(source);
assert.ok(packaged?.postgres, 'A stamped complete Windows runtime is required');
if (fs.existsSync(out)) throw new Error('Evidence already exists');
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'Barkdown Electron Chø '));
const carried = source;
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Windows bundled notebook' });
const dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api' });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
const data = path.join(dir, 'local-barkpark', 'runtime');
const record = createRuntimeRecord({ dataDir: data, log: () => {} });
const pgCtl = path.join(toolchain({ source: carried }).pgBin, 'pg_ctl.exe');
const systemPath = [systemTool(''), systemRoot()].join(';');
const env = { ...process.env, PATH: systemPath, BARKDOWN_PROVIDER: 'api' };
delete env.BARKDOWN_CARRIED_RUNTIME;
const report = { status: 'running', source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' }).trim(), upstream: packaged.upstream,
  startedAt: new Date().toISOString(), userData, host: `win32 ${os.release()} ${process.arch}`, checks: [], screenshots: [],
  limits: ['Actual unsigned packaged executable on this Windows developer machine; no installer or clean-machine proof', 'Fresh disposable PostgreSQL18 profile; no previous major upgrade or Mac transfer', 'No provider execution, export/import or private API confidentiality acceptance', 'Non-ASCII carried PostgreSQL uses an existing verified ASCII short alias'] };
// Bind pre-commit smoke to exact bytes, rather than claiming HEAD includes dirty source.
const inputs = ['main/local-barkpark-source.js', 'main/local-barkpark.js', 'main/windows-system-tools.js', 'main/runtime-orphan.js', 'main/local-barkpark-launch.ps1', 'main/local-barkpark-release-boot.exs', 'main/goal-worker-host.ps1', 'main/external-resource.js', 'tests/runtime-release-windows-electron.live.mjs'];
fs.mkdirSync(path.join(out, 'source'));
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, 'source', 'packaged-probe.mjs'));
report.adapter = { basis: 'unchanged committed Windows source-Electron lifecycle assertions with packaged launch/discovery adapter', sha256: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex') };
report.package = { bundle, executableSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(bundle, 'Barkdown.exe'))).digest('hex'), archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(bundle, 'resources/app.asar'))).digest('hex') };
report.inputs = inputs.map(file => { const bytes = fs.readFileSync(path.join(appRoot, file)); fs.writeFileSync(path.join(out, 'source', path.basename(file)), bytes); return { file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; });
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const checked = (name, details = {}) => { report.checks.push({ name, ...details }); persist(); console.log(name); };
let app, page, appPid, appStarted, stderr = '';
persist();
const launch = async () => {
  app = await electron.launch({ executablePath: path.join(bundle, 'Barkdown.exe'), args: [`--user-data=${userData}`], env });
  // Playwright's Windows process handle can be cmd.exe; capture Electron itself.
  appPid = await app.evaluate(() => process.pid); appStarted = createRuntimeRecord.real(appPid);
  assert.ok(appStarted, 'The owned Electron host birth is captured');
  stderr = ''; app.process().stderr?.on('data', b => { stderr = (stderr + String(b)).slice(-12000); });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
};
const ready = async () => {
  const deadline = Date.now() + 300000;
  for (;;) {
    const s = await page.evaluate(() => window.barkdown.barkpark.localStatus());
    if (s.phase === 'ready') return s;
    if (s.phase === 'failed' || Date.now() > deadline) throw new Error('Actual profile runtime not ready: ' + s.error);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const quit = async () => {
  let timer;
  try { await Promise.race([app.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Electron quit did not finish')), 90000); })]); }
  finally { clearTimeout(timer); }
};
const saved = () => page.waitForFunction(() => {
  const pane = document.querySelector('.bw-paper-pane:not([hidden])');
  return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges();
}, null, { timeout: 60000 });
const read = note => page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), note);
const shot = async (name, width, height) => {
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows().find(w => w.isVisible()).setContentSize(size.width, size.height), { width, height });
  await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });

  const base64=await app.evaluate(async({BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows().find(w=>w.isVisible());
    return (await window.webContents.capturePage()).toPNG().toString('base64');
  });
  const bytes=Buffer.from(base64,'base64');fs.writeFileSync(path.join(out,name+'.png'),bytes);
  const geometry=await page.evaluate(async()=>{
    const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);
    if(!view)return null;const rect=view.getBoundingClientRect();
    const guest=await view.executeJavaScript('({width:innerWidth,height:innerHeight,background:getComputedStyle(document.body).backgroundColor})',false);
    return {view:{width:rect.width,height:rect.height},guest};
  });
  if(geometry){report.checks.push({name:'Native capture guest viewport',frame:name,...geometry});persist();assert.ok(Math.abs(geometry.view.width-geometry.guest.width)<=1,'Guest width matches its visible tab');assert.ok(Math.abs(geometry.view.height-geometry.guest.height)<=1,'Guest height matches its visible tab');}

  const png = PNG.sync.read(bytes); assert.equal(png.width, width); assert.equal(png.height, height);
  report.screenshots.push({ file: name + '.png', width: png.width, height: png.height, purpose: 'Dark actual Paper and native-window layout review' }); persist();
};
const assertStopped = () => {
  assert.equal(record.read(), null, 'Clean quit clears the exact runtime record');
  assert.equal(spawnSync(pgCtl, ['-D', path.join(data, 'pgdata'), 'status'], { env, windowsHide: true, encoding: 'utf8', timeout: 15000 }).status, 3);
};
try {
  await launch(); await ready();
  const facts = await app.evaluate(({ app: electronApp }) => ({ path: process.env.PATH, packaged: electronApp.isPackaged, resources: process.resourcesPath, override: process.env.BARKDOWN_CARRIED_RUNTIME }));
  assert.equal(facts.path, systemPath); assert.equal(facts.packaged, true); assert.equal(facts.override, undefined); assert.equal(fs.realpathSync(facts.resources), fs.realpathSync(path.join(bundle, 'resources')));
  const descriptor = JSON.parse(fs.readFileSync(path.join(dir, 'runtime.json'), 'utf8'));
  assert.equal(descriptor.source, carried);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).barkpark, undefined);
  const running = record.read(); assert.equal(running.hostPid, appPid); assert.ok(running.startedAt);
  const listeners = JSON.parse(execFileSync(powershell(), ['-NoProfile', '-NonInteractive', '-Command', `Get-NetTCPConnection -State Listen -LocalPort ${descriptor.port} | Select-Object LocalAddress,OwningProcess | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }));
  assert.equal(listeners.LocalAddress, '127.0.0.1');
  checked('Packaged executable discovers resources/runtime without override; never-configured profile uses system-only PATH and IPv4 loopback', facts);
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('Windows carried notebook'); await saved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Quince notes persist through Windows quit and recovery.'); await saved();
  const papers = await page.evaluate(() => window.barkdown.barkpark.list());
  const note = papers.find(p => p.title === 'Windows carried notebook'); assert.ok(note);
  const original = await read(note); assert.match(original.markdown, /Quince notes persist/);
  assert.ok((await page.evaluate(() => window.barkdown.barkpark.search('Quince'))).some(p => p.id === note.id));
  assert.equal((await page.evaluate(() => window.barkdown.docs.list())).length, 0);
  checked('New page creates a real Paper; keyboard edits acknowledge and body search finds it');
  await shot('01-paper-wide', 1300, 900); await shot('02-paper-narrow', 900, 760);

  // Ordinary notes are private drafts; the upstream browser reader requires a published fixture.
  // Publish only into this proof's fresh owned profile; credentials never leave the main process.
  await app.evaluate(async({app:electronApp,safeStorage},{dir,port})=>{
    const require=process.getBuiltinModule('module').createRequire(electronApp.getAppPath()+'/package.json');
    const fs=require('node:fs'),path=require('node:path'),bp=require(path.join(electronApp.getAppPath(),'main/barkpark.js'));
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'local-credentials.json'),'utf8'));
    const value=saved.token;let token;
    if(value.startsWith('enc:'))token=safeStorage.decryptString(Buffer.from(value.slice(4),'base64'));
    else if(value.startsWith('plain:'))token=Buffer.from(value.slice(6),'base64').toString('utf8');
    else throw Error('Unsupported disposable credential');
    const config={server:'http://127.0.0.1:'+port,token,dataset:'production',writes:true};
    await bp.request(config,'POST','/v1/data/mutate/production',{mutations:[{createOrReplace:{_id:'c098-reader-tag',_type:'tag',title:'Disposable reader proof'}},{publish:{id:'c098-reader-tag',type:'tag'}}]});
    await bp.publish(config,{slug:'c098-carried-reader',title:'Disposable carried reader',description:'Private packaged reader acceptance fixture.',tags:[{tag:'c098-reader-tag',strength:90,rationale:'Disposable C098 probe'}],blocks:[{type:'paragraph',content:[{type:'text',value:'Quince notes persist in the carried reader fixture.'}]}]});
  },{dir,port:descriptor.port});

  await page.evaluate(url=>window.__barkdown.openTarget({kind:'web',url,title:'Carried reader'}),'http://127.0.0.1:'+descriptor.port+'/papers/'+encodeURIComponent('c098-carried-reader'));
  await page.locator('webview#view').last().waitFor();
  const inReader=code=>page.evaluate(c=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);if(!view)throw Error('No visible reader');return view.executeJavaScript(c,false);},code);
  const untilReader=async code=>{const deadline=Date.now()+30000;for(;;){if(await inReader(code).catch(()=>false))return;if(Date.now()>deadline)throw Error('Carried reader observable timed out: '+code);await new Promise(r=>setTimeout(r,100));}};
  await untilReader("document.body && document.body.innerText.includes('Quince notes persist')");
  const theme=await inReader("(()=>{const b=document.querySelector('[aria-label=\"Switch between dark and light mode\"]');return b?.innerText.includes('Dark mode')?(()=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})():null})()");
  if(theme)await page.evaluate(point=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);const r=view.getBoundingClientRect();if(point.x<0||point.y<0||point.x>=r.width||point.y>=r.height)throw Error('Theme control outside visible webview');view.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});view.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});},theme);

  const toggle=async()=>{
    const point=await inReader("(()=>{const b=document.querySelector('[aria-label=\"Toggle terminal (TUI) view\"]');if(!b)throw Error('Missing TUI button');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    const size=await page.locator('webview#view').last().evaluate(v=>({width:v.getBoundingClientRect().width,height:v.getBoundingClientRect().height}));
    assert.ok(point.x>=0&&point.y>=0&&point.x<size.width&&point.y<size.height,'TUI control lies within the visible guest');
    await page.evaluate(point=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);view.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});view.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});},point);
  };
  await toggle();
  await untilReader("typeof window.bpRenderTUI==='function' && document.querySelector('#bp-tui-out')?.innerText.includes('Quince notes persist') && document.querySelector('[aria-label=\"Toggle terminal (TUI) view\"]')?.getAttribute('aria-pressed')==='true'");
  const tui=await inReader("document.querySelector('#bp-tui-out').innerText");assert.doesNotMatch(tui,/TUI render failed/);
  await shot('04-reader-tui-wide',1300,900);await shot('05-reader-tui-narrow',900,760);
  await toggle();await untilReader("document.querySelector('[aria-label=\"Toggle terminal (TUI) view\"]')?.getAttribute('aria-pressed')==='false'");
  await shot('06-reader-return-narrow',900,760);
  checked('Actual packaged webview loads carried reader WASM after native TUI click and returns to reading',{slug:'c098-carried-reader',fixture:'Separate published Paper; original private draft remains unchanged',rendererExport:true,content:'Quince notes persist',input:'Native webview mouseDown/mouseUp; DOM readback, no state repair'});

  await quit(); assertStopped(); checked('Normal Electron quit stops the owned runtime and database');
  await launch(); await ready();
  const ordinary = await read(note); assert.equal(ordinary.markdown, original.markdown); assert.equal(ordinary.rev, original.rev);
  checked('Electron restart preserves exact acknowledged Paper body and revision');
  const left = record.read(); assert.equal(left.hostPid, appPid);
  assert.equal(createRuntimeRecord.real(appPid), appStarted); process.kill(appPid, 'SIGKILL');
  const deadline = Date.now() + 15000;
  while (createRuntimeRecord.real(appPid) === appStarted) { if (Date.now() > deadline) throw new Error('Owned Electron host survived SIGKILL'); await new Promise(resolve => setTimeout(resolve, 250)); }
  assert.ok(record.read(), 'Forced host death keeps reclaim evidence');
  checked('Actual Electron host is killed; its private runtime record remains');
  await launch(); await ready();
  assert.notEqual(record.read().hostPid, left.hostPid);
  assert.notEqual(createRuntimeRecord.real(left.pid), left.startedAt, 'The former owned launcher is gone');
  assert.match(stderr, /\[runtime\] reclaimed after host/);
  const recovered = await read(note); assert.equal(recovered.markdown, original.markdown); assert.equal(recovered.rev, original.rev);
  await page.evaluate(p => window.__barkdown.openTarget({ kind: 'doc', id: p.id, source: 'barkpark', paperOwner: p.paperOwner }), note);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await shot('03-paper-after-reclaim', 1300, 900);
  checked('Next Electron launch reclaims only owned leftovers and preserves exact Paper');
  await quit(); assertStopped(); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack || error); process.exitCode = 1;
  try { if (page && !page.isClosed()) await shot('99-failure', 1300, 900); } catch {}
} finally {
  if (createRuntimeRecord.real(appPid) === appStarted) try { await quit(); } catch {
    try { execFileSync(systemTool('taskkill.exe'), ['/PID', String(appPid), '/T', '/F'], { windowsHide: true, timeout: 15000 }); } catch {}
  }
  try {
    await record.reclaim({ databaseRunning: async () => spawnSync(pgCtl, ['-D', path.join(data, 'pgdata'), 'status'], { env, windowsHide: true, timeout: 15000 }).status === 0,
      stopDatabase: async () => { const fd = fs.openSync(path.join(out, 'cleanup.log'), 'a'); try { const r = spawnSync(pgCtl, ['-D', path.join(data, 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { env, windowsHide: true, timeout: 30000, stdio: ['ignore', fd, fd] }); assert.equal(r.status, 0); } finally { fs.closeSync(fd); } } });
    if (fs.existsSync(path.join(data, 'pgdata', 'PG_VERSION'))) assertStopped();
  } catch (error) { report.status = 'failed'; report.cleanupError = error.message; process.exitCode = 1; }
  report.mainStderr = stderr.replace(/bp_admin_[A-Za-z0-9_-]+/g, '[redacted]').split('\n').slice(-25);
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt); persist();
  console.log(JSON.stringify({ status: report.status, error: report.error, out, elapsedMs: report.elapsedMs }));
}
