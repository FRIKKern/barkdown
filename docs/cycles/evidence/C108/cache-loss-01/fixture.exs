alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.Repo
[output, endpoint, config_file, candidate] = System.argv()
Code.require_file(candidate)
alias Barkpark.Media.Blobstore.S3.LossCandidate, as: Cache
Logger.configure(level: :warning)
config = config_file |> File.read!() |> JSON.decode!()
Application.put_env(:barkpark, Repo, hostname: "127.0.0.1", port: config["pgPort"], username: "postgres",
  password: config["password"], database: "barkdown", pool_size: 5, log: false, show_sensitive_data_on_connection_error: false)
{:ok, _} = Application.ensure_all_started(:ecto_sql)
{:ok, repo} = Repo.start_link()
Process.unlink(repo)
{:ok, _} = Application.ensure_all_started(:req)
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Fixture already exists; preserve it")
File.mkdir!(root)
media = Path.join(root, "media")
File.mkdir!(media)
original = Path.join(root, "original.bin")
File.write!(original, "Synthetic independent original retained across loss transitions")
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
original_hash = hash.(original)
Application.put_env(:barkpark, :media_upload_dir, media)
Application.put_env(:barkpark, :media_storage, backend: :s3, s3: [endpoint: endpoint,
  bucket: "synthetic-receive", region: "synthetic-region", access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
query = fn sql -> Ecto.Adapters.SQL.query!(Repo, sql, []) end
view = fn gate -> Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]) end
await = fn test ->
  until = System.monotonic_time(:millisecond) + 10_000
  Stream.repeatedly(fn ->
    cond do test.() -> true; System.monotonic_time(:millisecond) >= until -> raise("Causal fixture condition timed out"); true -> Process.sleep(10); false end
  end) |> Enum.find(& &1)
end
lock_available = fn ->
  try do
    {:ok, :locked} = Repo.transaction(fn -> query.("LOCK TABLE public.media_files IN SHARE ROW EXCLUSIVE MODE NOWAIT"); :locked end)
    true
  rescue e in Postgrex.Error -> if e.postgres.code == :lock_not_available, do: false, else: reraise(e, __STACKTRACE__)
  end
end
remember_gate = fn gate -> Process.put(:owned_gates, [gate | Process.get(:owned_gates, [])]); Process.unlink(gate); gate end
new_gate = fn name ->
  instance = "loss-" <> name <> "-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
  journal = Path.join(root, name <> ".dets")
  Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
  {:ok, gate} = Admission.start_link(journal: journal, instance_id: instance, initialize: true)
  {remember_gate.(gate), instance, journal}
end
restart = fn gate, instance, journal ->
  GenServer.stop(gate)
  {:ok, next} = Admission.start_link(journal: journal, instance_id: instance)
  remember_gate.(next)
