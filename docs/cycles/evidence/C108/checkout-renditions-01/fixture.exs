# Private synthetic full-application caller fixture. No source behavior repair.
alias Barkpark.{Media, Repo}
alias Barkpark.Media.Storage.{Checkout, MediaFile}
alias Barkpark.Plugins.Media.Assets
output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
write = fn name, value -> File.write!(Path.join(output, name <> ".json"), JSON.encode!(value)) end
await = fn name ->
  deadline = System.monotonic_time(:millisecond) + 90_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(Path.join(output, name)) -> true
      System.monotonic_time(:millisecond) >= deadline -> raise("Fixture marker timed out: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
doc_view = fn doc -> Map.take(doc, [:id, :doc_id, :dataset, :rev, :current_revision_id, :released_revision_id, :content, :workspace_id, :project_id]) end
started = System.monotonic_time(:millisecond)
try do
  await.("setup-go")
  [[workspace, project, dataset]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
  original = Path.join(output, "synthetic-original.bin")
  payload = "Synthetic full-runtime Checkout original 525"
  File.write!(original, payload, [:exclusive])
  upload = %Plug.Upload{path: original, filename: "synthetic-checkout.bin", content_type: "application/octet-stream"}
  {:ok, %MediaFile{} = file} = Media.upload(upload, dataset, workspace_id: workspace, project_id: project)
  {:ok, asset} = Assets.ensure_for_upload(file)
  {:ok, checked} = Checkout.checkout(file, "fixture-holder", dataset)
  "fixture-holder" = checked.content["checkedOutBy"]
  true = checked.rev != asset.rev
  ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
  write.("setup", %{file: Map.take(file, [:id, :path, :object_key, :size, :dataset, :workspace_id, :project_id]), original: original, media: Media.upload_dir(), dataset: dataset, asset: doc_view.(asset), checked: doc_view.(checked)})
  await.("release-go")
  Application.put_env(:barkpark, :checkout_release_test_hook, fn old, observed_file, updated ->
    if observed_file.id == file.id do
      true = updated.rev != old.rev
      nil = updated.content["checkedOutBy"]
      write.("after-content", %{old: doc_view.(old), updated: doc_view.(updated), caller: inspect(self())})
      await.("delete-go")
    end
  end)
  Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
    if id == file.id, do: write.("rm-result", %{file_id: id, directory: dir, result: inspect(result, limit: :infinity)})
  end)
  returned = Checkout.undo_checkout(file, "non-holder", dataset, true)
  {:ok, updated} = returned
  nil = updated.content["checkedOutBy"]
  persisted = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file))
  true = persisted.rev == updated.rev
  nil = persisted.content["checkedOutBy"]
  ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
  write.("result", %{status: "actual_checkout_returned_success", returned: doc_view.(updated), persisted: doc_view.(persisted), elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Private observers preserve unconditional rendition :ok. Direct actual admin-flag caller, not HTTP authorization or production repair."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
