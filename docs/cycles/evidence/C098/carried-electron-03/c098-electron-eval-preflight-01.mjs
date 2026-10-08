import { _electron } from 'playwright';import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';
const require=createRequire(path.resolve('app/package.json'));
const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.git/c098-electron-eval-preflight-01.cjs')]});
try{const result=await app.evaluate(({app:electronApp},packageFile)=>{
  const makeRequire=process.getBuiltinModule('module').createRequire;
  const require=makeRequire(packageFile);
  const fs=require('node:fs');if(!fs.existsSync(packageFile))throw Error('Scoped module lookup failed');
  return {status:'passed',node:process.versions.node,getBuiltinModule:typeof process.getBuiltinModule,createRequire:typeof makeRequire,exists:true};
},path.resolve('app/package.json'));fs.writeFileSync('.git/c098-electron-eval-preflight-01.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}finally{await app.close();}
