const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');const original=process.cwd().replaceAll('\\','/'),root='C:/Users/Frikk/.codex/worktrees/g2-editor-contract/barkdown',out=original+'/.git/G2-native-subsup-80';fs.mkdirSync(out);let source=fs.readFileSync(root+'/app/tests/editor-subsup.live.mjs','utf8');source=source.replaceAll("'./lib/paper-fixture.mjs'","'file:///"+root+"/app/tests/lib/paper-fixture.mjs'").replaceAll("'./helpers/keys.mjs'","'file:///"+root+"/app/tests/helpers/keys.mjs'").replace('createRequire(import.meta.url)',()=>"createRequire('"+root+"/app/package.json')").replaceAll("'test-results/40-","'"+out+"/40-");
const instrument=`
await app.evaluate(({ BrowserWindow }) => {
  globalThis.__subsupNative = [];
  BrowserWindow.getAllWindows()[0].webContents.on('before-input-event', (_event, input) => {
    globalThis.__subsupNative.push({type:input.type,key:input.key,code:input.code,control:input.control,meta:input.meta,alt:input.alt,shift:input.shift});
  });
});
await page.evaluate(() => {
  window.__subsupInputs = [];
  document.addEventListener('keydown', event => {
    const editor = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')?._editor;
    const selection = editor?.state.selection;
    window.__subsupInputs.push({key:event.key,control:event.ctrlKey,meta:event.metaKey,target:event.target?.tagName,
      targetInPaper:Boolean(event.target?.closest?.('bp-paper-canvas')),focused:document.activeElement?.tagName,
      hasFocus:document.hasFocus(),editorFocused:Boolean(editor?.isFocused),settingsOpen:Boolean(document.querySelector('.bw-settings')),
      selection:selection?{from:selection.from,to:selection.to,text:editor.state.doc.textBetween(selection.from,selection.to)}:null,
      nativeText:window.getSelection()?.toString()});
  }, true);
});
`;
source=source.replace('const errors = [];',()=>instrument+'\nconst errors = [];');const diagnostics=`const diagnostics = { renderer:await page.evaluate(()=>window.__subsupInputs), main:await app.evaluate(()=>globalThis.__subsupNative),
  bundle:JSON.parse(fs.readFileSync(path.join(userData,'canvas-bundle/current.json'),'utf8')) };
fs.writeFileSync('${out}/diagnostics.json',JSON.stringify(diagnostics,null,2)+'\\n');
`;source=source.replace('const passed = results.filter',()=>diagnostics+'\nconst passed = results.filter');assert(source.includes('__subsupInputs'));fs.writeFileSync(out+'/probe.mjs',source);fs.copyFileSync(__filename,out+'/producer.cjs');const plan={at:new Date().toISOString(),host:'committed native selection observer',backend:'2ff67c882cf0951676c8322bbcc15e19f2f98545',runtimeSource:'C:/Users/Frikk/Documents/GitHub/barkdown/runtime/C105-full-current-08',scope:'Diagnostic copy of unchanged actual native Sup/Sub row, with read-only DOM/model/native-key observers. Disposable SourceDriver data and CLI config; no product edit. Backend differs from current merged CI but its server editor873215c8 matches the failed current matrix; do not claim whole-current-upstream acceptance.',budget:'One focused native diagnostic run, then inspect actual setup/input before any repair.'};fs.writeFileSync(out+'/plan.json',JSON.stringify(plan,null,2)+'\n');
const began=Date.now(),fd=fs.openSync(out+'/diagnostic.log','wx');let r;try{r=spawnSync(process.execPath,['tests/status-shots-isolated.mjs',out+'/probe.mjs'],{cwd:root+'/app',stdio:['ignore',fd,fd],windowsHide:true,timeout:1200000,env:{...process.env,BARKDOWN_TEST_BP_SOURCE:plan.runtimeSource,BARKDOWN_TEST_FOREGROUND:'1'}});}finally{fs.closeSync(fd);}const result={at:new Date().toISOString(),exitCode:r.status,status:r.status===0?'passed':'failed',signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-began,scope:plan.scope};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=result.exitCode===0?0:1;
