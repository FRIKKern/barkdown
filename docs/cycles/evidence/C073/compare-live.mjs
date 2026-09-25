import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {comparePixels} from '../../../../scripts/visual-diff.mjs';
const require=createRequire(path.resolve('app/package.json'));
const {PNG}=require('pngjs');
const out='docs/cycles/evidence/C073';
const before=JSON.parse(execFileSync('git',['show','HEAD:docs/images/status/manifest.json'],{encoding:'utf8'}));
const after=JSON.parse(fs.readFileSync('docs/images/status/manifest.json','utf8'));
const results=[];
for(const shot of after.shots.filter(x=>x.file.endsWith('.png'))){
 const stem=shot.file.split('.')[0], prior=before.shots.find(x=>x.file.startsWith(stem+'.'));
 const a=PNG.sync.read(fs.readFileSync('docs/images/status/'+prior.file)),b=PNG.sync.read(fs.readFileSync('docs/images/status/'+shot.file));
 const {diff,...metrics}=comparePixels(a,b);if(diff)fs.writeFileSync(`${out}/${stem}-diff.png`,PNG.sync.write({width:b.width,height:b.height,data:diff}));
 results.push({name:stem,before:prior.file,after:shot.file,...metrics});
}
fs.writeFileSync(out+'/visual-comparison.json',JSON.stringify({before:before.barkparkCommit,after:after.barkparkCommit,results},null,2)+'\n');
console.log(results.map(({name,kind,changedRatio})=>({name,kind,changedRatio})));
