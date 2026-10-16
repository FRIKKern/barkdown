# Prepared actual full-runtime HTTP pending-original fixture; no direct Renditions.ensure call.
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
    [[workspace, project, dataset, ws_slug, project_slug]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug,w.slug,p.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
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
    originals = for mod <- [BarkparkWeb.Router, Barkpark.Content.Errors, Barkpark.Media.Delivery, Barkpark.Media.Storage.Access, BarkparkWeb.ScopeHelpers] do
      {:module, ^mod} = Code.ensure_loaded(mod)
      {^mod, binary, file_path} = :code.get_object_code(mod)
      {:ok, {^mod, md5}} = :beam_lib.md5(binary)
      ^md5 = mod.module_info(:md5)
      %{module: inspect(mod), file: List.to_string(file_path), code_path: List.to_string(:code.which(mod)), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
    end
    write.("original-http-bindings", originals)
    write.("caller-ready", %{media: Media.upload_dir(), file: Map.take(file, [:id, :path, :mime_type, :workspace_id, :project_id, :dataset]), source: source, expected: destination, relative: rel, asset_revision: asset.rev, asset_id: asset.id, scope: %{workspace_slug: ws_slug, project_slug: project_slug, dataset: dataset}, cold: true, admission: state.(), source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower)})
    await.("http-positive-reviewed")
    true = File.regular?(destination)
    bytes = File.read!(destination)
    <<255, 216, _::binary>> = bytes
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    write.("http-positive-checked", %{status: "actual_http_positive_checked", admission: state.(), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})
    await.("trace-go")
    await.("prepare-go")
    request = Path.join(output, "native-request.json") |> File.read!() |> JSON.decode!()
    true = request["mediaId"] == file.id and request["expectedKey"] == file.path
    true = request["file"]["sha256"] == Base.encode16(:crypto.hash(:sha256, payload), case: :lower)
    true = backend.available?()
    [[prepared]] = Ecto.Adapters.SQL.query!(Repo, "SELECT public.prepare_media_delete_v1($1::jsonb)", [request]).rows
    "prepared" = prepared["state"]
    true = prepared["rowStillPresent"]
    [[operation]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(o) FROM public.media_delete_operations_v1 o WHERE operation_id=$1::text::uuid", [request["operationId"]]).rows
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    write.("pending-prepared", %{request: request, prepared: prepared, operation: operation, row_unchanged: true, asset_unchanged: true, available: true})
    # Both conditions must be observed before the cold request; never invoke this utility.
    unavailable_bin = Path.join([System.fetch_env!("SystemRoot"), "System32", "convert.exe"])
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, unavailable_bin))
    false = backend.available?()
    write.("backend-unavailable", %{bin: unavailable_bin, available: false, pending_operation_id: request["operationId"], admission: state.()})
    await.("held-go")
    held = state.()
    :held = held.phase
    0 = held.pending
    0 = held.writers
    tracer = Barkdown.PrivateNativeInvocationTrace.arm()
    Process.put(:c108_owned_trace, tracer)
    write.("trace-ready", %{status: "armed_after_actual_held0_pending_original_and_backend_unavailable", beam_os_pid: System.pid(), admission: held})
    await.("trace-finish")
    drained = Process.delete(:c108_owned_trace) |> Barkdown.PrivateNativeInvocationTrace.finish()
    0 = drained.count
    [] = drained.events
    true = drained.pattern_disabled and drained.delivered and drained.processed_ack
    write.("invocation-trace", drained)
    await.("http-reviewed")
    ^held = state.()
    [[^operation]] = Ecto.Adapters.SQL.query!(Repo, "SELECT to_jsonb(o) FROM public.media_delete_operations_v1 o WHERE operation_id=$1::text::uuid", [request["operationId"]]).rows
    ^bytes = File.read!(destination)
    false = File.exists?(Media.file_path(Path.join(["_renditions", file.id, "preview.jpg"])))
    [] = Path.wildcard(Path.join(Path.dirname(destination), ".tmp-*"))
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    %{status: "actual_http_held_overlap_contract_observed", relative: rel, destination: destination, source: source, cached_exact: true, row_unchanged: true, asset_unchanged: true, no_partial: true}
  after
    if tracer = Process.delete(:c108_owned_trace), do: write.("invocation-trace-on-error", Barkdown.PrivateNativeInvocationTrace.finish(tracer))
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  write.("caller-result", Map.put(value, :config_restored, true))
  await.("fixture-reviewed")
  write.("result", %{status: "actual_http_held_overlap_contract_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
