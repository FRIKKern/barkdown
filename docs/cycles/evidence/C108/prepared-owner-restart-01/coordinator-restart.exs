[request_path] = System.argv()
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
