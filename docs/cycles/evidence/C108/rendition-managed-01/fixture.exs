# Prepared actual full-runtime Renditions.ensure caller. Run not executed.
alias Barkpark.{Media, Repo}
alias Barkpark.Media.{Renditions, ImageBackend}
alias Barkpark.Media.Storage.MediaFile
alias Barkpark.Plugins.Media.Assets
output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
write = fn name, value ->
  path = Path.join(output, name <> ".json")
  File.write!(path <> ".writing", JSON.encode!(value), [:exclusive])
  File.rename!(path <> ".writing", path)
end
await = fn name ->
  deadline = System.monotonic_time(:millisecond) + 90_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(Path.join(output, name)) -> true
      System.monotonic_time(:millisecond) >= deadline -> raise("Rendition caller marker timeout: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
mode = System.fetch_env!("C108_CHECKOUT_MODE")
unless mode in ["ordinary", "managed"], do: raise("Unsupported contract mode")
state = fn ->
  if mode == "ordinary" do
    false = Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?()
    nil = Barkpark.ManagedRuntime.WriteAdmission.Door.server()
    %{enabled: false, configured_server: nil}
  else
    true = Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?()
    Barkpark.ManagedRuntime.WriteAdmission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
    |> Map.take([:phase, :generation, :pending, :writers, :dead_writers])
  end
end
started = System.monotonic_time(:millisecond)
write.("contract-initial", state.())
try do
  await.("setup-go")
  backend = ImageBackend.impl()
  true = backend == Barkpark.Media.ImageBackend.Magick
  original_config = Application.get_env(:barkpark, backend)
  value = try do
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, System.fetch_env!("C108_IMAGE_BIN")))
    true = backend.available?()
    [[workspace, project, dataset]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
    input = Path.join(output, "original.png")
    payload = Base.decode64!("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")
    File.write!(input, payload, [:exclusive])
    {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: input, filename: "caller.png", content_type: "image/png"}, dataset, workspace_id: workspace, project_id: project)
    "image/png" = file.mime_type
    {:ok, asset} = Assets.ensure_for_upload(file)
    row = Repo.get!(MediaFile, file.id)
    source = Media.file_path(file.path)
    ^payload = File.read!(source)
    rel = Path.join(["_renditions", file.id, "thumb.jpg"])
    destination = Media.file_path(rel)
    false = File.exists?(destination)
    nil = Renditions.relative_path(file, "thumb")
    write.("caller-ready", %{media: Media.upload_dir(), file: Map.take(file, [:id, :path, :mime_type, :workspace_id, :project_id, :dataset]), source: source, expected: destination, relative: rel, asset_revision: asset.rev, cold: true, admission: state.(), source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower)})
    await.("render-go")
    false = File.exists?(destination)
    {:ok, ^rel} = Renditions.ensure(file, "thumb")
    ^rel = Renditions.relative_path(file, "thumb")
    bytes = File.read!(destination)
    <<255, 216, _::binary>> = bytes
    stat = File.stat!(destination, time: :posix) |> Map.take([:size, :mtime, :ctime, :inode])
    {:ok, ^rel} = Renditions.ensure(file, "thumb")
    ^bytes = File.read!(destination)
    ^stat = File.stat!(destination, time: :posix) |> Map.take([:size, :mtime, :ctime, :inode])
    {:error, :unknown_preset} = Renditions.ensure(file, "unknown-owned-contract")
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    success_state = state.()
    write.("contract-success", %{status: "actual_cold_cached_contract_observed", admission: success_state, source: source, destination: destination, output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})
    await.("contract-success-reviewed")
    preview = Media.file_path(Path.join(["_renditions", file.id, "preview.jpg"]))
    false = File.exists?(preview)
    # Known refusal path: available=false is asserted BEFORE calling the backend.
    # No arbitrary executable, source removal or fabricated callback result.
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, Path.join(System.fetch_env!("SystemRoot"), "System32/convert.exe")))
    false = backend.available?()
    {:error, :imagemagick_not_found} = failure = Renditions.ensure(file, "preview")
    false = File.exists?(preview)
    [] = Path.wildcard(Path.join(Path.dirname(destination), ".tmp-*"))
    ^bytes = File.read!(destination)
    ^stat = File.stat!(destination, time: :posix) |> Map.take([:size, :mtime, :ctime, :inode])
    # Cached content must keep serving without re-entering the missing backend.
    {:ok, ^rel} = Renditions.ensure(file, "thumb")
    write.("contract-error", %{status: "actual_backend_refusal_observed", returned: inspect(failure), admission: state.(), preview_absent: true, cached_still_exact: true})
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    [] = Path.wildcard(Path.join(Path.dirname(destination), ".tmp-*"))
    %{status: "actual_managed_rendition_contract_observed", returned: "ok", relative: rel, source: source, destination: destination, source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower), cached_second_unchanged: true, row_unchanged: true, asset_unchanged: true, no_partial: true}
  after
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  write.("caller-result", Map.put(value, :config_restored, true))
  await.("render-reviewed")
  write.("result", %{status: "actual_managed_rendition_contract_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
