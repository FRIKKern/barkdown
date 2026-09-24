import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const server=process.env.BARKDOWN_SHOTS_SERVER,token=process.env.BARKPARK_API_TOKEN;
assert.equal(process.env.BARKDOWN_SHOTS_ISOLATED,'1'); assert.match(server,/^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(token);
const out=path.resolve('../docs/cycles/evidence/C061');fs.mkdirSync(out,{recursive:true});
const records=[];const id='ordinary-note-probe';
async function req(label,method,route,body){const r=await fetch(server+route,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{data={text:txt}};const v={label,method,route,...(body?{body}:{}),status:r.status,data};records.push(v);return v}
const mutate=(label,m)=>req(label,'POST','/v1/data/mutate/production',{mutations:m});
const get=(label,id,p='raw')=>req(label,'GET',`/v1/data/doc/production/paper/${encodeURIComponent(id)}?perspective=${p}`);
const doc=r=>r.data.result||r.data.document||r.data;
try{
 const id='draft-address-probe';await mutate('blank draft',[{create:{_id:id,_type:'paper',title:'',blocks:[]}}]);
 await req('exact draft ops','POST',`/v1/plugins/bulldocs/papers/drafts.${id}/ops`,{ifRev:0,ops:[{op:'append-block',block:{id:'first-line',type:'paragraph',content:[{type:'text',value:'Exact draft body line'}]}}]});
 await get('after exact draft ops',id);await req('exact draft stale ops','POST',`/v1/plugins/bulldocs/papers/drafts.${id}/ops`,{ifRev:0,ops:[{op:'append-block',block:{id:'stale-line',type:'paragraph',content:[{type:'text',value:'Must not land stale line'}]}}]});await get('after stale exact draft ops',id);
 await req('search drafts explicitly','GET','/v1/data/search/production?q=Exact%20draft%20body%20line&limit=20&type=paper&perspective=drafts');
 const deletion='restore-contract-probe';await mutate('create recovery fixture',[{create:{_id:deletion,_type:'paper',title:'Original recovery title',blocks:[]}}]);const before=doc(await get('before recovery deletion',deletion));assert.equal(typeof before._rev,'string');await mutate('delete recovery fixture',[{delete:{id:deletion,type:'paper',ifRevisionID:before._rev}}]);
 const history=await req('recovery history','GET',`/v1/data/history/production/paper/${deletion}?limit=20`);const revision=history.data.revisions.find(r=>r.action==='create').id;
 await req('read retained revision','GET',`/v1/data/revision/production/${revision}`);await req('restore absent draft','POST',`/v1/data/revision/production/${revision}/restore`,{type:'paper'});const restored=doc(await get('after restore',deletion));assert.equal(typeof restored._rev,'string');
 await mutate('new human title after restore',[{patch:{id:deletion,type:'paper',ifRevisionID:restored._rev,set:{title:'Later human title'}}}]);await get('before repeated restore',deletion);await req('repeat old restore over newer draft','POST',`/v1/data/revision/production/${revision}/restore`,{type:'paper'});await get('after repeated restore',deletion);
 console.log(JSON.stringify(records.map(({label,status})=>({label,status})),null,2));
}finally{fs.writeFileSync(path.join(out,'variants-'+Date.now()+'.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,records,limits:['Disposable HTTP observations only; no app UI or real library changes','Restore is tested as its documented unconditional operation, not falsely assumed to support a revision guard']},null,2)+'\n')}
