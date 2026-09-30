import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),appDir=path.resolve(import.meta.dirname,'..');
for (const chosen of [null,'api','codex']) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-discovery-'));
  fs.mkdirSync(path.join(root,'barkdown'));
  if(chosen) fs.writeFileSync(path.join(root,'barkdown','settings.json'),JSON.stringify({provider:chosen}));
  const boot=path.join(root,'boot.cjs');
  fs.writeFileSync(boot,`
    const {app}=require('electron');app.setAppPath(${JSON.stringify(appDir)});
    const req=require('node:module').createRequire(${JSON.stringify(path.join(appDir,'main/main.js'))});
    const login=req('./provider-login'),original=login.createProviderLogin;
    global.discoveryChecks=[];
    login.createProviderLogin=options=>original({...options,launch:async({onMessage})=>{
      let finish;const finished=new Promise(resolve=>finish=resolve);
      return {ready:Promise.resolve(),finished,stop(){finish({});},send(message){
        if(message.operation!=='status')throw Error('Unexpected login mutation');
        global.discoveryChecks.push(message.provider);
        onMessage({type:'result',state:message.provider==='claude'?'signed-in':'signed-out'});
      }};
    }});
    // No credential-file hint: only the controlled supported status is positive.
    req('./providers/claude').loggedIn=()=>false;
    req('./providers/codex').loggedIn=()=>false;
    require(${JSON.stringify(path.join(appDir,'main/main.js'))});
  `);
  let app;
  try {
    app=await electron.launch({executablePath:require('electron'),args:[boot, '--legacy','--user-data='+root],env:{...process.env,BARKDOWN_PROVIDER:'',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',CLAUDE_CODE_OAUTH_TOKEN:'',CODEX_API_KEY:''}});
    const page=await app.firstWindow();await page.waitForFunction(()=>window.__barkdown?.state.loaded);
    const settings=await page.evaluate(()=>window.__barkdown.state.settings);
    assert.equal(settings.provider,chosen||'claude');
    assert.equal(settings.providerChosen,Boolean(chosen));
    assert.equal(settings.providers.claude.loggedIn,true);
    assert.equal(settings.providers.codex.loggedIn,false);
    assert.deepEqual((await app.evaluate(()=>global.discoveryChecks)).sort(),['claude','codex']);
    console.log('PASS native initial status discovery; explicit provider:',chosen||'(none)');
  } finally {if(app)await app.close();}
}
