import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url),{createProfileRegistry}=require('../main/profile-registry'),{createProfileService}=require('../main/profile-service');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-send-preserve-')),registry=createProfileRegistry(root),profile=registry.createProfile({name:'B'});let dispatches=0;
const service=createProfileService({registry,agent:{start(){dispatches++;throw Error('unexpected dispatch');}}}),owner=service.view();
const dom=new JSDOM(fs.readFileSync(new URL('../renderer/index.html',import.meta.url),'utf8'),{url:'http://localhost'});for(const k of ['window','document','HTMLElement','Node','CustomEvent'])globalThis[k]=dom.window[k];
const api={state:{save:s=>Promise.resolve(service.save(owner,s))},agent:{start:(chatId,messages,context,provider,session,prompt,images)=>service.start(owner,{chatId,provider,prompt,images})}};window.barkdown=api;
const {state,newChat,serialise,save}=await import('../renderer/src/state.js');const {mountComposer}=await import('../renderer/src/composer.js');state.profileId=profile.id;state.generation=owner.generation;state.settings={provider:'api',providers:{}};
const chat=newChat();state.current=chat.id;chat.draft='Preserve missing-image prompt';chat.draftImages=[{id:'same',path:path.join(registry.storeFor(profile.id).storeDir,'attachments','same.png'),url:'file:///missing.png',name:'same.png',mime:'image/png'}];service.save(owner,serialise());
let composer;composer=mountComposer(document.querySelector('#bw-compose'),()=>chat,{render:()=>composer?.render(),changed(){},folderChanged(){},openProject(){},startFolderChat(){}},true);composer.render();document.querySelector('#bw-compose').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,600));save.flush();await new Promise(r=>setTimeout(r,10));
const after=service.load(owner),saved=after.chats[chat.id];console.log(JSON.stringify({root,dispatches,draft:saved.draft,images:saved.draftImages.length,messages:saved.messages.length,error:chat.messages.at(-1)?.error}));assert.equal(dispatches,0);assert.equal(saved.draft,'Preserve missing-image prompt');assert.equal(saved.draftImages.length,1);assert.match(chat.messages.at(-1).error,/ENOENT/);
console.log('PASS actual shared composer preserves rejected prompt and missing image reference through authoritative reload');

const {cloneComposer}=await import('../renderer/src/composer.js');
const {isSubmitting}=await import('../renderer/src/conversation.js');
const main=document.querySelector('#bw-compose'),input=document.querySelector('#bw-prompt');
const sideForm=cloneComposer();document.body.appendChild(sideForm);let side;side=mountComposer(sideForm,()=>chat,{render:()=>side?.render(),changed(){},folderChanged(){},openProject(){},startFolderChat(){}});
const type=text=>{input.value=text;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
const submit=form=>form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
for(const scenario of ['unchanged','newer','away-and-back','attachment-removed','rejected-newer']){
 chat.runId=null;chat.interruption=null;chat.draft='Original '+scenario;chat.draftImages=[{id:'same',path:'kept-reference',url:'file:///kept.png',name:'kept.png'}];composer.render();side.render();let release,calls=0;api.agent.start=async()=>{calls++;return new Promise((resolve,reject)=>{release=()=>scenario==='rejected-newer'?reject(Error('Runtime acquisition failed')):resolve({runId:'accepted-'+scenario});});};
 submit(main);for(let i=0;i<50&&!release;i++)await new Promise(r=>setTimeout(r,2));assert.ok(release);assert.equal(isSubmitting(chat),true);submit(main);submit(sideForm);assert.equal(calls,1,'one intent across both composers');
 if(scenario==='newer'||scenario==='rejected-newer')type('Newer human text');
 if(scenario==='away-and-back'){type('Temporary human edit');type('Original '+scenario);}
 if(scenario==='attachment-removed')document.querySelector('#bw-attachments [data-remove]').click();
 release();for(let i=0;i<50&&isSubmitting(chat);i++)await new Promise(r=>setTimeout(r,2));assert.equal(isSubmitting(chat),false);save.flush();await new Promise(r=>setTimeout(r,5));
 const expected=scenario==='unchanged'?'':scenario==='newer'||scenario==='rejected-newer'?'Newer human text':'Original '+scenario;assert.equal(chat.draft,expected,scenario);assert.equal(service.load(owner).chats[chat.id].draft,expected,scenario+' durable');assert.equal(chat.draftImages.length,['unchanged','attachment-removed'].includes(scenario)?0:1);assert.equal(calls,1);if(scenario==='rejected-newer')assert.equal(chat.messages.at(-1).error,'Runtime acquisition failed');
}
side.destroy();composer.destroy();dom.window.close();console.log('PASS delayed acceptance/rejection, same-chat main/side duplicate guard, newer text, edit-away-and-back and attachment revisions');
