import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {createLibraryRefresh}=await import(pathToFileURL(path.join(process.cwd(),'app/renderer/src/library-refresh.js')));
const {mountControl}=await import(pathToFileURL(path.join(process.cwd(),'app/renderer/src/control.js')));
for(const mode of ['healthy-empty','cached-unavailable','empty-unavailable']) await test(mode,async()=>{
 const state={profileId:'fixture-profile',generation:'fixture-generation',documents:[],barkparkDocs:[],pages:{roots:['human-page'],children:{}},settings:{barkpark:{enabled:true,server:'https://fixture.invalid',dataset:'production',catalogGeneration:1}}};
 let invoke,answer,offline=false;const warnings=[];
 const api={docs:{list:async()=>[]},barkpark:{list:async()=>{if(offline)throw Object.assign(new Error('Paper library refresh incomplete: permission lost on page 2.'),{code:'catalog_incomplete'});return mode==='cached-unavailable'?[{id:'old-note',title:'Last successful result'}]:[];}},control:{onInvoke(fn){invoke=fn;return ()=>{};},result:async value=>{answer=value;}}};
 const refreshLibrary=createLibraryRefresh({state,api,report:message=>warnings.push(message),render(){}});
 await refreshLibrary();offline=mode!=='healthy-empty';
 mountControl({api,state,controllers:new Map(),DIRECT:'direct',refreshLibrary});
 await invoke({id:mode,command:'note.list',args:{},context:{}});
 console.log(JSON.stringify({mode,answer,libraryError:state.barkparkLibraryError,warnings,cache:state.barkparkDocs,pages:state.pages}));
 assert.deepEqual(state.pages,{roots:['human-page'],children:{}});
 if(mode==='healthy-empty'){assert.equal(answer.ok,true);assert.deepEqual(answer.result,[]);}
 else {assert(state.barkparkLibraryError);assert.equal(answer.ok,false,'A failed refresh must not become successful cached/empty control output');}
});
