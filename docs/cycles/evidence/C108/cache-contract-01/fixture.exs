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
Application.delete_env(:barkpark, :cache_warm_test_hook)
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Contract fixture exists; preserve it")
File.mkdir!(root)
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
view = fn gate -> if gate, do: Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]), else: %{admission_enabled: false} end
await = fn predicate ->
  until = System.monotonic_time(:millisecond) + 10_000
  Stream.repeatedly(fn -> cond do predicate.() -> true; System.monotonic_time(:millisecond) >= until -> raise("Contract state timed out"); true -> Process.sleep(10); false end end) |> Enum.find(& &1)
end
parent = self()
Process.put(:gates, [])
Process.put(:checks, [])
Process.put(:bindings, [])
started = System.monotonic_time(:millisecond)
try do
  [[rows_before]] = Repo.query!("SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM media_files m").rows
  for variant <- ["original", "candidate"] do
    source = Path.join(sources, variant <> "-observed.exs")
    [{module, binary}] = Code.compile_file(source)
    Barkpark.Media.Blobstore.S3 = module
    {:ok, {^module, md5}} = :beam_lib.md5(binary)
    ^md5 = module.module_info(:md5)
    Process.put(:bindings, Process.get(:bindings) ++ [%{variant: variant, source: source, source_sha256: hash.(source), compiled_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}])
    for mode <- ["ordinary", "managed"], effect <- ["success", "copy-refusal"] do
      name = variant <> "-" <> mode <> "-" <> effect
      case_root = Path.join(root, name)
      File.mkdir!(case_root)
      media = Path.join(case_root, "media")
      File.mkdir!(media)
      original = Path.join(case_root, "source.bin")
      payload = "Synthetic direct warm contract " <> name
      File.write!(original, payload)
      bytes = byte_size(payload)
      sha = hash.(original)
      key = "uploads/2026/10/" <> name <> "/object.bin"
      full = Path.join(media, key)
      marker = "Synthetic retained collision marker " <> name
      if effect == "copy-refusal" do
        File.mkdir_p!(full)
        File.write!(Path.join(full, "marker.bin"), marker)
      end
      Application.put_env(:barkpark, :media_upload_dir, media)
      Application.put_env(:barkpark, :media_storage, backend: :s3, s3: [endpoint: endpoint, bucket: "synthetic-warm", region: "synthetic-region", access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
      gate = if mode == "managed" do
        instance = "contract-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
        Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
        {:ok, gate} = Admission.start_link(journal: Path.join(case_root, "admission.dets"), instance_id: instance, initialize: true)
        Process.unlink(gate)
        Process.put(:gates, [gate | Process.get(:gates)])
        gate
      else
        Application.put_env(:barkpark, :write_admission, enabled: false)
        nil
      end
      File.write!(Path.join(output, name <> ".contract.json"), JSON.encode!(%{name: name, media: media, key: key, full: full, source: original, bytes: bytes, sha256: sha, effect: effect, marker_bytes: byte_size(marker), marker_sha256: Base.encode16(:crypto.hash(:sha256, marker), case: :lower)}))
      {:ok, %{status: 200}} = Req.get(endpoint <> "/control/observe/" <> name <> "/before")
      Application.put_env(:barkpark, :cache_warm_result_test_hook, fn seen_key, seen_full, copy_result -> send(parent, {:copy_result, self(), seen_key, seen_full, copy_result, view.(gate)}) end)
      {worker, monitor} = spawn_monitor(fn -> send(parent, {:put_result, self(), Barkpark.Media.Blobstore.S3.put_file(key, original, content_type: "application/octet-stream")}) end)
      {copy_result, at_copy} = receive do {:copy_result, ^worker, ^key, ^full, result, state} -> {result, state} after 10_000 -> raise("No actual File.cp result observer") end
      receipt = receive do {:put_result, ^worker, {:ok, receipt}} -> receipt after 10_000 -> raise("No verified remote receipt despite best-effort warm cache") end
      %{received: ^bytes, stored: ^bytes, verified_by: :head, unverified_reason: nil} = receipt
      receive do {:DOWN, ^monitor, :process, ^worker, :normal} -> :ok after 10_000 -> raise("Contract worker did not finish") end
      if effect == "success" do
        :ok = copy_result
        ^payload = File.read!(full)
      else
        {:error, _actual_reason} = copy_result
        true = File.dir?(full)
        ["marker.bin"] = File.ls!(full)
        ^marker = File.read!(Path.join(full, "marker.bin"))
      end
      retained = variant == "candidate" and mode == "managed" and effect == "copy-refusal"
      if gate do
        phase = if retained, do: :recovery_required, else: :open
        pending = if retained, do: 1, else: 0
        await.(fn -> s = view.(gate); s.phase == phase and s.pending == pending and s.writers == 0 end)
      end
      final = view.(gate)
      ^sha = hash.(original)
      {:ok, %{status: 200}} = Req.get(endpoint <> "/control/observe/" <> name <> "/after")
      item = %{name: name, variant: variant, mode: mode, effect: effect, source: original, media: media, key: key, full: full, bytes: bytes, sha256: sha, copy_result: inspect(copy_result), receipt: receipt, at_copy: at_copy, final: final, retained_uncertainty: retained, collision_marker_exact: effect == "copy-refusal", source_exact: true}
      Process.put(:checks, Process.get(:checks) ++ [item])
      File.write!(Path.join(output, "progress.json"), JSON.encode!(Process.get(:checks)))
      if gate, do: GenServer.stop(gate)
    end
  end
  [[^rows_before]] = Repo.query!("SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM media_files m").rows
  result = %{status: "warm_contract_matrix_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started, checks: Process.get(:checks), bindings: Process.get(:bindings), root: root,
    modules: Enum.map([Admission, Barkpark.ManagedRuntime.WriteAdmission.Door, Barkpark.Media.Storage.LocalWrite, Barkpark.Media.Blobstore], fn mod -> file = mod |> :code.which() |> to_string(); %{module: inspect(mod), file: file, sha256: hash.(file)} end),
    limits: "Direct S3.put_file ordinary/managed storage contract matrix only. Best-effort remote receipt can succeed despite local copy refusal; candidate managed recovery policy remains unaccepted. No completed/HTTP Media.upload, full plugins/Content, cache-delete/rendition/native-child coverage, production source repair/adoption, recovery/cleanup or stage acceptance."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  Application.delete_env(:barkpark, :cache_warm_result_test_hook)
  Application.delete_env(:barkpark, :cache_warm_test_hook)
  for gate <- Process.get(:gates, []), Process.alive?(gate), do: GenServer.stop(gate)
  if Process.alive?(repo), do: GenServer.stop(repo)
end
