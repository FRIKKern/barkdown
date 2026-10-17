alias Barkpark.Media.Blobstore.S3, as: Original
alias Barkpark.Media.Blobstore.S3.ReceiveCandidate, as: Candidate
[output, endpoint, candidate] = System.argv()
Code.require_file(candidate)
{:ok, _} = Application.ensure_all_started(:req)
Logger.configure(level: :warning)
Application.put_env(:barkpark, :write_admission, enabled: false)
false = Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?()
Application.put_env(:barkpark, :media_storage, backend: :s3, s3: [endpoint: endpoint,
  bucket: "ordinary-cache", region: "synthetic-region", access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
started = System.monotonic_time(:millisecond)
checks = for {name, module} <- [{"original", Original}, {"candidate", Candidate}] do
  root = Path.join(output, name)
  if File.exists?(root), do: raise("Ordinary fixture exists; preserve it")
  File.mkdir!(root)
  media = Path.join(root, "media")
  File.mkdir!(media)
  Application.put_env(:barkpark, :media_upload_dir, media)
  key = "uploads/2026/10/" <> name <> "/success.svg"
  full = Barkpark.Media.file_path(key)
  {:ok, ^full} = module.ensure_local(key)
  payload = "Synthetic ordinary cache bytes"
  ^payload = File.read!(full)
  {:ok, ^full} = module.ensure_local(key)
  missing = "uploads/2026/10/" <> name <> "/missing-case/missing.svg"
  transport = "uploads/2026/10/" <> name <> "/transport-case/transport.svg"
  {:error, :not_found} = missing_result = module.ensure_local(missing)
  {:error, :storage_unavailable} = transport_result = module.ensure_local(transport)
  false = File.exists?(Barkpark.Media.file_path(missing))
  false = File.exists?(Barkpark.Media.file_path(transport))
  [] = Path.wildcard(Path.join(media, "**/*.part-*"))
  expected_parent = name == "original"
  ^expected_parent = File.dir?(Path.dirname(Barkpark.Media.file_path(missing)))
  ^expected_parent = File.dir?(Path.dirname(Barkpark.Media.file_path(transport)))
  %{name: name, ordinary_admission_disabled: true, success: full, bytes: byte_size(payload), sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower), cached_read: true, missing: inspect(missing_result), transport: inspect(transport_result), missing_parent_exists: expected_parent, transport_parent_exists: expected_parent, no_partials: true}
end
result = %{status: "ordinary_contracts_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started, checks: checks,
  modules: Enum.map([Original, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite], fn mod -> file = mod |> :code.which() |> to_string(); %{module: inspect(mod), file: file, sha256: Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower)} end),
  limits: "Direct original-versus-private-candidate ordinary non-managed S3 ensure_local success/cached/missing/transport contract only. Parent creation intentionally differs on failed receive. No public HTTP adoption, native children/full caller coverage, production repair or recovery authority."}
File.write!(Path.join(output, "result.json"), JSON.encode!(result))
IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
