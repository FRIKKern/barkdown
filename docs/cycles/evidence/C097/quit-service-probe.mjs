// Real Electron and a disposable profile store; no provider or local server.
import { _electron as electron } from '../../../../node_modules/playwright/index.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const appRoot = path.resolve('app');
const { createProfileRegistry } = require('../../../../app/main/profile-registry');
const { createStore } = require('../../../../app/main/store');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-workspace-quit-'));
const out = path.resolve(process.argv[2] || path.resolve('docs/cycles/evidence/C097/quit-service-native-01'), new Date().toISOString().replace(/[:.]/g, '-') + '-workspace-quit');
fs.mkdirSync(out, { recursive: true });
const registry = createProfileRegistry(path.join(root, 'profile-data'));
const profile = registry.createProfile({ name: 'Disposable draft' }); registry.selectProfile(profile.id);
const store = registry.storeFor(profile.id), file = path.resolve(store.storeDir, 'workspace.json');
assert(file.startsWith(path.resolve(root) + path.sep));
store.writeJson('workspace.json', { version: 1, chats: { main: { id: 'main', title: 'Quit draft', messages: [], tabs: [], events: [], draft: '', closedTargets: [] } }, order: ['main'], current: 'main', favorites: [], pages: null });
store.writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { decided: true, enabled: false, local: { enabled: false } } });
createStore(path.join(root, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
const report = { status: 'running', platform: process.platform, root, out, profileId: profile.id, assertions: [], images: [], scope: 'Diagnostic at24c16e05. Actual Electron main, IPC and service owners; disposable workspace obstruction and restored original. Native dialog intercepted. No provider or Paper runtime. Expected service continuity is asserted after refusal.' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
let app, page, obstructed = false;
const backup = file + '.retained', obstruction = file + '.obstruction';
async function launch() {
  app = await electron.launch({ executablePath: require('../../../../app/node_modules/electron'), args: [appRoot, '--profiles', `--user-data=${root}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
}
async function quit() {
  let timer; const closed = new Promise((resolve, reject) => { app.once('close', resolve); timer = setTimeout(() => reject(new Error('Quit did not complete')), 20000); });
  try { await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); }); await closed; app = null; }
  finally { clearTimeout(timer); }
}
const owner = () => page.evaluate(() => { const s=window.__barkdown.state; return { profileId:s.profileId,generation:s.generation,chatId:'main' }; });
const list = async () => page.evaluate(o=>window.barkdown.goals.list(o),await owner());
const shell = () => page.evaluate(root=>window.barkdown.term.start('diagnostic-shell',root,'main'),root);
try {
  await launch(); report.beforeGoals = await list(); assert.deepEqual(report.beforeGoals,[]);
  const beforeShell = await shell(); report.beforeShell = {started:true};
  await page.evaluate(s=>window.barkdown.term.stop(s),beforeShell);
  await page.evaluate(async()=>{const s=await window.barkdown.state.load();await window.barkdown.state.save(s);});
  fs.renameSync(file,backup);fs.mkdirSync(file);obstructed=true;
  await page.locator('textarea').first().fill('Refused quit continuity probe draft');
  await page.getByText(/Changes are not saved/).waitFor();
  await app.evaluate(({dialog})=>{globalThis.__workspaceQuitDialogs=[];dialog.showMessageBox=async(_w,options)=>{globalThis.__workspaceQuitDialogs.push(options);return {response:0};};});
  await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0);});
  const deadline=Date.now()+20000;
  while(true){const dialogs=await app.evaluate(()=>globalThis.__workspaceQuitDialogs);if(dialogs.length){report.dialogs=dialogs;break;}assert(Date.now()<deadline,'No refusal');await new Promise(r=>setTimeout(r,100));}
  assert.equal(page.isClosed(),false);await page.waitForFunction(()=>!document.body.inert);
  fs.renameSync(file,obstruction);fs.renameSync(backup,file);obstructed=false;
  // Store is repaired before requests: read/save and intact draft are controls.
  report.currentDraft=await page.locator('textarea').first().inputValue();
  await page.evaluate(async()=>{const s=await window.barkdown.state.load();await window.barkdown.state.save(s);});
  const observe=async fn=>{try{return {ok:true,value:await fn()};}catch(e){return {ok:false,error:e.message};}};
  report.afterGoals=await observe(list);report.afterShell=await observe(shell);
  await quit();await launch();report.restartGoals=await list();
  const restarted=await shell();report.restartShell={started:true};await page.evaluate(s=>window.barkdown.term.stop(s),restarted);
  assert.equal(await page.locator('textarea').first().inputValue(),'Refused quit continuity probe draft');
  await quit();
  report.status=report.afterGoals.ok&&report.afterShell.ok?'passed':'failed';persist();console.log(JSON.stringify(report));
  assert.equal(report.status,'passed','Refused quit must leave goal list and new terminal available after storage is restored');
} catch(error){report.status='failed';report.error=error.stack;persist();throw error;}
finally{if(obstructed){fs.renameSync(file,obstruction);fs.renameSync(backup,file);}if(app)await app.close().catch(()=>app.process().kill());}
