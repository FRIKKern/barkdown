const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(__dirname+'/media-cache-receive434.exs','utf8');
let candidate=original.replaceAll('Barkpark.Media.Blobstore.S3.ReceiveCandidate','Barkpark.Media.Blobstore.S3.LossCandidate');
const before='             :ok <- File.write(tmp_path, response.body),';assert.equal(candidate.split(before).length,2);
candidate=candidate.replace(before,before+'\n             :ok <- loss_barrier(tmp_path, full_path),');
const point='  # The `into:` streaming collector';assert.equal(candidate.split(point).length,2);
candidate=candidate.replace(point,`  # TEST ONLY: after actual partial bytes, before rename, inside actual LocalWrite.
  defp loss_barrier(tmp, full) do
    hook = Application.get_env(:barkpark, :cache_loss_test_hook)
    if is_function(hook, 2), do: hook.(tmp, full), else: :ok
  end

`+point);
candidate='# Additional test-only loss barrier derived from receive candidate434. Original Apache-2.0 LICENSE retained. No production module replacement.\n'+candidate;
fs.writeFileSync(__dirname+'/media-cache-loss460.exs',candidate,{flag:'wx'});
fs.writeFileSync(__dirname+'/C108-cache-loss-derivation460.json',JSON.stringify({at:new Date().toISOString(),source:'fce63d25ee134d11d9138ab369c3146e75b90f19',file:'api/lib/barkpark/media/blobstore/s3.ex',sourceSha256:'18d7e7fbc2391113912eed7cab27e4cff97b03683a987ee872a5d596de4a2515',parentCandidateSha256:hash(original),derivedSha256:hash(candidate),module:'Barkpark.Media.Blobstore.S3.LossCandidate',changes:['Receive-first434 unchanged except separate module name and explicit test-only barrier after File.write(tmp) before rename','Actual LocalWrite/Repo/coordinator unchanged; hook captures its own transaction pg_backend_pid'],limits:'Private interruption experiment only; no production patch/adoption, real account or library, recovery/cleanup, power-loss guarantee, public S3 deletion, merge/deployment.'},null,2)+'\n',{flag:'wx'});
let producer=fs.readFileSync(__dirname+'/media-cache-receive437.mjs','utf8');
producer=producer.replaceAll('C108-cache-receive437','C108-cache-loss462').replaceAll('media-cache-receive437.mjs','media-cache-loss462.mjs').replaceAll('media-cache-receive436.exs','media-cache-loss461.exs').replaceAll('media-cache-receive434.exs','media-cache-loss460.exs').replaceAll('C108-cache-derivation434.json','C108-cache-loss-derivation460.json');
producer=producer.replace("'Barkdown-cache-receive-'","'Barkdown-cache-loss-'");
producer=producer.replace("import {inventory} from '../scripts/runtime-postgres-bundle.mjs';","import {inventory} from '../scripts/runtime-postgres-bundle.mjs';\nimport {observeWindowsMediaFile} from '../scripts/windows-media-file-observation.mjs';");
producer=producer.replace('{systemTool,systemRoot}', '{systemTool,systemRoot,powershell}');
const from=producer.indexOf(" if(key==='/control/release/delayed')"),to=producer.indexOf(" res.writeHead(400);res.end();});",from);assert(from>0&&to>from);
producer=producer.slice(0,from)+` if(key.startsWith('/control/release/')){const name=key.split('/').at(-1),p=pending.get(name);if(!p){res.writeHead(409);return res.end();}requests.push({control:name,responseDestroyed:p.destroyed});if(!p.destroyed){p.writeHead(200,{'content-type':'application/octet-stream','content-length':payload.length});p.end(payload);}pending.delete(name);res.writeHead(200);return res.end('released');}
 if(key.startsWith('/control/observe/')){try{const name=key.split('/').at(-1);assert(['owner-partial','connection-partial'].includes(name));const details=JSON.parse(fs.readFileSync(out+'/'+name+'.partial.json')),mediaRoot=path.win32.normalize(path.resolve(out,'synthetic-fixture/media')),relative=path.win32.relative(mediaRoot,path.win32.normalize(details.tmp)).replaceAll('\\\\','/');assert(relative.startsWith('uploads/2026/10/'+name+'.svg.part-'));assert(!relative.includes('..'));
 const probe=spawnSync(powershell(),['-NoProfile','-NonInteractive','-Command',\"(Get-CimInstance Win32_LogicalDisk -Filter \\\"DeviceID='C:'\\\").VolumeSerialNumber\"],{env,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(probe.status,0);assert.equal(probe.error,undefined);assert.equal(probe.signal,null);
 const request={version:1,root:mediaRoot,rootIdentity:{volume:BigInt('0x'+probe.stdout.trim()).toString(),inode:fs.statSync(mediaRoot,{bigint:true}).ino.toString()},key:relative,region:'original',maxBytes:payload.length};const observed=observeWindowsMediaFile(request);assert.equal(observed.file.state,'readable');assert.equal(observed.file.sha256,crypto.createHash('sha256').update(payload).digest('hex'));fs.writeFileSync(out+'/'+name+'.native-before.json',JSON.stringify({request,observed},null,2));requests.push({control:'observe-'+name,nativeIdentity:true});res.writeHead(200);return res.end('observed');}catch(e){report.nativeError=redact(e.stack);save();res.writeHead(500);return res.end('native observation refused');}}
 requests.push({method:req.method,path:key});if(req.method!=='GET'||!key.startsWith('/synthetic-receive/uploads/2026/10/')){res.writeHead(400);return res.end();}
 const name=key.split('/').at(-1).replace('.svg','');
 if(['owner-receive','owner-partial','connection-partial'].includes(name)){pending.set(name,res);fs.writeFileSync(out+'/'+name+'.arrived',JSON.stringify({at:new Date().toISOString()}));return;}
`+producer.slice(to);
producer=producer.replaceAll('receive_first_candidate_observed','loss_transition_observed').replace('result.checks.length,5','result.checks.length,3').replace('Five receive-first outcome/actual PostgreSQL lock/drain observations pass','Three owner/connection-loss transition observations pass');
producer=producer.replace('No pending-delete reservation race, DB-loss/owner-death transition, HTTP503 adoption, NTFS identity/native-child/general caller coverage or recovery/cleanup authority.','Owned writer/connection-loss experiment only; no HTTP503 adoption, native-child/general caller closure or recovery/cleanup authority.');
fs.writeFileSync(__dirname+'/media-cache-loss462.mjs',producer,{flag:'wx'});
fs.writeFileSync(__dirname+'/C108-cache-loss-entry460.json',JSON.stringify({at:new Date().toISOString(),task:'task-0571ac0327eced87',claimAtEntry:10,lease:'2026-10-16T11:40:03.476090Z',outcome:'Three causal cache-loss transitions with actual LocalWrite/Repo/coordinator, separately named candidate and disposable loopback/DB/files.',source:'fce63d25ee134d11d9138ab369c3146e75b90f19',stoppingCondition:'First failure stops; all attempts/results/partials/journals preserved. Stop only owned host/VM/PG; never recover or purge.',budget:'One three-case native VM,90second VM ceiling plus owned backend bootstrap/shutdown. Target25minute checkpoint, then independent review/root/publication.',next:'Execute462 once; inspect retained result before any followup. No replay450/437/406/418/420 or source/installer freeze expansion.'},null,2)+'\n',{flag:'wx'});
console.log({prepared:'462',derived:'460',sourceUnchanged:true});
