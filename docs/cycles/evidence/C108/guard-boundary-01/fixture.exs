# Private combined caller proof. HTTP alone renders, checks out and releases.
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
      System.monotonic_time(:millisecond) >= deadline -> raise("Combined caller marker timeout: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
state = fn ->
  true = Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?()
  Barkpark.ManagedRuntime.WriteAdmission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
  |> Map.take([:phase, :generation, :pending, :writers, :dead_writers])
end
revision_exact = fn asset ->
  revision = Repo.get!(Barkpark.Content.Revision, asset.current_revision_id)
  true = revision.document_id == asset.id
  true = revision.doc_id == String.replace_prefix(asset.doc_id, "drafts.", "")
  for k <- [:type, :dataset, :dataset_id, :workspace_id, :project_id, :title, :status, :content, :rev] do
    true = Map.fetch!(revision, k) == Map.fetch!(asset, k)
  end
  %{document_id: asset.id, revision_id: revision.id, rev: asset.rev, content: asset.content, snapshot_exact: true}
end
started = System.monotonic_time(:millisecond)
write.("contract-initial", state.())
try do
  await.("setup-go")
  bindings = Path.join(output, "candidate-bindings.json") |> File.read!() |> JSON.decode!()
  requirements = [
    {Barkpark.Media.ImageBackend.Magick, [{:available?, 0}, {:render, 4}]},
    {Renditions, [{:ensure, 2}, {:ensure, 3}, {:delete_for_file, 1}, {:delete_for_file, 2}]},
    {Barkpark.Media.Storage.Checkout, [{:checkout, 3}, {:undo_checkout, 4}]},
    {BarkparkWeb.MediaController, [{:serve_rendition, 2}]}
  ]
  actual = for {mod, exports} <- requirements do
    binding = Enum.find(bindings, &(&1["module"] == inspect(mod)))
    true = is_map(binding)
    md5 = Base.encode16(mod.module_info(:md5), case: :lower)
    ^md5 = binding["loaded_md5"]
    for {name, arity} <- exports, do: true = function_exported?(mod, name, arity)
    %{module: inspect(mod), loaded_md5: md5, exports: Enum.map(exports, fn {n, a} -> %{name: n, arity: a} end)}
  end
  write.("post-start-private-bindings", actual)
  modules = [Content.Broadcast, Auth, Content.Schema, BarkparkWeb.Router, Content.Errors, Media.Delivery,
    Media.Storage.Access, BarkparkWeb.ScopeHelpers, Barkpark.Tenancy, Barkpark.Tenancy.Auth,
    Barkpark.Tenancy.Workspace, Barkpark.Tenancy.Project, Barkpark.Tenancy.Dataset,
    Content.Scope, BarkparkWeb.Plugs.ResolveWorkspace, BarkparkWeb.Plugs.ResolveProject,
    BarkparkWeb.Plugs.OptionalSessionToken, BarkparkWeb.Plugs.RequireToken,
    BarkparkWeb.Plugs.RequireShareScope, Barkpark.ManagedRuntime.WriteAdmission.Door,
    BarkparkWeb.V1.MediaController, BarkparkWeb.FallbackController,
    BarkparkWeb.Plugs.RequireWritePermission, Media.Storage.Actor, Media.Delivery.AssetResponse]
  originals = for mod <- modules do
    {:module, ^mod} = Code.ensure_loaded(mod)
    {^mod, binary, file_path} = :code.get_object_code(mod)
    {:ok, {^mod, md5}} = :beam_lib.md5(binary)
    ^md5 = mod.module_info(:md5)
    %{module: inspect(mod), file: List.to_string(file_path), code_path: List.to_string(:code.which(mod)), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
  end
  write.("original-http-bindings", originals)
  backend = ImageBackend.impl()
  true = backend == Barkpark.Media.ImageBackend.Magick
  original_config = Application.get_env(:barkpark, backend)
  hook_keys = [:checkout_release_test_hook, :rendition_delete_before_test_hook, :rendition_delete_result_test_hook]
  original_hooks = Map.new(hook_keys, &{&1, Application.get_env(:barkpark, &1)})
  value = try do
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, System.fetch_env!("C108_IMAGE_BIN")))
    true = backend.available?()
    [[workspace, project, dataset, ws_slug, project_slug]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug,w.slug,p.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
    "production" = dataset
    tokens = System.fetch_env!("C108_HTTP_TOKEN_FILE") |> File.read!() |> JSON.decode!()
    {:ok, token} = Auth.create_token(Map.fetch!(tokens, "holder"), "compose-holder", dataset, ["read", "write"], workspace)
    write.("holder-token-scope", %{label: token.label, permissions: token.permissions, dataset: token.dataset, workspace_id: token.workspace_id})
    input = Path.join(output, "original.png")
    payload = Base.decode64!("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")
    File.write!(input, payload, [:exclusive])
    {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: input, filename: "compose.png", content_type: "image/png"}, dataset, workspace_id: workspace, project_id: project)
    {:ok, asset} = Assets.ensure_for_upload(file)
    {:ok, returned} = Content.upsert_document("mediaAsset", %{"doc_id" => asset.doc_id, "title" => asset.title, "status" => asset.status, "content" => Map.put(asset.content || %{}, "bp_visibility", "private")}, dataset, [source: :api] ++ MediaFile.scope_opts(file))
    asset = Media.asset_doc_for_file(file, dataset, MediaFile.scope_opts(file))
    changed = Map.from_struct(returned) |> Enum.filter(fn {k, v} -> Map.fetch!(Map.from_struct(asset), k) != v end) |> Enum.map(&elem(&1, 0)) |> Enum.sort()
    [:current_revision_id] = changed
    write.("asset-readback", revision_exact.(asset) |> Map.put(:changed_fields, changed))
    "private" = Media.Storage.Access.visibility(asset)
    row = Repo.get!(MediaFile, file.id)
    source = Media.file_path(file.path)
    ^payload = File.read!(source)
    rel = Path.join(["_renditions", file.id, "thumb.jpg"])
    destination = Media.file_path(rel)
    false = File.exists?(destination)
    nil = Renditions.relative_path(file, "thumb")
    write.("caller-ready", %{media: Media.upload_dir(), file: Map.take(file, [:id, :path, :object_key, :mime_type, :workspace_id, :project_id, :dataset]), source: source, expected: destination, relative: rel, asset_id: asset.id, asset_revision: asset.rev, visibility: "private", scope: %{workspace_slug: ws_slug, project_slug: project_slug, dataset: dataset}, cold: true, admission: state.(), source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower)})
    await.("http-positive-reviewed")
    bytes = File.read!(destination)
    <<255, 216, _::binary>> = bytes
    ^bytes = File.read!(Path.join(output, "rendered-before-invalidation.jpg"))
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    topic = Content.Broadcast.doc_topic(Barkpark.Content.DraftId.published_id(asset.doc_id), "mediaAsset", asset.workspace_id, dataset)
    :ok = Phoenix.PubSub.subscribe(Barkpark.PubSub, topic)
    await_doc_event = fn expected_rev ->
      receive do
        {:doc_updated, %{rev: ^expected_rev} = message} ->
          true = message.doc_id == asset.doc_id
          true = message.workspace_id == asset.workspace_id
          true = message.project_id == asset.project_id
          Map.take(message, [:event_id, :doc_id, :rev, :previous_rev, :workspace_id, :project_id])
      after 5_000 -> raise "Scoped Content notification missing for expected committed revision"
      end
    end
    Application.put_env(:barkpark, :checkout_release_test_hook, fn doc, current_file, updated ->
      write.("release-after-content", %{media_id: current_file.id, previous_holder: doc.content["checkedOutBy"], updated_holder: updated.content["checkedOutBy"], updated_rev: updated.rev, caller: inspect(self()), transaction: Repo.in_transaction?(), queue_owned: Process.get(:barkpark_deferred_owner) == true, admission: state.()})
    end)
    Application.put_env(:barkpark, :rendition_delete_before_test_hook, fn id, dir, key ->
      write.("delete-before", %{media_id: id, dir: dir, original_key: key, caller: inspect(self()), admission: state.()})
    end)
    Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
      write.("delete-result", %{media_id: id, dir: dir, result: inspect(result), ok: match?({:ok, _}, result), absent: match?({:error, :enoent}, File.lstat(dir)), caller: inspect(self())})
    end)
    write.("http-positive-checked", %{admission: state.(), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})
    await.("checkout-reviewed")
    held_asset = Media.asset_doc_for_file(file, dataset, MediaFile.scope_opts(file))
    "compose-holder" = held_asset.content["checkedOutBy"]
    {:ok, _, _} = DateTime.from_iso8601(held_asset.content["checkedOutAt"])
    true = Map.drop(held_asset.content, ["checkedOutBy", "checkedOutAt"]) == Map.drop(asset.content, ["checkedOutBy", "checkedOutAt"])
    for k <- [:id, :doc_id, :workspace_id, :project_id, :dataset_id, :dataset, :type, :title, :status], do: true = Map.fetch!(held_asset, k) == Map.fetch!(asset, k)
    true = held_asset.rev != asset.rev
    true = Repo.get!(MediaFile, file.id) == row
    ^payload = File.read!(source)
    ^bytes = File.read!(destination)
    checkout_event = await_doc_event.(held_asset.rev)
    write.("checkout-checked", revision_exact.(held_asset))
    await.("undo-reviewed")
    cleared = Media.asset_doc_for_file(file, dataset, MediaFile.scope_opts(file))
    nil = cleared.content["checkedOutBy"]
    nil = cleared.content["checkedOutAt"]
    true = Map.drop(cleared.content, ["checkedOutBy", "checkedOutAt"]) == Map.drop(asset.content, ["checkedOutBy", "checkedOutAt"])
    for k <- [:id, :doc_id, :workspace_id, :project_id, :dataset_id, :dataset, :type, :title, :status], do: true = Map.fetch!(cleared, k) == Map.fetch!(asset, k)
    true = cleared.rev != held_asset.rev
    true = Repo.get!(MediaFile, file.id) == row
    ^payload = File.read!(source)
    {:error, :enoent} = File.lstat(Path.dirname(destination))
    ^bytes = File.read!(Path.join(output, "rendered-before-invalidation.jpg"))
    undo_event = await_doc_event.(cleared.rev)
    true = undo_event.previous_rev == held_asset.rev
    write.("content-broadcast-checked", %{topic: topic, checkout: checkout_event, undo: undo_event, observed_after_response_and_stored_revision_readback: true})
    write.("undo-checked", revision_exact.(cleared))
    %{status: "actual_private_boundary_render_checkout_undo_observed", media_id: file.id, row_unchanged: true, original_exact: true, cache_absent: true, artifact_exact: true, admission: state.()}
  after
    for {key, previous} <- original_hooks do
      if is_nil(previous), do: Application.delete_env(:barkpark, key), else: Application.put_env(:barkpark, key, previous)
    end
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  for {key, previous} <- original_hooks, do: true = Application.get_env(:barkpark, key) == previous
  write.("caller-result", Map.put(value, :config_restored, true))
  await.("fixture-reviewed")
  write.("result", %{status: "actual_private_boundary_render_checkout_undo_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
