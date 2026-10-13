import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const out='docs/cycles/evidence/C105/integration-hosted-03';fs.mkdirSync(out);
function gh(a){const r=spawnSync('gh',a,{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:32e6});assert.equal(r.status,0,r.stderr);return r.stdout;}
const run=JSON.parse(gh(['run','view','38429576353','--repo','FRIKKern/barkpark','--json','headSha,status,conclusion,url,jobs']));
assert.equal(run.headSha,'138c1e036b8e5406ec76e8e53f0e7513c26061cc');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
fs.writeFileSync(out+'/elixir.json',JSON.stringify(run,null,2)+'\n');
const candidate=JSON.parse(gh(['api','repos/FRIKKern/barkpark/commits/'+run.headSha]));
const summaries=[],checkouts=[];
for(const job of run.jobs.filter(j=>j.name.startsWith('Test'))){
 assert.equal(job.conclusion,'success');
 const raw=gh(['api',`repos/FRIKKern/barkpark/actions/jobs/${job.databaseId}/logs`]);fs.writeFileSync(out+'/job-'+job.databaseId+'.log',raw);
 const log=raw.replace(/\x1b\[[0-9;]*m/g,'');
 const lines=log.split(/\r?\n/);const counts=lines.filter(l=>/\d+ tests, \d+ failures/.test(l));
 assert.ok(counts.length>0,'Missing completed test counts');assert.ok(counts.every(l=>/tests, 0 failures/.test(l)));
 const commitLine=lines.find(l=>/HEAD is now at .* Merge /.test(l));assert.ok(commitLine);
 const m=/HEAD is now at (\w+) Merge ([a-f0-9]{40}) into ([a-f0-9]{40})/.exec(commitLine);assert.ok(m);assert.equal(m[2],run.headSha);
 const merge=JSON.parse(gh(['api','repos/FRIKKern/barkpark/commits/'+m[1]]));
 checkouts.push({job:job.databaseId,checkout:merge.sha,base:m[3],head:m[2],tree:merge.commit.tree.sha,candidateTree:candidate.commit.tree.sha,treeMatchesCandidate:merge.commit.tree.sha===candidate.commit.tree.sha});
 summaries.push({job:job.databaseId,counts});
}
assert.equal(checkouts.length,3);
const gates=[];for(const id of [38429576402,38429576615,38429576350]){const v=JSON.parse(gh(['run','view',String(id),'--repo','FRIKKern/barkpark','--json','headSha,status,conclusion,url']));assert.equal(v.headSha,run.headSha);assert.equal(v.conclusion,'success');gates.push({id,...v});}
const result={status:'passed',at:new Date().toISOString(),head:run.headSha,run:38429576353,url:run.url,checkouts,summaries,gates,scope:'PR head and actual synthetic checkout identified separately; Windows release proof is against the candidate head',limits:['Full test partitions and applicable source gates pass; no parent-stage acceptance or production deployment','If checkout tree differs from the Windows candidate, its changed boundaries still require separate assessment before integration']};
fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');fs.copyFileSync('.git/c105-hosted-three.mjs',out+'/producer.mjs');console.log(JSON.stringify(result));
