alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
alias Barkpark.Media.Blobstore.S3

[output, endpoint] = System.argv()
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Fixture exists; preserve it")
File.mkdir!(root)
media = Path.join(root, "media")
File.mkdir!(media)
original = Path.join(root, "original.bin")
File.write!(original, "Synthetic original retained across cache error calibration")
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
original_hash = hash.(original)
instance = "cache-errors-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
Application.put_env(:barkpark, :media_upload_dir, media)
Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
Application.put_env(:barkpark, :media_storage,
  backend: :s3,
  s3: [endpoint: endpoint, bucket: "synthetic-cache-errors", region: "synthetic-region",
    access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
{:ok, _} = Application.ensure_all_started(:req)
{:ok, gate} = Admission.start_link(journal: Path.join(root, "admission.dets"), instance_id: instance, initialize: true)
Process.unlink(gate)
started = System.monotonic_time(:millisecond)
view = fn -> Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]) end
checks = []
try do
  %{generation: generation} = Admission.status(gate)
  {:ok, :held, hold} = Admission.begin_hold(gate, "cache-error-calibration", generation)
  true = Admission.held?(gate, hold)
  {:error, {:write_admission, :admission_closed}} = Door.admit(fn -> raise("Held door ran") end)

  missing = "uploads/2026/10/cold-404/missing.svg"
  missing_full = Barkpark.Media.file_path(missing)
  missing_parent = Path.dirname(missing_full)
  false = File.exists?(missing_parent)
  before = view.()
  {:error, :not_found} = S3.ensure_local(missing)
  true = File.dir?(missing_parent)
  false = File.exists?(missing_full)
  [] = Path.wildcard(missing_full <> ".part-*")
  %{phase: :held, pending: 0, writers: 0} = after_missing = view.()
  checks = checks ++ [%{name: "Bucket404 returns not_found after creating an absent cache parent during held/zero state",
    before: before, after: after_missing, parent_created: true, blob_absent: true, partials: []}]

  collision = "uploads/2026/10/rename-refusal/existing-directory.svg"
  collision_full = Barkpark.Media.file_path(collision)
  File.mkdir_p!(collision_full)
  marker = Path.join(collision_full, "retained-marker.bin")
  File.write!(marker, "Synthetic collision directory must remain exact")
  marker_hash = hash.(marker)
  {:error, :storage_unavailable} = S3.ensure_local(collision)
  true = File.dir?(collision_full)
  ^marker_hash = hash.(marker)
  [] = Path.wildcard(collision_full <> ".part-*")
  %{phase: :held, pending: 0, writers: 0} = after_collision = view.()
  checks = checks ++ [%{name: "Actual Windows rename refusal returns storage_unavailable and removes the temporary cache file",
    after: after_collision, collision_directory_preserved: true, marker_sha256: marker_hash, partials: []}]

  ^original_hash = hash.(original)
  checks = checks ++ [%{name: "Independent original remains exact; ordinary admission refuses throughout", original_sha256: original_hash}]
  modules = Enum.map([Admission, Door, S3, Barkpark.Media], fn mod ->
    file = mod |> :code.which() |> to_string()
    %{module: inspect(mod), file: file, sha256: hash.(file)}
  end)
  result = %{status: "failure_contracts_observed", at: DateTime.to_iso8601(DateTime.utc_now()),
    elapsed_ms: System.monotonic_time(:millisecond) - started, checks: checks, modules: modules,
    root: root, original: original, original_sha256: original_hash, missing_parent: missing_parent,
    collision_directory: collision_full, collision_marker: marker,
    limits: "Actual compiled S3 helper and Req loopback network on Windows. Direct helper calls with explicit test configuration, not a new HTTP-route proof or a repair. No database, real S3/library, source/app/pin change, runtime adoption or recovery authority."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  GenServer.stop(gate)
end
