alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
alias Barkpark.Media.Renditions

[output] = System.argv()
root = Path.expand(Path.join(output, "synthetic-fixture"))
if File.exists?(root), do: raise("Fixture exists; preserve it")
File.mkdir!(root)
media = Path.join(root, "media")
id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
cache_dir = Path.expand(Path.join([media, "_renditions", id]))
unless String.starts_with?(cache_dir, root <> "/"), do: raise("Fixture escaped output")
File.mkdir_p!(cache_dir)
cache_file = Path.join(cache_dir, "lqip.jpg")
original = Path.join(media, "owned-original.bin")
backup = Path.join(root, "original-backup.bin")
File.write!(cache_file, "synthetic rendition bytes; no real media")
File.write!(original, "synthetic original remains unchanged")
File.cp!(original, backup)
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
original_hash = hash.(original)
cache_hash = hash.(cache_file)
instance = "c109-rendition-boundary-" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
journal = Path.join(root, "write-admission.dets")
Application.put_env(:barkpark, :media_upload_dir, media)
Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
{:ok, gate} = Admission.start_link(journal: journal, instance_id: instance, initialize: true)
Process.unlink(gate)
started = System.monotonic_time(:millisecond)
try do
  %{phase: :open, generation: generation} = Admission.status(gate)
  {:ok, :held, hold} = Admission.begin_hold(gate, "synthetic-read-only-boundary-review", generation)
  true = Admission.held?(gate, hold)
  {:error, {:write_admission, :admission_closed}} = Door.admit(fn -> raise("Held door ran") end)
  # Only the public helper is invoked, not HTTP/Checkout/Media deletion.
  # Its exact synthetic target was allocated above and checked inside root.
  :ok = Renditions.delete_for_file(id)
  if File.exists?(cache_file), do: raise("Expected direct helper deletion was not observed")
  %{phase: :held, pending: 0, writers: 0} = after_delete = Admission.status(gate)
  unless hash.(original) == original_hash and hash.(backup) == original_hash,
    do: raise("Synthetic original or immutable backup changed")
  modules = Enum.map([Admission, Door, Renditions, Barkpark.Media], fn mod ->
    file = mod |> :code.which() |> to_string()
    %{module: inspect(mod), file: file, sha256: hash.(file)}
  end)
  result = %{at: DateTime.to_iso8601(DateTime.utc_now()), status: "gap_reproduced",
    elapsed_ms: System.monotonic_time(:millisecond) - started,
    observation: "Direct Renditions.delete_for_file removes its synthetic cache directory while coordinator stays held with zero pending/writers; an ordinary Door.admit refuses. This proves the helper alone is not a physical admission boundary.",
    root: root, cache_dir: cache_dir, cache_before_sha256: cache_hash,
    cache_after_exists: false, original_sha256: original_hash, original_and_backup_unchanged: true,
    held_after: inspect(after_delete), modules: modules,
    limits: "Actual compiled helper and native Windows filesystem, but direct internal invocation only. No claim that every real caller bypasses admission; Checkout/HTTP outer coverage needs separate validation. No DB, renderer, S3, network, user media, cleanup authority, application pin/package change or production deletion."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms, :cache_after_exists, :original_and_backup_unchanged])))
after
  if Process.alive?(gate), do: GenServer.stop(gate)
end
