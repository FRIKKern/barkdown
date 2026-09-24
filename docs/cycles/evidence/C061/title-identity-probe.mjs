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
 const id='draft-title-ops';await mutate('create empty title fixture',[{create:{_id:id,_type:'paper',title:'',blocks:[]}}]);
 await req('title block ops','POST',`/v1/plugins/bulldocs/papers/drafts.${id}/ops`,{ifRev:0,ops:[{op:'patch-block',id:'tpl-title',patch:{text:'Human Paper title'}}]});await get('after title block ops',id);
 await req('body after title ops','POST',`/v1/plugins/bulldocs/papers/drafts.${id}/ops`,{ifRev:1,ops:[{op:'patch-block',id:'tpl-body',patch:{content:[{type:'text',value:'Human body after title'}]}}]});await get('after body and title ops',id);
 await req('stale title block ops','POST',`/v1/plugins/bulldocs/papers/drafts.${id}/ops`,{ifRev:0,ops:[{op:'patch-block',id:'tpl-title',patch:{text:'Stale title'}}]});await get('after stale title block refusal',id);
 await mutate('duplicate create refuses existing draft',[{create:{_id:id,_type:'paper',title:'Replacement',blocks:[]}}]);await get('after duplicate create',id);
 const publishedBefore=await get('published collision before','welcome','published');await mutate('create same id as published fixture',[{create:{_id:'welcome',_type:'paper',title:'Distinct draft twin',blocks:[]}}]);await get('collision raw exact published wins','welcome');await get('collision drafts prefers twin','welcome','drafts');const publishedAfter=await get('published collision after','welcome','published');assert.deepEqual(doc(publishedBefore),doc(publishedAfter));
 console.log(JSON.stringify(records.map(({label,status})=>({label,status})),null,2));
}finally{fs.writeFileSync(path.join(out,'title-identity-'+Date.now()+'.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,records,limits:['Private HTTP title/content and draft-versus-published identity observations only','No native editing, replay-after-lost-response, namespace fencing or app title support claimed']},null,2)+'\n')}
