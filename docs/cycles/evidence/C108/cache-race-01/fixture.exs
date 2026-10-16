alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.Repo

[output, endpoint, config_file, candidate] = System.argv()
Code.require_file(candidate)
alias Barkpark.Media.Blobstore.S3.ReceiveCandidate, as: Cache
Logger.configure(level: :warning)
config = config_file |> File.read!() |> JSON.decode!()
Application.put_env(:barkpark, Repo, hostname: "127.0.0.1", port: config["pgPort"], username: "postgres",
  password: config["password"], database: "barkdown", pool_size: 5, log: false,
  show_sensitive_data_on_connection_error: false)
{:ok, _} = Application.ensure_all_started(:ecto_sql)
{:ok, repo} = Repo.start_link()
Process.unlink(repo)
{:ok, _} = Application.ensure_all_started(:req)
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Fixture exists; preserve it")
File.mkdir!(root)
media = Path.join(root, "media")
File.mkdir!(media)
original = Path.join(root, "original.bin")
File.write!(original, "Synthetic original retained across receive-first candidate")
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
original_hash = hash.(original)
Application.put_env(:barkpark, :media_upload_dir, media)
Application.put_env(:barkpark, :media_storage, backend: :s3,
  s3: [endpoint: endpoint, bucket: "synthetic-receive", region: "synthetic-region",
    access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
instance = "receive-candidate-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
{:ok, gate} = Admission.start_link(journal: Path.join(root, "admission.dets"), instance_id: instance, initialize: true)
Process.unlink(gate)
view = fn -> Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]) end
query = fn sql -> Ecto.Adapters.SQL.query!(Repo, sql, []) end
lock_available = fn ->
  try do
    {:ok, :locked} = Repo.transaction(fn -> query.("LOCK TABLE public.media_files IN SHARE ROW EXCLUSIVE MODE NOWAIT"); :locked end)
    true
  rescue e in Postgrex.Error ->
    if e.postgres.code == :lock_not_available, do: false, else: reraise(e, __STACKTRACE__)
  end
end
await_file = fn file ->
  until = System.monotonic_time(:millisecond) + 10_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(file) -> true
      System.monotonic_time(:millisecond) >= until -> raise("Object request did not arrive")
      true -> Process.sleep(10); false
    end
  end) |> Enum.find(& &1)
end
parent = self()
started = System.monotonic_time(:millisecond)
checks_key = :receive_candidate_checks
Process.put(checks_key, [])
record = fn item -> Process.put(checks_key, Process.get(checks_key) ++ [item]) end
try do
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

after
  Application.delete_env(:barkpark, :cache_receive_test_hook)
  if Process.alive?(gate), do: GenServer.stop(gate)
  if Process.alive?(repo), do: GenServer.stop(repo)
end
