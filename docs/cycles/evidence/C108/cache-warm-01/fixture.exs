alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.Repo
[output, endpoint, config_file, sources] = System.argv()
config = config_file |> File.read!() |> JSON.decode!()
Logger.configure(level: :warning)
Application.put_env(:barkpark, Repo, hostname: "127.0.0.1", port: config["pgPort"], username: "postgres", password: config["password"], database: "barkdown", pool_size: 5, log: false, show_sensitive_data_on_connection_error: false)
{:ok, _} = Application.ensure_all_started(:ecto_sql)
{:ok, repo} = Repo.start_link()
Process.unlink(repo)
{:ok, _} = Application.ensure_all_started(:req)
query = fn sql -> Ecto.Adapters.SQL.query!(Repo, sql, []) end
[[workspace, project, dataset]] = query.("SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1").rows
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Warm fixture exists; preserve it")
File.mkdir!(root)
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
view = fn gate -> Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]) end
await = fn test ->
  until = System.monotonic_time(:millisecond) + 10_000
  Stream.repeatedly(fn -> cond do test.() -> true; System.monotonic_time(:millisecond) >= until -> raise("Warm causal condition timed out"); true -> Process.sleep(10); false end end) |> Enum.find(& &1)
end
lock_available = fn ->
  try do
    {:ok, :locked} = Repo.transaction(fn -> query.("LOCK TABLE public.media_files IN SHARE ROW EXCLUSIVE MODE NOWAIT"); :locked end)
    true
  rescue e in Postgrex.Error -> if e.postgres.code == :lock_not_available, do: false, else: reraise(e, __STACKTRACE__)
  end