end
parent = self()
payload = "Synthetic receive-first cache bytes"
started = System.monotonic_time(:millisecond)
Process.put(:checks, [])
record = fn item -> Process.put(:checks, Process.get(:checks) ++ [item]); File.write!(Path.join(output, "progress.json"), JSON.encode!(Process.get(:checks))) end
try do
  [[0]] = query.("SELECT count(*) FROM media_delete_operations_v1").rows
  # Ordinary receive has not entered a physical closure or started a hold.
  {gate, instance, journal} = new_gate.("owner-receive")
  key = "uploads/2026/10/owner-receive.svg"
  full = Barkpark.Media.file_path(key)
  {writer, monitor} = spawn_monitor(fn -> send(parent, {:finished, self(), Cache.ensure_local(key)}) end)
  await.(fn -> File.exists?(Path.join(output, "owner-receive.arrived")) end)
  %{phase: :open, pending: 1, writers: 1} = receiving = view.(gate)
  false = File.exists?(Path.join(media, "uploads"))
  true = lock_available.()
  Process.exit(writer, :kill)
  receive do {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok after 10_000 -> raise("Owned receive writer did not die") end
  await.(fn -> match?(%{phase: :open, pending: 0, writers: 0}, view.(gate)) end)
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/owner-receive")
  false = File.exists?(full)
  false = File.exists?(Path.join(media, "uploads"))
  gate = restart.(gate, instance, journal)
  %{phase: :open, pending: 0, writers: 0} = restarted = view.(gate)
  record.(%{name: "Ordinary receive owner death before any hold/physical upgrade leaves media untouched and restarts open/zero", before: receiving, after_restart: restarted, writer: inspect(writer), final_absent: full, journal: journal})
  GenServer.stop(gate)

  # Two independent fresh physical admissions retain uncertain bytes.
  for name <- ["owner-partial", "connection-partial"] do
    {gate, instance, journal} = new_gate.(name)
    key = "uploads/2026/10/" <> name <> ".svg"
    full = Barkpark.Media.file_path(key)
    Application.put_env(:barkpark, :cache_loss_test_hook, fn tmp, final ->
      [[backend]] = query.("SELECT pg_backend_pid()").rows
      send(parent, {:partial, self(), tmp, final, backend})
      receive do :continue -> :ok after 10_000 -> raise("After-write barrier timed out") end
    end)
    {writer, monitor} = spawn_monitor(fn -> send(parent, {:finished, self(), Cache.ensure_local(key)}) end)
    await.(fn -> File.exists?(Path.join(output, name <> ".arrived")) end)
    %{phase: :open, pending: 1, writers: 1} = view.(gate)
    {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/" <> name)
    {tmp, backend} = receive do {:partial, ^writer, tmp, ^full, backend} -> {tmp, backend} after 10_000 -> raise("No actual partial-write barrier") end
    ^payload = File.read!(tmp)
    false = File.exists?(full)
    %{phase: :open, pending: 1, writers: 1} = physical = view.(gate)
    true = gate |> :sys.get_state() |> Map.fetch!(:writers) |> Map.values() |> Enum.all?(&Map.get(&1, :physical_effect?, false))
    false = lock_available.()
    partial_identity = File.stat!(tmp, time: :posix)
    File.write!(Path.join(output, name <> ".partial.json"), JSON.encode!(%{tmp: tmp, full: full, writer: inspect(writer), backend: backend}))
    {:ok, %{status: 200}} = Req.get(endpoint <> "/control/observe/" <> name)
    outcome = if name == "owner-partial" do
      Process.exit(writer, :kill)
      receive do {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok after 10_000 -> raise("Owned partial writer did not die") end
      await.(fn -> match?(%{phase: :recovery_required, pending: 1, writers: 0}, view.(gate)) end)
      await.(lock_available)
      ^payload = File.read!(tmp)
      false = File.exists?(full)
      %{kind: "owned_writer_killed", partial_retained: true, final_exists: false}
    else
      # PID was read inside this owned writer's actual LocalWrite transaction.
      [[true]] = Ecto.Adapters.SQL.query!(Repo, "SELECT pg_terminate_backend($1)", [backend]).rows
      await.(lock_available)
      true = Process.alive?(writer)
      send(writer, :continue)
      value = receive do {:finished, ^writer, value} -> value after 10_000 -> raise("Connection-loss writer did not return") end
      {:error, :storage_unavailable} = value
      receive do {:DOWN, ^monitor, :process, ^writer, :normal} -> :ok after 10_000 -> raise("Connection-loss writer did not settle") end
      await.(fn -> match?(%{phase: :recovery_required, pending: 1, writers: 0}, view.(gate)) end)
      retained_path = if File.exists?(full), do: full, else: tmp
      ^payload = File.read!(retained_path)
      %{kind: "owned_transaction_connection_terminated", returned: inspect(value), final_exists: File.exists?(full), partial_retained: File.exists?(tmp), lock_available_before_continue: true}
    end
    true = lock_available.()
    %{phase: :recovery_required, pending: 1, writers: 0} = retained = view.(gate)
    gate = restart.(gate, instance, journal)
    %{phase: :recovery_required, pending: 1, writers: 0} = restarted = view.(gate)
    record.(%{name: name <> " retains uncertain physical effect despite PostgreSQL lock release and coordinator restart", physical: physical, retained: retained, after_restart: restarted, writer: inspect(writer), owned_backend_pid: backend, partial: tmp, final: full, partial_inode_before: partial_identity.inode, bytes: byte_size(payload), sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower), journal: journal, outcome: outcome})
    GenServer.stop(gate)
  end
  [[0]] = query.("SELECT count(*) FROM media_delete_operations_v1").rows
  ^original_hash = hash.(original)
  result = %{status: "loss_transition_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started,
    checks: Process.get(:checks), root: root, media: media, original: original, original_sha256: original_hash,
    modules: Enum.map([Admission, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite, Repo], fn mod -> file = mod |> :code.which() |> to_string(); %{module: inspect(mod), file: file, sha256: hash.(file)} end),
    limits: "Private derived module with causal after-write barrier. Actual compiled LocalWrite/Repo/coordinator; fresh PostgreSQL and loopback only. Process/connection loss, not power loss. No frozen source repair, HTTP503 adoption, native children/full caller census, recovery/cleanup, real account/library, merge/deployment or stage acceptance."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  Application.delete_env(:barkpark, :cache_loss_test_hook)
  for gate <- Process.get(:owned_gates, []), Process.alive?(gate), do: GenServer.stop(gate)
  if Process.alive?(repo), do: GenServer.stop(repo)
end
