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
 const created=await mutate('empty draft without publication metadata',[{create:{_id:id,_type:'paper',title:'',blocks:[]}}]);assert.equal(created.status,200,JSON.stringify(created));
 const raw=await get('bare raw',id);await get('bare draft',id,'drafts');await get('bare published',id,'published');await get('exact draft raw','drafts.'+id);
 await req('published catalog','GET','/v1/data/query/production/paper?perspective=published&limit=200');await req('draft catalog','GET','/v1/data/query/production/paper?perspective=drafts&limit=200');
 await mutate('existing draft createIfNotExists',[{createIfNotExists:{_id:id,_type:'paper',title:'Must not replace',blocks:[]}}]);
 const before=doc(raw);const rev=before.rev??0;
 await req('guarded draft Paper ops','POST',`/v1/plugins/bulldocs/papers/${id}/ops`,{ifRev:rev,ops:[{op:'append-block',block:{id:'ordinary-first-line',type:'paragraph',content:[{type:'text',value:'First ordinary note line'}]}}]});
 const afterOps=await get('after draft ops',id);
 await req('stale draft Paper ops','POST',`/v1/plugins/bulldocs/papers/${id}/ops`,{ifRev:rev,ops:[{op:'append-block',block:{id:'must-not-land',type:'paragraph',content:[{type:'text',value:'Stale overwrite'}]}}]});
 const latest=doc(afterOps);assert.equal(typeof latest._rev,'string','Document revision required for title guard');await mutate('guarded title patch',[{patch:{id,type:'paper',ifRevisionID:latest._rev,set:{title:'Ordinary note title'}}}]);
 await get('after title patch',id);await mutate('stale title patch',[{patch:{id,type:'paper',ifRevisionID:latest._rev,set:{title:'Stale title must refuse'}}}]);await get('after stale title refusal',id);
 await req('draft title search','GET','/v1/data/search/production?q=Ordinary%20note%20title&limit=20&type=paper');
 const raceId='ordinary-race';await Promise.all([0,1].map(i=>mutate('concurrent create '+i,[{create:{_id:raceId,_type:'paper',title:'Racer '+i,blocks:[]}}])));await get('race final',raceId);
 await mutate('delete fixture create',[{create:{_id:'ordinary-delete',_type:'paper',title:'Disposable deletion probe',blocks:[]}}]);const deleting=doc(await get('before delete','ordinary-delete'));assert.equal(typeof deleting._rev,'string','Document revision required for delete guard');await mutate('guarded delete',[{delete:{id:'ordinary-delete',type:'paper',ifRevisionID:deleting._rev}}]);await get('after delete','ordinary-delete');await req('history after delete','GET','/v1/data/history/production/paper/ordinary-delete?limit=20');
 console.log(JSON.stringify(records.map(({label,status})=>({label,status})),null,2));
}finally{fs.writeFileSync(path.join(out,'http-probe-'+Date.now()+'.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,records,limits:['Disposable HTTP contract probe only; no product UI or migration authority change','Concurrent create is evidence of actual contract, not presumed safety','No real libraries or provider calls']},null,2)+'\n')}
