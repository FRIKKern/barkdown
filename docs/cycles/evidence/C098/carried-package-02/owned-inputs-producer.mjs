import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {inventory,sha256} from '../scripts/runtime-postgres-bundle.mjs';
const require=createRequire(path.resolve('app/package.json')),asar=require('@electron/asar');
const archive=path.resolve('app/release/C098 Packaged Chø 02/win-unpacked/resources/app.asar'),out='docs/cycles/evidence/C098/carried-package-02/app-owned-inputs.json';if(fs.existsSync(out))throw Error('Preserve receipt');
const files=['main','shared','renderer'].flatMap(dir=>inventory(path.resolve('app',dir)).map(file=>({...file,path:dir+'/'+file.path})));
for(const file of files){const current=fs.readFileSync(path.resolve('app',file.path)),packaged=asar.extractFile(archive,file.path.replaceAll('/',path.sep));if(!packaged.equals(current))throw Error('Owned archive mismatch: '+file.path);}
fs.copyFileSync(import.meta.filename,'docs/cycles/evidence/C098/carried-package-02/owned-inputs-producer.mjs');
fs.writeFileSync(out,JSON.stringify({status:'passed',checkedAt:new Date().toISOString(),archiveSha256:sha256(archive),scope:'Every current regular file under owned app/main, shared and renderer equals actual packaged archive bytes; native path separators used',files},null,2)+'\n');console.log(JSON.stringify({status:'passed',files:files.length}));
