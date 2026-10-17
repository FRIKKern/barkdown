const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),replace=(s,a,b)=>{assert(s.includes(a),a);return s.split(a).join(b);},prep='.git/C108-prepared-owner-restart1626',prior=read('.git/C108-prepared-owner1603/process.json');assert(!fs.existsSync(prep));assert(!fs.existsSync('.git/C108-prepared-owner-restart1628'));assert.equal(prior.status,'actual_prepared_owner_loss_observed');assert.equal(prior.finalPgStatus,3);const journal=path.join(prior.data,'write-admission.dets'),stat=fs.lstatSync(journal,{bigint:true});assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.nlink,1n);const source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',sourceOwner='api/lib/barkpark/managed_runtime/write_admission.ex',beam=path.join(prior.release,'lib/barkpark-0.1.0/ebin/Elixir.Barkpark.ManagedRuntime.WriteAdmission.beam');
const script=`[request_path] = System.argv()
request = request_path |> File.read!() |> JSON.decode!()
output = request["output"]
write = fn name, value ->
  target = Path.join(output, name <> ".json")
  File.write!(target <> ".writing", JSON.encode!(value), [:exclusive])
  File.rename!(target <> ".writing", target)
end
await = fn name ->
  deadline = System.monotonic_time(:millisecond) + 15_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(Path.join(output, name)) -> true
      System.monotonic_time(:millisecond) > deadline -> raise "Owned standalone VM control timeout"
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
started = System.monotonic_time(:millisecond)
try do
  {:ok, _} = Application.ensure_all_started(:crypto)
  Code.ensure_loaded!(Barkpark.ManagedRuntime.WriteAdmission)
  beam = :code.which(Barkpark.ManagedRuntime.WriteAdmission) |> List.to_string()
  binary = File.read!(beam)
  {:ok, {Barkpark.ManagedRuntime.WriteAdmission, md5}} = :beam_lib.md5(binary)
  ^md5 = Barkpark.ManagedRuntime.WriteAdmission.module_info(:md5)
  binding = %{code_path: beam, beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower), beam_os_pid: System.pid()}
  true = binding.beam_sha256 == request["beam_sha256"]
  write.("vm-ready", binding)
  await.("vm-go")
  journal = request["journal"]
  before_sha = Base.encode16(:crypto.hash(:sha256, File.read!(journal)), case: :lower)
  ^before_sha = request["journal_sha256"]
  table = {Barkpark.ManagedRuntime.WriteAdmission, journal}
  {:ok, ^table} = :dets.open_file(table, file: String.to_charlist(journal), type: :set, access: :read, repair: false, auto_save: :infinity)
  before = try do
    1 = :dets.info(table, :size)
    [{:state, record}] = :dets.lookup(table, :state)
    :recovery_required = record.phase
    true = record.generation == request["generation"]
    true = length(record.pending) == request["pending"]
    record
  after
    :ok = :dets.close(table)
  end
  ^before_sha = Base.encode16(:crypto.hash(:sha256, File.read!(journal)), case: :lower)
  {:ok, coordinator} = Barkpark.ManagedRuntime.WriteAdmission.start_link(journal: journal, instance_id: before.instance_id, initialize: false)
  Process.put(:owned_restart_coordinator, coordinator)
  monitor = Process.monitor(coordinator)
  after_start = Barkpark.ManagedRuntime.WriteAdmission.status(coordinator)
  :recovery_required = after_start.phase
  true = after_start.pending == length(before.pending)
  true = after_start.generation == before.generation + 1
  true = is_binary(after_start.boot) and byte_size(after_start.boot) > 0
  0 = after_start.writers
  0 = after_start.dead_writers
  false = Enum.any?(Application.started_applications(), fn {name, _, _} -> name in [:barkpark, :ecto_sql, :postgrex, :phoenix] end)
  :ok = GenServer.stop(coordinator, :normal)
  reason = receive do {:DOWN, ^monitor, :process, ^coordinator, reason} -> reason after 5_000 -> raise "Standalone coordinator normal DOWN timeout" end
  :normal = reason
  false = Process.alive?(coordinator)
  write.("result", %{status: "actual_retained_journal_cold_coordinator_completed", binding: binding, initialize: false, before: %{phase: before.phase, generation: before.generation, sequence: before.sequence, pending: length(before.pending)}, after: Map.take(after_start, [:phase, :generation, :sequence, :pending, :writers, :dead_writers, :boot]), coordinator: inspect(coordinator), coordinator_down: inspect(reason), original_journal_sha256: before_sha, after_journal_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(journal)), case: :lower), no_full_application_started: true, elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e ->
    write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
    System.halt(1)
after
  if pid = Process.get(:owned_restart_coordinator) do
    if Process.alive?(pid), do: GenServer.stop(pid, :normal)
  end
end
`;
const plan={at:new Date().toISOString(),status:'prepared_cold_coordinator_only_actual_not_executed',source,sourceHead:'fce63d25ee134d11d9138ab369c3146e75b90f19',sourceOwner:{file:sourceOwner,sha256:sha(fs.readFileSync(source+'/'+sourceOwner))},priorOutput:'.git/C108-prepared-owner1603',priorProcessSha256:sha(fs.readFileSync('.git/C108-prepared-owner1603/process.json')),prepared:prep,script:prep+'/coordinator-restart.exs',scriptSha256:sha(script),runner:'.git/media-prepared-owner-restart1628.mjs',output:'.git/C108-prepared-owner-restart1628',journal:{file:journal,sha256:sha(fs.readFileSync(journal)),bytes:Number(stat.size),device:stat.dev.toString(),inode:stat.ino.toString(),links:Number(stat.nlink)},beam:{file:beam,sha256:sha(fs.readFileSync(beam))},generation:prior.afterNaturalExit.generation,pending:prior.afterNaturalExit.pending,scope:'Cold coordinator-only startup in a NEW explicitly owned standalone BEAM VM on the SAME retained owner1603 journal initialize:false, after original full backend/PG stopped. Preserve original journal bytes before startup; actual read-only DETS record before and unchanged SHA after read before normal startup. Expect persisted recovery/pending1 generation1 -> generation2/recovery/pending1/writers0/dead0, new VM live PID+creation receipt plus original carried coordinator beam SHA/loaded-decodedMD5. Stop new coordinator normally and VM exits; native original+cache/whole data inventory excluding only journal/installed800/runtime6193/source/205 originals/pin exact. No old boot identity was captured, never claim boot change versus original; record actual new boot. No full backend/PG/HTTP/native renderer started/no owner-loss replay/recover/reopen/cleanup/reconciliation/adoption/powerloss guarantee.',next:'After owner1603 root65/publication/hosted exact join, fresh claim/workers/head/source/disk and saved plan/source/journal bindings, then runner1628ONCE. This normal startup necessarily persists generation/sequence to the same owned journal; its exact original bytes are retained separately, never restore/clear it. First discrepancy retained.'};
fs.mkdirSync(prep);fs.writeFileSync(plan.script,script,{flag:'wx'});fs.writeFileSync('.git/C108-prepared-owner-restart-next1626.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});let helper=replace(fs.readFileSync('.git/prepared-owner-boot1602.cjs','utf8'),'C108-prepared-owner1600/boot.exs','C108-prepared-owner-restart1626/coordinator-restart.exs');helper=replace(helper,'C108-prepared-owner-boot1602','C108-prepared-owner-restart-parse1627');fs.writeFileSync('.git/prepared-owner-restart-parse1627.cjs',helper,{flag:'wx'});console.log({prepared:prep,actualExecuted:false,journalBytes:Number(stat.size),generation:plan.generation});
