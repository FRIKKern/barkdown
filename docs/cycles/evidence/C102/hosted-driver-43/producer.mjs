import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out='docs/cycles/evidence/C102/hosted-driver-43';fs.mkdirSync(out);
const raw=execFileSync('gh',['api','repos/FRIKKern/barkdown/actions/runs?head_sha=5b049a78a9a6d22b810ba16dddd6f9c5ee142364&per_page=10']);
fs.writeFileSync(out+'/runs.json',raw,{flag:'wx'});const runs=JSON.parse(raw).workflow_runs;
const rows=[];
for(const run of runs){
 const jobsRaw=execFileSync('gh',['api',`repos/FRIKKern/barkdown/actions/runs/${run.id}/jobs`]);fs.writeFileSync(out+`/${run.id}-jobs.json`,jobsRaw,{flag:'wx'});
 const jobs=JSON.parse(jobsRaw).jobs,messages=[];
 for(const job of jobs){const b=execFileSync('gh',['api',`repos/FRIKKern/barkdown/check-runs/${job.id}/annotations`]);fs.writeFileSync(out+`/${job.id}-annotations.json`,b,{flag:'wx'});messages.push(...JSON.parse(b).map(a=>a.message));}
 rows.push({name:run.name,id:run.id,head:run.head_sha,status:run.status,conclusion:run.conclusion,steps:jobs.map(j=>j.steps),messages});
}
fs.copyFileSync('.git/c102-hosted-43.mjs',out+'/producer.mjs');
fs.writeFileSync(out+'/review.json',JSON.stringify({observedAt:new Date().toISOString(),runs:rows,noRetry:true},null,2)+'\n');
console.log(JSON.stringify(rows));