end
own_gate = fn gate -> Process.unlink(gate); Process.put(:gates, [gate | Process.get(:gates, [])]); gate end
parent = self()
Process.put(:checks, [])
Process.put(:bindings, [])
started = System.monotonic_time(:millisecond)
try do
  [[rows_before]] = query.("SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM media_files m").rows
  for variant <- ["original", "candidate"] do
    source_file = Path.join(sources, variant <> "-barrier.exs")
    [{module, binary}] = Code.compile_file(source_file)
    Barkpark.Media.Blobstore.S3 = module
    {:ok, {^module, md5}} = :beam_lib.md5(binary)
    ^md5 = module.module_info(:md5)
    Process.put(:bindings, Process.get(:bindings) ++ [%{variant: variant, module: inspect(module), source: source_file, source_sha256: hash.(source_file), compiled_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}])
    case_root = Path.join(root, variant)
    File.mkdir!(case_root)
    media = Path.join(case_root, "media")
    File.mkdir!(media)
    original = Path.join(case_root, "synthetic-original.bin")
    payload = "Synthetic actual Media.upload warm-cache " <> variant <> " bytes"
    File.write!(original, payload)
    original_hash = hash.(original)
    Application.put_env(:barkpark, :media_upload_dir, media)
    Application.put_env(:barkpark, :media_storage, backend: :s3, s3: [endpoint: endpoint, bucket: "synthetic-warm", region: "synthetic-region", access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
    instance = "warm-" <> variant <> "-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
    journal = Path.join(case_root, "admission.dets")
    Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
    {:ok, gate} = Admission.start_link(journal: journal, instance_id: instance, initialize: true)
    gate = own_gate.(gate)
    Application.put_env(:barkpark, :cache_warm_test_hook, fn key, full ->
      [[backend]] = query.("SELECT pg_backend_pid()").rows
      send(parent, {:warm, self(), key, full, backend})
      receive do :continue -> :ok after 15_000 -> raise("Actual upload warm barrier timed out") end
    end)
    upload = %Plug.Upload{path: original, filename: "synthetic-" <> variant <> ".bin", content_type: "application/octet-stream"}
    {writer, monitor} = spawn_monitor(fn -> send(parent, {:unexpected_completion, self(), Barkpark.Media.upload(upload, dataset, workspace_id: workspace, project_id: project)}) end)
    {key, full, backend} = receive do
      {:warm, ^writer, key, full, backend} -> {key, full, backend}
      {:unexpected_completion, ^writer, value} -> raise("Actual upload returned before warm-copy barrier: #{inspect(value)}")
      {:DOWN, ^monitor, :process, ^writer, reason} -> raise("Actual upload died before warm-copy barrier: #{inspect(reason)}")
    after 10_000 -> raise("Actual Media.upload did not reach intended warm-copy barrier") end
    ^payload = File.read!(full)
    %{phase: :open, pending: 1, writers: 1} = at_copy = view.(gate)
    physical = gate |> :sys.get_state() |> Map.fetch!(:writers) |> Map.values() |> Enum.any?(&Map.get(&1, :physical_effect?, false))
    expected_physical = variant == "candidate"
    ^expected_physical = physical
    expected_lock = variant == "original"
    ^expected_lock = lock_available.()
    [[0]] = Ecto.Adapters.SQL.query!(Repo, "SELECT count(*) FROM media_files WHERE path=$1 OR object_key=$1", [key]).rows
    File.write!(Path.join(output, variant <> ".warm.json"), JSON.encode!(%{key: key, full: full, media: media, bytes: byte_size(payload), sha256: original_hash, writer: inspect(writer), owned_backend: backend}))
    {:ok, %{status: 200}} = Req.get(endpoint <> "/control/observe/" <> variant)
    Process.exit(writer, :kill)
    receive do {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok after 10_000 -> raise("Owned upload worker did not stop") end
    expected_phase = if variant == "original", do: :open, else: :recovery_required
    expected_pending = if variant == "original", do: 0, else: 1
    await.(fn -> s = view.(gate); s.phase == expected_phase and s.pending == expected_pending and s.writers == 0 end)
    await.(lock_available)
    after_death = view.(gate)
    ^payload = File.read!(full)
    ^original_hash = hash.(original)
    [[^rows_before]] = query.("SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM media_files m").rows
    GenServer.stop(gate)
    {:ok, restarted} = Admission.start_link(journal: journal, instance_id: instance)
    restarted = own_gate.(restarted)
    %{phase: ^expected_phase, pending: ^expected_pending, writers: 0} = after_restart = view.(restarted)
    item = %{variant: variant, at_copy: at_copy, physical_effect: physical, lock_available_at_copy: expected_lock, after_death: after_death, after_restart: after_restart, writer: inspect(writer), owned_backend: backend, key: key, full: full, media: media, original: original, bytes: byte_size(payload), sha256: original_hash, no_media_row_inserted: true, original_exact: true, journal: journal}
    Process.put(:checks, Process.get(:checks) ++ [item])
    File.write!(Path.join(output, "progress.json"), JSON.encode!(Process.get(:checks)))
    GenServer.stop(restarted)
  end
  result = %{status: "actual_upload_warm_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started, checks: Process.get(:checks), bindings: Process.get(:bindings), scope: %{workspace: workspace, project: project, dataset: dataset}, root: root,
    modules: Enum.map([Barkpark.Media, Barkpark.Media.Blobstore, Admission, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite], fn mod -> file = mod |> :code.which() |> to_string(); %{module: inspect(mod), file: file, sha256: hash.(file)} end),
    limits: "Actual admitted Media.upload invoked in a separate native VM against the fresh real database seeded by the owned full backend; not an HTTP upload proof. Only private S3 after-copy seam/wrapper differs. No source/release/app repair, row insertion/completed upload, native children/full caller census, recovery/cleanup, real library/account, merge/deployment or stage acceptance."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  Application.delete_env(:barkpark, :cache_warm_test_hook)
  for gate <- Process.get(:gates, []), Process.alive?(gate), do: GenServer.stop(gate)
  if Process.alive?(repo), do: GenServer.stop(repo)
end
