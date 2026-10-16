# Private synthetic same-workspace/two-project fixture. Actual HTTP causes first rendition.
alias Barkpark.{Auth, Content, Media, Repo, Tenancy}
alias Barkpark.Tenancy.Auth, as: TenancyAuth
alias Barkpark.Media.{ImageBackend, Renditions}
alias Barkpark.Media.Storage.{Access, MediaFile}
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
      System.monotonic_time(:millisecond) >= deadline -> raise("Owned scope marker timeout: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
state = fn ->
  true = Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?()
  Barkpark.ManagedRuntime.WriteAdmission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
  |> Map.take([:phase, :generation, :pending, :writers, :dead_writers])
end
started = System.monotonic_time(:millisecond)
write.("contract-initial", state.())
try do
  await.("setup-go")
  # Bind the actual carried owners before creating either scope or token.
  modules = [Barkpark.Auth, Barkpark.Content.Schema, BarkparkWeb.Router,
    Barkpark.Content.Errors, Barkpark.Media.Delivery, Access, BarkparkWeb.ScopeHelpers,
    Tenancy, TenancyAuth, Barkpark.Tenancy.Workspace, Barkpark.Tenancy.Project,
    Barkpark.Tenancy.Dataset, Barkpark.Content.Scope, BarkparkWeb.Plugs.ResolveWorkspace,
    BarkparkWeb.Plugs.ResolveProject, BarkparkWeb.Plugs.OptionalSessionToken,
    BarkparkWeb.Plugs.RequireToken, BarkparkWeb.Plugs.RequireShareScope]
  bindings = for mod <- modules do
    {:module, ^mod} = Code.ensure_loaded(mod)
    {^mod, binary, path} = :code.get_object_code(mod)
    {:ok, {^mod, md5}} = :beam_lib.md5(binary)
    ^md5 = mod.module_info(:md5)
    %{module: inspect(mod), file: List.to_string(path), code_path: List.to_string(:code.which(mod)),
      beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
  end
  write.("original-http-bindings", bindings)
  backend = ImageBackend.impl()
  true = backend == Barkpark.Media.ImageBackend.Magick
  original_config = Application.get_env(:barkpark, backend)
  value = try do
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, System.fetch_env!("C108_IMAGE_BIN")))
    true = backend.available?()
    tokens = System.fetch_env!("C108_HTTP_TOKEN_FILE") |> File.read!() |> JSON.decode!()
    inputs = Path.join(output, "inputs.json") |> File.read!() |> JSON.decode!()
    {:ok, ws} = Tenancy.create_workspace(%{slug: "c108-projects-#{System.unique_integer([:positive])}", name: "Owned project pair"})
    entries = for {key, project_slug} <- [{"a", "default"}, {"b", "other"}] do
      {:ok, project} = Tenancy.create_project(ws, %{slug: project_slug, name: "Owned #{project_slug}"})
      {:ok, dataset} = Tenancy.get_or_create_dataset(project, "production")
      scope = [workspace_id: ws.id, project_id: project.id]
      {:ok, _schema} = Content.upsert_schema(%{"name" => "mediaAsset", "title" => "Media Asset", "visibility" => "private", "fields" => []}, dataset.slug, scope)
      credentials = for {tier, permissions} <- [{"member", ["read"]}, {"admin", ["read", "write", "admin"]}] do
        {:ok, token} = Auth.create_token(Map.fetch!(tokens, key <> "_" <> tier), "c108-#{key}-#{tier}", dataset.slug, permissions, ws.id, dataset_bound: true)
        ^token = Repo.get!(Barkpark.Auth.ApiToken, token.id)
        :ok = TenancyAuth.authorize_with_reason(token, ws.id, :read)
        membership = TenancyAuth.membership(token, ws.id)
        true = is_binary(membership.id)
        true = token.workspace_id == ws.id and token.dataset == dataset.slug and token.dataset_bound == true
        %{tier: tier, token: token, receipt: %{id: token.id, tier: tier, permissions: token.permissions, dataset: token.dataset,
          dataset_bound: token.dataset_bound, workspace_id: token.workspace_id, membership_id: membership.id, role: membership.role}}
      end
      input = Map.fetch!(inputs, key)
      payload = File.read!(Path.join(output, Map.fetch!(input, "file")))
      true = Base.encode16(:crypto.hash(:sha256, payload), case: :lower) == Map.fetch!(input, "sha256")
      {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: Path.join(output, input["file"]), filename: "same-name.png", content_type: "image/png"}, dataset.slug, scope)
      true = file.workspace_id == ws.id and file.project_id == project.id and file.dataset_id == dataset.id
      "image/png" = file.mime_type
      {:ok, asset} = Assets.ensure_for_upload(file)
      {:ok, returned} = Content.upsert_document("mediaAsset", %{"doc_id" => asset.doc_id, "title" => asset.title, "status" => asset.status,
        "content" => Map.put(asset.content || %{}, "bp_visibility", "private")}, dataset.slug, [source: :api] ++ scope)
      asset = Media.asset_doc_for_file(file, dataset.slug, scope)
      changed = Map.from_struct(returned) |> Enum.filter(fn {k, v} -> Map.fetch!(Map.from_struct(asset), k) != v end) |> Enum.map(&elem(&1, 0)) |> Enum.sort()
      [:current_revision_id] = changed
      revision = Repo.get!(Barkpark.Content.Revision, asset.current_revision_id)
      true = revision.document_id == asset.id and revision.doc_id == String.replace_prefix(asset.doc_id, "drafts.", "")
      for k <- [:type, :dataset, :dataset_id, :workspace_id, :project_id, :title, :status, :content, :rev] do
        true = Map.fetch!(revision, k) == Map.fetch!(asset, k)
      end
      "private" = Access.visibility(asset)
      row = Repo.get!(MediaFile, file.id)
      source = Media.file_path(file.path)
      ^payload = File.read!(source)
      relative = Path.join(["_renditions", file.id, "thumb.jpg"])
      destination = Media.file_path(relative)
      false = File.exists?(destination)
      nil = Renditions.relative_path(file, "thumb")
      %{key: key, workspace: ws, project: project, dataset: dataset, credentials: credentials,
        file: file, row: row, asset: asset, source: source, payload: payload, relative: relative, destination: destination}
    end
    [a, b] = entries
    true = a.workspace.id == b.workspace.id and a.project.id != b.project.id and a.dataset.id != b.dataset.id
    true = a.project.slug != b.project.slug and a.dataset.slug == b.dataset.slug
    true = a.file.id != b.file.id and a.file.path != b.file.path and a.payload != b.payload
    for {own, other} <- [{a, b}, {b, a}], credential <- own.credentials do
      membership = TenancyAuth.membership(credential.token, other.workspace.id)
      true = is_binary(membership.id)
      :ok = TenancyAuth.authorize_with_reason(credential.token, other.workspace.id, :read)
    end
    receipts = for e <- entries do
      %{key: e.key, file: Map.take(e.file, [:id, :path, :mime_type, :workspace_id, :project_id, :dataset, :dataset_id]),
        source: e.source, expected: e.destination, relative: e.relative, asset_id: e.asset.id, asset_revision: e.asset.rev,
        visibility: "private", source_sha256: Base.encode16(:crypto.hash(:sha256, e.payload), case: :lower),
        scope: %{workspace_id: e.workspace.id, workspace_slug: e.workspace.slug, project_id: e.project.id, project_slug: e.project.slug, dataset: e.dataset.slug, dataset_id: e.dataset.id},
        tokens: Enum.map(e.credentials, & &1.receipt)}
    end
    write.("caller-ready", %{media: Media.upload_dir(), entries: receipts, cold: true, admission: state.(), original_module_count: length(modules)})
    await.("http-positive-reviewed")
    cached = for e <- entries do
      true = File.regular?(e.destination)
      bytes = File.read!(e.destination)
      <<255, 216, _::binary>> = bytes
      true = Repo.get!(MediaFile, e.file.id) == e.row
      true = Assets.find_by_media_file_id(e.file.id, e.dataset.slug, MediaFile.scope_opts(e.file)) == e.asset
      true = File.read!(e.source) == e.payload
      bytes
    end
    [ca, cb] = cached
    true = ca != cb
    write.("http-positive-checked", %{status: "two_actual_http_positives_checked", admission: state.(), output_hashes: Enum.map(cached, &Base.encode16(:crypto.hash(:sha256, &1), case: :lower))})
    await.("trace-go")
    initial = state.()
    :open = initial.phase
    0 = initial.pending
    0 = initial.writers
    tracer = Barkdown.PrivateNativeInvocationTrace.arm()
    Process.put(:c108_owned_trace, tracer)
    write.("trace-ready", %{status: "armed_after_two_actual_project_positives", admission: initial, beam_os_pid: System.pid()})
    await.("trace-finish")
    drained = Process.delete(:c108_owned_trace) |> Barkdown.PrivateNativeInvocationTrace.finish()
    0 = drained.count
    [] = drained.events
    true = drained.pattern_disabled and drained.delivered and drained.processed_ack
    write.("invocation-trace", drained)
    await.("http-reviewed")
    ^initial = state.()
    for {e, bytes} <- Enum.zip(entries, cached) do
      ^bytes = File.read!(e.destination)
      false = File.exists?(Media.file_path(Path.join(["_renditions", e.file.id, "preview.jpg"])))
      [] = Path.wildcard(Path.join(Path.dirname(e.destination), ".tmp-*"))
      true = Repo.get!(MediaFile, e.file.id) == e.row
      true = Assets.find_by_media_file_id(e.file.id, e.dataset.slug, MediaFile.scope_opts(e.file)) == e.asset
      true = File.read!(e.source) == e.payload
      true = Repo.get!(Tenancy.Workspace, e.workspace.id) == e.workspace
      true = Repo.get!(Tenancy.Project, e.project.id) == e.project
      true = Repo.get!(Tenancy.Dataset, e.dataset.id) == e.dataset
    end
    %{status: "actual_http_project_contract_observed", entries: receipts, cached_exact: true, row_unchanged: true, asset_unchanged: true, no_partial: true}
  after
    if tracer = Process.delete(:c108_owned_trace), do: write.("invocation-trace-on-error", Barkdown.PrivateNativeInvocationTrace.finish(tracer))
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  write.("caller-result", Map.put(value, :config_restored, true))
  await.("fixture-reviewed")
  write.("result", %{status: "actual_http_project_contract_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
