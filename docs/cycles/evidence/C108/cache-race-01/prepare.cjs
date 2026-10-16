const fs=require('fs'),assert=require('assert/strict');
let fixture=fs.readFileSync(__dirname+'/media-cache-receive436.exs','utf8');
const from=fixture.indexOf('try do\n  [[0]]'),end=fixture.lastIndexOf('\nafter\n');assert(from>0&&end>from);
fixture=fixture.slice(0,from)+`try do
  [[0]] = query.("SELECT count(*) FROM media_delete_operations_v1").rows
  key = "uploads/2026/10/delayed.svg"
  full = Barkpark.Media.file_path(key)
  false = File.exists?(full)
  Application.put_env(:barkpark, :cache_receive_test_hook, fn -> send(parent, :forbidden_physical_effect) end)
  writer = spawn(fn -> send(parent, {:finished, self(), Cache.ensure_local(key)}) end)
  await_file.(Path.join(output, "delayed.arrived"))
  %{phase: :open, pending: 1, writers: 1} = receiving = view.()
  false = File.exists?(full)
  record.(%{name: "Cache miss is in real network receive before any original or prepared intent exists", state: receiving})
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/allocate")
  request = Path.join(output, "native-request.json") |> File.read!() |> JSON.decode!()
  native_hash = get_in(request, ["file", "sha256"])
  ^native_hash = hash.(full)
  id = request["mediaId"]
  Ecto.Adapters.SQL.query!(Repo,
    "INSERT INTO media_files(id,filename,original_name,path,object_key,mime_type,size,dataset,inserted_at,updated_at) VALUES($1::text::uuid,'race.svg','race.svg',$2,$2,'image/svg+xml',$3,'production',now(),now())",
    [id, key, request["file"]["bytes"]])
  [[row]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(m) FROM media_files m WHERE id=$1::text::uuid", [id]).rows
  [[prepared]] = Ecto.Adapters.SQL.query!(Repo, "SELECT public.prepare_media_delete_v1($1::jsonb)", [request]).rows
  "prepared" = prepared["state"]
  true = prepared["rowStillPresent"]
  [[operation]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(o) FROM media_delete_operations_v1 o WHERE operation_id=$1::text::uuid", [request["operationId"]]).rows
  record.(%{name: "Actual SQL preparation commits a native-observed intent while cache receive is delayed; row and original remain", state: view.(), operation_id: request["operationId"], native_sha256: native_hash})
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/delayed")
  receive do {:finished, ^writer, {:error, :storage_unavailable}} -> :ok after 10_000 -> raise("Pending address did not refuse the candidate") end
  receive do :forbidden_physical_effect -> raise("Candidate entered its physical closure") after 0 -> :ok end
  ^native_hash = hash.(full)
  [] = Path.wildcard(full <> ".part-*")
  [[^row]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(m) FROM media_files m WHERE id=$1::text::uuid", [id]).rows
  [[^operation]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(o) FROM media_delete_operations_v1 o WHERE operation_id=$1::text::uuid", [request["operationId"]]).rows
  %{phase: :open, pending: 0, writers: 0} = settled = view.()
  record.(%{name: "Actual LocalWrite refuses prepared address before closure; original row intent and bytes stay exact, no partial or recovery", state: settled, native_sha256: native_hash})
  ^original_hash = hash.(original)
  result = %{status: "pending_prepare_race_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started,
    checks: Process.get(checks_key), root: root, original: original, original_sha256: original_hash,
    target: full, target_sha256: native_hash, row: row, operation: operation,
    modules: Enum.map([Admission, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite, Barkpark.Repo], fn mod ->
      file = mod |> :code.which() |> to_string()
      %{module: inspect(mod), file: file, sha256: hash.(file)}
    end),
    limits: "Private derived cache candidate and actual lower-level SQL preparation only. Public Media.commit_pending_delete remains local-only; no S3 deletion support or logical deletion is claimed. No DB-loss/death transition, HTTP503, NTFS cleanup identity/native child/general caller coverage, recovery API, source repair/adoption or stage acceptance. No real library/account, merge/deployment."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
`+fixture.slice(end);
fs.writeFileSync(__dirname+'/media-cache-race449.exs',fixture,{flag:'wx'});
let producer=fs.readFileSync(__dirname+'/media-cache-receive437.mjs','utf8').replaceAll('C108-cache-receive437','C108-cache-race450').replaceAll('media-cache-receive437.mjs','media-cache-race450.mjs').replaceAll('media-cache-receive436.exs','media-cache-race449.exs');
producer=producer.replace("import {inventory} from '../scripts/runtime-postgres-bundle.mjs';","import {inventory} from '../scripts/runtime-postgres-bundle.mjs';\nimport {observeWindowsMediaFile} from '../scripts/windows-media-file-observation.mjs';\nimport {validateMediaDeleteIntent} from '../scripts/media-delete-intent.mjs';");
producer=producer.replace('{systemTool,systemRoot}', '{systemTool,systemRoot,powershell}');
const serverMarker=" if(key==='/control/release/delayed')";assert(producer.includes(serverMarker));
const allocate=` if(key==='/control/allocate'){
  try {
   const mediaRoot=path.win32.normalize(path.resolve(out,'synthetic-fixture/media')),key='uploads/2026/10/delayed.svg',target=path.join(mediaRoot,key),bytes=Buffer.from('Synthetic native original allocated while receive waits');
   assert(!fs.existsSync(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
   const command=\"(Get-CimInstance Win32_LogicalDisk -Filter \\\"DeviceID='C:'\\\").VolumeSerialNumber\";
   const volumeProbe=spawnSync(powershell(),['-NoProfile','-NonInteractive','-Command',command],{env,windowsHide:true,encoding:'utf8',timeout:20000});assert.equal(volumeProbe.status,0);assert.equal(volumeProbe.error,undefined);assert.equal(volumeProbe.signal,null);
   const volume=BigInt('0x'+volumeProbe.stdout.trim()).toString(),inode=fs.statSync(mediaRoot,{bigint:true}).ino.toString();
   const observed=observeWindowsMediaFile({version:1,root:mediaRoot,rootIdentity:{volume,inode},key,region:'original',maxBytes:bytes.length});assert.equal(observed.file.state,'readable');
   const request={version:1,operationId:crypto.randomUUID(),mediaId:crypto.randomUUID(),expectedKey:key,root:{path:mediaRoot,device:volume,inode},file:{bytes:bytes.length,sha256:observed.file.sha256,device:volume,inode:observed.file.identity.inode,links:1,observedAt:new Date().toISOString()}};validateMediaDeleteIntent(request);
   fs.writeFileSync(out+'/native-observation.json',JSON.stringify(observed,null,2));fs.writeFileSync(out+'/native-request.json',JSON.stringify(request,null,2));requests.push({control:'allocate',nativeObservation:true});res.writeHead(200);return res.end('allocated');
  }catch(e){report.allocationError=redact(e.stack);save();res.writeHead(500);return res.end('fixture allocation refused');}
 }
`;
producer=producer.replace(serverMarker,allocate+serverMarker);
producer=producer.replaceAll("'receive_first_candidate_observed'","'pending_prepare_race_observed'").replace('result.checks.length,5','result.checks.length,3').replace('requests.filter(r=>r.method).length,3','requests.filter(r=>r.method).length,1').replace('Five receive-first outcome/actual PostgreSQL lock/drain observations pass','Three actual SQL-preparation/cache race observations pass');
fs.writeFileSync(__dirname+'/media-cache-race450.mjs',producer,{flag:'wx'});
const entry={at:new Date().toISOString(),task:'task-0571ac0327eced87',claimAtEntry:9,lease:'2026-10-16T11:06:36.134376Z',outcome:'Race in-flight receive-first cache fill against committed actual SQL preparation with native-observed synthetic original, prove refusal before overwrite/partial.',boundaries:'New disposable DB/VM/file; reuse exact separately named derived module434 and actual LocalWrite/Repo/coordinator/prepare_media_delete_v1. Public deletion API stays local-only. No source/release/app patch.',stoppingCondition:'Three race observations or first retained failure; stop only owned host/VM/PG, retain original/row/intent/journal. No recovery, logical/physical deletion or S3 deletion support.',budget:'One owned-backend race plus review/root closeout, planned25minute ceiling. Do not replay successful437/406/418/420.'};fs.writeFileSync(__dirname+'/C108-cache-preflight448.json',JSON.stringify(entry,null,2)+'\n',{flag:'wx'});
const root=__dirname+'/../',cp=root+'docs/cycle.json',c=JSON.parse(fs.readFileSync(cp));c.nextAction='Execute private race450 once from entry448: delayed cache fill, allocate native-observed synthetic original/row, actual prepare_media_delete_v1 commit, then require LocalWrite refusal before effect/overwrite/partial. Public Media.commit_pending_delete is local-only; no S3 deletion support. Task0571 claim9 expires11:06:36UTC; refresh before writes. Source/release/app unchanged; first failure stops and retains all services/files/results.';fs.writeFileSync(cp,JSON.stringify(c,null,2)+'\n');
const hp=root+'docs/NEXT-AGENT.md';let h=fs.readFileSync(hp,'utf8');h=h.replace('Continue from .git/C108-cache-next442.json:', 'Current bounded race is prepared in .git/media-cache-race450.mjs / fixture449; entry448 defines budget/stop. No process at entry; inspect live identities before restarting. Continue from .git/C108-cache-next442.json:');fs.writeFileSync(hp,h);console.log({prepared:'450',checks:3,sourceFrozen:true});
