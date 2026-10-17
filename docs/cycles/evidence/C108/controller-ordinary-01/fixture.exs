# Prepared actual ordinary-disabled full-runtime HTTP private-asset permission fixture; no direct Renditions.ensure call.
alias Barkpark.{Media, Repo, Auth, Content}
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
    tokens = System.fetch_env!("C108_HTTP_TOKEN_FILE") |> File.read!() |> JSON.decode!()
    tiers = for {key, permissions} <- [{"public_read", ["public-read"]}, {"member_read", ["read"]}] do
      {:ok, token} = Auth.create_token(Map.fetch!(tokens, key), "rendition-" <> key, dataset, permissions, workspace)
      %{tier: key, permissions: token.permissions, dataset: token.dataset, workspace_id: token.workspace_id}
    end
    write.("token-tiers", tiers)
    input = Path.join(output, "original.png")
    payload = Base.decode64!("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")
    File.write!(input, payload, [:exclusive])
    {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: input, filename: "caller.png", content_type: "image/png"}, dataset, workspace_id: workspace, project_id: project)
    "image/png" = file.mime_type
    {:ok, asset} = Assets.ensure_for_upload(file)
    {:ok, asset} = Content.upsert_document("mediaAsset", %{"doc_id" => asset.doc_id, "title" => asset.title, "status" => asset.status, "content" => Map.put(asset.content || %{}, "bp_visibility", "private")}, dataset, [source: :api] ++ MediaFile.scope_opts(file))
    "private" = Barkpark.Media.Storage.Access.visibility(asset)
    # Revision insertion binds current_revision_id after the document UPDATE returned.
    # Require that exact single-field difference, then bind the revision snapshot.
    returned = asset
    asset = Media.asset_doc_for_file(file, dataset, MediaFile.scope_opts(file))
    changed = Map.from_struct(returned) |> Enum.filter(fn {k, v} -> Map.fetch!(Map.from_struct(asset), k) != v end) |> Enum.map(&elem(&1, 0)) |> Enum.sort()
    [:current_revision_id] = changed
    revision = Repo.get!(Barkpark.Content.Revision, asset.current_revision_id)
    true = revision.document_id == asset.id
    true = revision.doc_id == String.replace_prefix(asset.doc_id, "drafts.", "")
    for k <- [:type, :dataset, :dataset_id, :workspace_id, :project_id, :title, :status, :content, :rev] do
      true = Map.fetch!(revision, k) == Map.fetch!(asset, k)
    end
    "private" = Barkpark.Media.Storage.Access.visibility(asset)
    write.("asset-readback", %{changed_fields: changed, returned_current_revision_id: returned.current_revision_id, persisted_current_revision_id: asset.current_revision_id, revision_id: revision.id, document_id: asset.id, rev: asset.rev, revision_snapshot_exact: true, visibility: "private"})

    row = Repo.get!(MediaFile, file.id)
    source = Media.file_path(file.path)
    ^payload = File.read!(source)
    rel = Path.join(["_renditions", file.id, "thumb.jpg"])
    destination = Media.file_path(rel)
    false = File.exists?(destination)
    nil = Renditions.relative_path(file, "thumb")
    originals = for mod <- [Barkpark.Auth, Barkpark.Content.Schema, BarkparkWeb.Router, Barkpark.Content.Errors, Barkpark.Media.Delivery, Barkpark.Media.Storage.Access, BarkparkWeb.ScopeHelpers] do
      {:module, ^mod} = Code.ensure_loaded(mod)
      {^mod, binary, file_path} = :code.get_object_code(mod)
      {:ok, {^mod, md5}} = :beam_lib.md5(binary)
      ^md5 = mod.module_info(:md5)
      %{module: inspect(mod), file: List.to_string(file_path), code_path: List.to_string(:code.which(mod)), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
    end
    write.("original-http-bindings", originals)
    write.("caller-ready", %{media: Media.upload_dir(), file: Map.take(file, [:id, :path, :mime_type, :workspace_id, :project_id, :dataset]), source: source, expected: destination, relative: rel, asset_revision: asset.rev, asset_id: asset.id, visibility: Barkpark.Media.Storage.Access.visibility(asset), tiers: tiers, scope: %{workspace_slug: ws_slug, project_slug: project_slug, dataset: dataset}, cold: true, admission: state.(), source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower)})
    await.("http-positive-reviewed")
    true = File.regular?(destination)
    bytes = File.read!(destination)
    <<255, 216, _::binary>> = bytes
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    write.("http-positive-checked", %{status: "actual_http_positive_checked", admission: state.(), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})
    await.("trace-go")
    held = state.()
    %{enabled: false, configured_server: nil} = held
    tracer = Barkdown.PrivateNativeInvocationTrace.arm()
    Process.put(:c108_owned_trace, tracer)
    write.("trace-ready", %{status: "armed_after_private_asset_positive", beam_os_pid: System.pid(), admission: held})
    await.("trace-finish")
    drained = Process.delete(:c108_owned_trace) |> Barkdown.PrivateNativeInvocationTrace.finish()
    0 = drained.count
    [] = drained.events
    true = drained.pattern_disabled and drained.delivered and drained.processed_ack
    write.("invocation-trace", drained)
    await.("http-reviewed")
    ^held = state.()
    ^bytes = File.read!(destination)
    false = File.exists?(Media.file_path(Path.join(["_renditions", file.id, "preview.jpg"])))
    [] = Path.wildcard(Path.join(Path.dirname(destination), ".tmp-*"))
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    %{status: "actual_http_permission_contract_observed", relative: rel, destination: destination, source: source, cached_exact: true, row_unchanged: true, asset_unchanged: true, no_partial: true}
  after
    if tracer = Process.delete(:c108_owned_trace), do: write.("invocation-trace-on-error", Barkdown.PrivateNativeInvocationTrace.finish(tracer))
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  write.("caller-result", Map.put(value, :config_restored, true) |> Map.put(:admission, state.()))
  await.("fixture-reviewed")
  write.("result", %{status: "actual_http_permission_contract_completed", admission: state.(), elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
