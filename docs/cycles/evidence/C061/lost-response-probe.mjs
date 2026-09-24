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
let proxy;
try{
 const http=await import('node:http');let forwarded=0,committedStatus=null;
 proxy=http.createServer(async(incoming,outgoing)=>{let body='';for await(const part of incoming)body+=part;forwarded++;try{const response=await fetch(server+'/v1/data/mutate/production',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body});committedStatus=response.status;await response.arrayBuffer();outgoing.destroy();}catch{outgoing.destroy();}});
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const port=proxy.address().port;
 const payload={mutations:[{create:{_id:'lost-response-draft',_type:'paper',title:'Reconcile this owned draft',blocks:[]}}]};let lost=false;
 try{await fetch(`http://127.0.0.1:${port}`,{method:'POST',body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)})}catch{lost=true}
 assert.equal(lost,true);assert.equal(committedStatus,200);assert.equal(forwarded,1);
 records.push({label:'response dropped after actual create commit',status:committedStatus,transportErrorObserved:lost,forwardedWrites:forwarded,body:payload});
 const found=doc(await get('exact draft readback after lost response','drafts.lost-response-draft'));assert.equal(found._id,'drafts.lost-response-draft');assert.equal(found.title,'Reconcile this owned draft');assert.equal(found.blocks[0].text,found.title);assert.equal(found.blocks[1].content.length,0);
 await get('second readback without create replay','drafts.lost-response-draft');assert.equal(forwarded,1);
 console.log(JSON.stringify({lost,committedStatus,forwardedWrites:forwarded,readbackExact:true},null,2));
}finally{if(proxy)await new Promise(resolve=>proxy.close(resolve));fs.writeFileSync(path.join(out,'lost-response-'+Date.now()+'.json'),JSON.stringify({capturedAt:new Date().toISOString(),barkdownCommit:process.env.BARKDOWN_SHOTS_HOST_COMMIT,barkparkCommit:process.env.BARKDOWN_SHOTS_BP_COMMIT,isolatedRuntime:true,records,limits:['Disposable HTTP reconciliation probe only; no app retry implementation or durable client request journal','One known request and exact scoped readback; not a namespace reservation or power-loss claim']},null,2)+'\n')}
