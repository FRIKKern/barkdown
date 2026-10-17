# Private HTTP fixture; exact599 modules, actual full application; no production adoption.
alias Barkpark.{Media, Repo, Auth}
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
      System.monotonic_time(:millisecond) >= deadline -> raise("HTTP setup marker timed out")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
started = System.monotonic_time(:millisecond)
try do
  await.("setup-go")
  [[workspace, project, dataset, ws_slug, project_slug]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug,w.slug,p.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
  tokens = System.fetch_env!("C108_HTTP_TOKEN_FILE") |> File.read!() |> JSON.decode!()
  for {key, permissions} <- [{"holder", ["read", "write"]}, {"other", ["read", "write"]}, {"reader", ["read"]}] do
    {:ok, _} = Auth.create_token(Map.fetch!(tokens, key), "http-" <> key, dataset, permissions, workspace)
  end
  original = Path.join(output, "synthetic-original.bin")
  payload = "Synthetic actual HTTP checkout permissions on Windows"
  File.write!(original, payload, [:exclusive])
  {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: original, filename: "http-checkout.bin", content_type: "application/octet-stream"}, dataset, workspace_id: workspace, project_id: project)
  {:ok, asset} = Assets.ensure_for_upload(file)
  directory = Path.join([Media.upload_dir(), "_renditions", file.id])
  File.mkdir_p!(directory)
  children = for name <- ["a-first.bin", "z-second.bin"] do
    path = Path.join(directory, name)
    File.write!(path, "Synthetic HTTP cache " <> name, [:exclusive])
    %{name: name, path: path}
  end
  originals = for mod <- [BarkparkWeb.Router, BarkparkWeb.V1.MediaController, BarkparkWeb.FallbackController, Barkpark.Content.Errors, Barkpark.Auth, BarkparkWeb.Plugs.RequireWritePermission, Barkpark.Media.Storage.Actor] do
    {:module, ^mod} = Code.ensure_loaded(mod)
    {^mod, binary, file_path} = :code.get_object_code(mod)
    {:ok, {^mod, md5}} = :beam_lib.md5(binary)
    ^md5 = mod.module_info(:md5)
    %{module: inspect(mod), file: List.to_string(file_path), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
  end
  write.("original-bindings", originals)
  Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
    if id == file.id do
      write.("rm-" <> Integer.to_string(System.unique_integer([:positive, :monotonic])), %{file_id: id, directory: dir, result: inspect(result, limit: :infinity)})
    end
  end)
  write.("setup-ready", %{file: Map.take(file, [:id, :path, :dataset, :workspace_id, :project_id]), asset_id: asset.id, asset_doc_id: asset.doc_id, original: original, media: Media.upload_dir(), directory: directory, children: children, scope: %{workspace_id: workspace, project_id: project, workspace_slug: ws_slug, project_slug: project_slug, dataset: dataset}})
  await.("http-reviewed")
  write.("result", %{status: "http_fixture_completed", elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Synthetic full runtime setup; actual requests made by Node producer. No source repair/adoption."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
