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
const userData="C:\\Users\\Frikk\\AppData\\Local\\Temp\\Barkdown Electron Chø KKcF4F";
const carried=source;
const registry=createProfileRegistry(path.join(userData,'profile-data'));
const selected=registry.load();const profile=selected.profiles.find(p=>p.id===selected.selectedProfileId);assert.ok(profile);
const dir=registry.storeFor(profile.id).storeDir;
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


  await page.waitForFunction(async()=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);if(!view)return true;const r=view.getBoundingClientRect();const size=await view.executeJavaScript('({width:innerWidth,height:innerHeight})',false);return Math.abs(r.width-size.width)<=1&&Math.abs(r.height-size.height)<=1;});
  await page.evaluate(async()=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);if(view)await view.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',false);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
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
  report.limits.push('Focused reader capture reuses completed05 disposable profile; no new lifecycle or real-library acceptance');
  report.adapter.basis='Native capturePage after guest viewport and compositor frame settlement; read-only reader journey on completed05 private profile';
  await launch();await ready();
  const descriptor=JSON.parse(fs.readFileSync(path.join(dir,'runtime.json'),'utf8'));
  const papers=await page.evaluate(()=>window.barkdown.barkpark.list());const note=papers.find(p=>p.title==='Windows carried notebook');assert.ok(note);
  const before=await read(note);
  await page.evaluate(url=>window.__barkdown.openTarget({kind:'web',url,title:'Carried reader'}),'http://127.0.0.1:'+descriptor.port+'/papers/c098-carried-reader');
  await page.locator('webview#view').last().waitFor();
  const inReader=code=>page.evaluate(c=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0);if(!view)throw Error('No visible reader');return view.executeJavaScript(c,false);},code);
  const until=async code=>{const deadline=Date.now()+30000;for(;;){if(await inReader(code).catch(()=>false))return;if(Date.now()>deadline)throw Error('Reader observable timeout');await new Promise(r=>setTimeout(r,100));}};
  await until("document.body && document.body.innerText.includes('Quince notes persist')");
  const click=async selector=>{
    const point=await inReader('(()=>{const b=document.querySelector('+JSON.stringify(selector)+');if(!b)throw Error("Missing reader control");const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await page.evaluate(point=>{const view=[...document.querySelectorAll('webview#view')].find(v=>v.getBoundingClientRect().width>0),r=view.getBoundingClientRect();if(point.x<0||point.y<0||point.x>=r.width||point.y>=r.height)throw Error('Control outside visible guest');view.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});view.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});},point);
  };
  const button='[aria-label="Toggle terminal (TUI) view"]';
  if(await inReader('document.querySelector('+JSON.stringify(button)+').getAttribute("aria-pressed")==="true"'))await click(button);
  const mode='[aria-label="Switch between dark and light mode"]';if(await inReader('document.querySelector('+JSON.stringify(mode)+').innerText.includes("Dark mode")'))await click(mode);
  await click(button);await until("typeof window.bpRenderTUI==='function' && document.querySelector('#bp-tui-out')?.innerText.includes('Quince notes persist')");
  await shot('01-reader-tui-wide-settled',1300,900);await shot('02-reader-tui-narrow-settled',900,760);
  const layout=await inReader("(()=>{const out=document.querySelector('#bp-tui-out');const p=out.parentElement;return {text:out.innerText,parentWidth:p.clientWidth,parentScrollWidth:p.scrollWidth,outputWidth:out.clientWidth,outputScrollWidth:out.scrollWidth}})()");
  checked('Carried TUI renderer and native viewport settled before capture',{layout,limits:'Upstream80-column TUI overflows a narrow tab with its own visible horizontal scrollbar; default reader wraps'});
  await click(button);await until('document.querySelector('+JSON.stringify(button)+').getAttribute("aria-pressed")==="false"');await shot('03-reader-return-narrow-settled',900,760);
  const after=await read(note);assert.equal(after.markdown,before.markdown);assert.equal(after.rev,before.rev);
  await quit();assertStopped();checked('Read-only focused reader journey preserves private draft and stops owned services');report.status='passed';

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
