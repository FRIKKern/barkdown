import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const dir='docs/cycles/evidence/C098/hosted-driver-07';if(fs.existsSync(dir))throw Error('Preserve prior output');fs.mkdirSync(dir,{recursive:true});
for(const [name,args] of [['run.json',['run','view','37773509488','--json','databaseId,headSha,status,conclusion,createdAt,updatedAt,url,jobs']],['failed.log',['run','view','37773509488','--log-failed']],['artifacts.json',['api','repos/FRIKKern/barkdown/actions/runs/37773509488/artifacts']]])fs.writeFileSync(dir+'/'+name,execFileSync('gh',args,{maxBuffer:32*1024*1024}));
console.log('Retained hosted07 run, failed log and artifact metadata.');
