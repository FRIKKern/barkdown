import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out='docs/cycles/evidence/C098/hosted-driver-21';fs.mkdirSync(out);
const rows=[];
for(const [name,id] of [['desktop',37809261518],['verify',37809261337]]){
  const raw=execFileSync('gh',['api',`repos/FRIKKern/barkdown/actions/runs/${id}`]);fs.writeFileSync(out+'/'+name+'-run.json',raw,{flag:'wx'});const run=JSON.parse(raw);
  const jobsRaw=execFileSync('gh',['api',`repos/FRIKKern/barkdown/actions/runs/${id}/jobs`]);fs.writeFileSync(out+'/'+name+'-jobs.json',jobsRaw,{flag:'wx'});const jobs=JSON.parse(jobsRaw).jobs;
  const annotations=[];
  for(const job of jobs){const bytes=execFileSync('gh',['api',`repos/FRIKKern/barkdown/check-runs/${job.id}/annotations`]);fs.writeFileSync(out+'/'+name+'-'+job.id+'-annotations.json',bytes,{flag:'wx'});annotations.push(...JSON.parse(bytes));}
  rows.push({name,id,head:run.head_sha,status:run.status,conclusion:run.conclusion,steps:jobs.map(j=>j.steps),messages:annotations.map(a=>a.message)});
}
fs.copyFileSync('.git/c098-hosted-21.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/review.json',JSON.stringify({observedAt:new Date().toISOString(),runs:rows,noRetry:true},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(rows));
