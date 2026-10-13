import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const out='docs/cycles/evidence/C105/g2-preparation-03';
const started=Date.now(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown-G2-patch-'));
fs.mkdirSync(path.join(temp,'.github/workflows'),{recursive:true});
fs.copyFileSync(out+'/barkdown-parity.before.yml',path.join(temp,'.github/workflows/barkdown-parity.yml'));
function run(cmd,args,cwd=temp){const r=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
const patch=path.resolve(out+'/barkdown-parity-public.patch');
run('git',['init','--quiet']);
run('git',['add','.github/workflows/barkdown-parity.yml']);
run('git',['apply','--check',patch]);run('git',['apply',patch]);
assert.deepEqual(fs.readFileSync(path.join(temp,'.github/workflows/barkdown-parity.yml')),fs.readFileSync(out+'/barkdown-parity.proposed.yml'));
const yaml=JSON.parse(run('go',['run','.',path.resolve(out+'/barkdown-parity.before.yml'),path.resolve(out+'/barkdown-parity.proposed.yml')],path.resolve('.git/C105-g2-yaml')));
const required=JSON.parse(run('gh',['api','repos/FRIKKern/barkpark/branches/main/protection/required_status_checks'],process.cwd()));
fs.writeFileSync(out+'/required-checks.json',JSON.stringify({contexts:required.contexts,checks:required.checks},null,2)+'\n');
assert.equal(required.contexts.includes('Barkdown parity rows'),false);
for(const name of ['main.go','go.mod','go.sum'])fs.copyFileSync('.git/C105-g2-yaml/'+name,out+'/'+name);
fs.writeFileSync(out+'/review.json',JSON.stringify({status:'passed',elapsedMs:Date.now()-started,patchAppliesAndMatches:true,yaml,requiredContextPresent:false,upstreamModified:false,tempPreserved:temp,limits:['Structural/patch validation is not a live editor run','Path-filtered parity cannot simply become a globally required name; use an always-reporting dispatcher/aggregator before enforcement','Root weekly/dispatch policy is retained; CI-on-PR acceptance remains unresolved']},null,2)+'\n');
console.log(JSON.stringify({patchAppliesAndMatches:true,yaml,requiredContextPresent:false,upstreamModified:false}));
