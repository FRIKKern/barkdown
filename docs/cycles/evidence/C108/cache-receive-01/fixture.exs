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
  for {name, expected} <- [{"missing.svg", {:error, :not_found}}, {"transport.svg", {:error, :storage_unavailable}}] do
    key = "uploads/2026/10/" <> name
    ^expected = Cache.ensure_local(key)
    false = File.exists?(Path.join(media, "uploads"))
    %{phase: :open, pending: 0, writers: 0} = state = view.()
    record.(%{name: "Receive-first " <> name <> " settles without directory/cache mutation or recovery", state: state})
  end
  delayed = "uploads/2026/10/delayed.svg"
  full = Barkpark.Media.file_path(delayed)
  Application.put_env(:barkpark, :cache_receive_test_hook, fn ->
    send(parent, {:physical_phase, self()})
    receive do :write -> :ok after 10_000 -> raise("Physical fixture barrier timed out") end
  end)
  writer = spawn(fn -> send(parent, {:finished, self(), Cache.ensure_local(delayed)}) end)
  await_file.(Path.join(output, "delayed.arrived"))
  %{phase: :open, pending: 1, writers: 1} = receiving = view.()
  false = File.exists?(Path.join(media, "uploads"))
  true = lock_available.()
  record.(%{name: "Actual PostgreSQL media-table lock is available while the object response is delayed; no local directories exist", state: receiving})
  {:ok, :closing, hold} = Admission.begin_hold(gate, "receive-first-drain", receiving.generation)
  false = Admission.held?(gate, hold)
  {:error, {:write_admission, :admission_closed}} = Cache.ensure_local("uploads/2026/10/refused-cold/missing.svg")
  false = File.exists?(Path.dirname(Barkpark.Media.file_path("uploads/2026/10/refused-cold/missing.svg")))
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/delayed")
  receive do {:physical_phase, ^writer} -> :ok after 10_000 -> raise("Candidate did not reach actual physical lock") end
  false = lock_available.()
  %{phase: :closing, pending: 1, writers: 1} = physical = view.()
  false = File.exists?(full)
  record.(%{name: "Actual LocalWrite lock conflicts during the local phase; nested physical upgrade is admitted while closing", state: physical})
  send(writer, :write)
  receive do {:finished, ^writer, {:ok, ^full}} -> :ok after 10_000 -> raise("Candidate did not finish") end
  "Synthetic receive-first cache bytes" = File.read!(full)
  %{phase: :held, pending: 0, writers: 0} = held = view.()
  true = Admission.held?(gate, hold)
  {:ok, ^full} = Cache.ensure_local(delayed)
  [] = Path.wildcard(full <> ".part-*")
  record.(%{name: "Exact cache settles before clean held acknowledgement; cached read remains usable while held", state: held, cache_sha256: hash.(full)})
  ^original_hash = hash.(original)
  modules = Enum.map([Admission, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite, Barkpark.Media.Blobstore.S3], fn mod ->
    file = mod |> :code.which() |> to_string()
    %{module: inspect(mod), file: file, sha256: hash.(file)}
  end)
  result = %{status: "receive_first_candidate_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started,
    checks: Process.get(checks_key), modules: modules, root: root, original: original, original_sha256: original_hash,
    limits: "Private derived module only, with an explicit test barrier. Actual compiled LocalWrite/Repo/coordinator and real PostgreSQL locks; frozen source and release bytes unchanged. No pending-delete reservation race, DB-loss/owner-death transition, HTTP503 adoption, native identity or full caller coverage is established. No real account/library, recovery/cleanup, merge/deployment or production repair."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  Application.delete_env(:barkpark, :cache_receive_test_hook)
  if Process.alive?(gate), do: GenServer.stop(gate)
  if Process.alive?(repo), do: GenServer.stop(repo)
end
