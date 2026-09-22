// Bounded Electron-only persistent guest reproduction; no Barkdown stores/providers.
import {_electron as electron} from 'playwright';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-webview-min-'));
const exe=process.env.BARKDOWN_REPRO_EXE||require('electron'),mode=process.env.BARKDOWN_REPRO_MODE||'duplicate';
const report={root,exe,mode,requests:[],phases:[],events:[]};const server=http.createServer((q,r)=>{report.requests.push(q.url);r.end('<title>Profile website fixture</title><p>Owned website storage</p>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><body><main id="host"></main></body>');
fs.writeFileSync(path.join(root,'main.cjs'),`const {app,BrowserWindow,session}=require('electron');app.setPath('userData',${JSON.stringify(path.join(root,'userData'))});global.events=[];app.on('web-contents-created',(_e,w)=>{for(const name of ['dom-ready','did-start-loading','did-stop-loading','did-fail-load','render-process-gone','destroyed'])w.on(name,(_e,...args)=>global.events.push({id:w.id,name,args,at:Date.now()}));});app.whenReady().then(()=>{const w=new BrowserWindow({width:900,height:600,webPreferences:{webviewTag:true,contextIsolation:true,nodeIntegration:false,sandbox:false}});w.webContents.on('will-attach-webview',(_e,p,params)=>{p.partition=params.partition;p.nodeIntegration=false;p.contextIsolation=true;p.sandbox=true;delete p.preload;session.fromPartition(params.partition).setPermissionRequestHandler((_c,perm,cb)=>cb(['clipboard-read','fullscreen'].includes(perm)));});w.loadFile(${JSON.stringify(path.join(root,'index.html'))});});`);
let app,page;
try{app=await electron.launch({executablePath:exe,args:[path.join(root,'main.cjs')]});page=await app.firstWindow();report.version=await app.evaluate(()=>process.versions.electron);
for(const [i,owner] of ['A','B','A'].entries()){
 if(i)await page.reload();
 await page.evaluate(({owner,url})=>{const v=document.createElement('webview');v.id='guest';v.setAttribute('partition','persist:mini-'+owner);v.setAttribute('allowpopups','false');v.style='width:850px;height:500px';document.querySelector('#host').appendChild(v);v.setAttribute('src',url);},{owner,url:i===2?url+'/':url});
 if(i===2&&mode==='duplicate')await page.evaluate(url=>document.querySelector('webview').setAttribute('src',url),url);
 await page.waitForFunction(()=>{try{return document.querySelector('webview').getTitle()==='Profile website fixture';}catch{return false;}},{},{timeout:12000});
 const state=await page.evaluate(owner=>document.querySelector('webview').executeJavaScript(`const old=localStorage.getItem('owner');localStorage.setItem('owner',${JSON.stringify(owner)});({old,title:document.title})`),owner);report.phases.push({owner,state});}
 report.passed=true;await page.screenshot({path:path.join(root,'result.png')});
}catch(error){report.passed=false;report.error=error.stack;await page?.screenshot({path:path.join(root,'result.png')}).catch(()=>{});}
finally{if(app){report.events=await app.evaluate(()=>global.events).catch(()=>[]);await app.close();}await new Promise(r=>server.close(r));report.stopped=true;fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}if(!report.passed)process.exitCode=1;
