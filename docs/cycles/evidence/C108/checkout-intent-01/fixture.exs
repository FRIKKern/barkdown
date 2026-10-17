# PRIVATE full-application candidate fixture. Synthetic data only.
alias Barkpark.{Media, Repo}
alias Barkpark.Media.Storage.{Checkout, MediaFile}
alias Barkpark.Plugins.Media.Assets
alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
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
      System.monotonic_time(:millisecond) >= deadline -> raise("Candidate marker timed out: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
state = fn -> Map.take(Admission.status(Door.server()), [:phase, :generation, :pending, :writers, :dead_writers]) end
doc_view = fn doc -> Map.take(doc, [:id, :doc_id, :dataset, :rev, :current_revision_id, :released_revision_id, :content, :workspace_id, :project_id]) end
worker_view = fn ->
  raw = :sys.get_state(Door.server())
  writer = Map.fetch!(raw.writers, self())
  %{state: state.(), physical: Map.get(writer, :physical_effect?, false), tickets: MapSet.size(writer.tickets), worker: inspect(self())}
end
started = System.monotonic_time(:millisecond)
try do
  await.("setup-go")
  true = Door.enabled?()
  %{phase: :open, pending: 0, writers: 0} = state.()
  [[workspace, project, dataset]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
  cases = for name <- ["success", "refused", "partial"] do
    original = Path.join(output, name <> "-original.bin")
    payload = "Synthetic candidate Checkout " <> name
    File.write!(original, payload, [:exclusive])
    {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: original, filename: name <> ".bin", content_type: "application/octet-stream"}, dataset, workspace_id: workspace, project_id: project)
    {:ok, asset} = Assets.ensure_for_upload(file)
    {:ok, checked} = Checkout.checkout(file, "fixture-holder", dataset)
    "fixture-holder" = checked.content["checkedOutBy"]
    true = checked.rev != asset.rev
    ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
    %{phase: :open, pending: 0, writers: 0} = state.()
    before_row = Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__])
    directory = Path.join([Media.upload_dir(), "_renditions", file.id])
    File.mkdir_p!(directory)
    children = for child <- if(name == "partial", do: ["a-unlocked.bin", "z-locked.bin"], else: ["a-first.bin", "z-second.bin"]) do
      path = Path.join(directory, child)
      File.write!(path, "Synthetic candidate cache " <> name <> " " <> child, [:exclusive])
      %{name: child, path: path}
    end
    write.(name <> "-ready", %{name: name, original: original, media: Media.upload_dir(), directory: directory, file: Map.take(file, [:id, :path, :object_key, :dataset, :workspace_id, :project_id]), asset: doc_view.(asset), checked: doc_view.(checked), children: children, before: state.()})
    await.(name <> "-go")
    Application.put_env(:barkpark, :checkout_intent_test_hook, fn old, observed_file ->
      if observed_file.id == file.id do
        persisted = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file))
        true = persisted.rev == old.rev and persisted.rev == checked.rev
        "fixture-holder" = persisted.content["checkedOutBy"]
        %{physical: true} = worker_view.()
        write.(name <> "-before-content", %{persisted: doc_view.(persisted), admission: worker_view.()})
      end
    end)
    Application.put_env(:barkpark, :checkout_release_test_hook, fn old, observed_file, updated ->
      if observed_file.id == file.id do
        write.(name <> "-after-content", %{old: doc_view.(old), updated: doc_view.(updated), admission: worker_view.()})
        await.(name <> "-content-go")
      end
    end)
    Application.put_env(:barkpark, :rendition_delete_before_test_hook, fn id, dir, key ->
      if id == file.id do
        [[backend]] = Ecto.Adapters.SQL.query!(Repo, "SELECT pg_backend_pid()", []).rows
        write.(name <> "-before-effect", %{file_id: id, directory: dir, key: key, pg_backend: backend, admission: worker_view.()})
        await.(name <> "-effect-go")
      end
    end)
    Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
      if id == file.id, do: write.(name <> "-rm", %{file_id: id, directory: dir, result: inspect(result, limit: :infinity)})
    end)
    parent = self()
    {worker, monitor} = spawn_monitor(fn ->
      result = Checkout.undo_checkout(file, "non-holder", dataset, true)
      send(parent, {:returned, self(), result})
    end)
    returned = receive do
      {:returned, ^worker, result} -> result
      {:DOWN, ^monitor, :process, ^worker, reason} -> raise("Candidate worker died before return: #{inspect(reason)}")
    after 90_000 -> raise("Candidate return timed out") end
    receive do {:DOWN, ^monitor, :process, ^worker, :normal} -> :ok after 5_000 -> raise("Candidate worker did not naturally exit") end
    false = Process.alive?(worker)
    deadline = System.monotonic_time(:millisecond) + 5_000
    Stream.repeatedly(fn ->
      cond do
        state.().writers == 0 -> true
        System.monotonic_time(:millisecond) >= deadline -> raise("Candidate owner remains live")
        true -> Process.sleep(10); false
      end
    end) |> Enum.find(& &1)
    persisted = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file))
    result = case {name, returned} do
      {"success", {:ok, updated}} ->
        nil = persisted.content["checkedOutBy"]
        true = updated.rev == persisted.rev and updated.rev != checked.rev
        %{phase: :held, pending: 0, writers: 0} = state.()
        %{status: "ok", document: doc_view.(updated)}
      {"refused", {:error, {:write_admission, :admission_closed}}} ->
        true = persisted.rev == checked.rev
        "fixture-holder" = persisted.content["checkedOutBy"]
        %{phase: :held, pending: 0, writers: 0} = state.()
        %{status: "refused", reason: "write_admission_admission_closed"}
      {"partial", {:error, :storage_unavailable}} ->
        nil = persisted.content["checkedOutBy"]
        true = persisted.rev != checked.rev
        %{phase: :recovery_required, pending: 1, writers: 0} = state.()
        %{status: "storage_error", reason: "storage_unavailable"}
      unexpected -> raise("Unexpected candidate return: #{inspect(unexpected)}")
    end
    true = before_row == (Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__]))
    ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
    residuals = case File.ls(directory) do {:ok, names} -> Enum.sort(names); {:error, :enoent} -> []; error -> raise("Unknown cache postcondition: #{inspect(error)}") end
    report = %{name: name, returned: result, persisted: doc_view.(persisted), state: state.(), worker: inspect(worker), worker_naturally_exited: true, media_row_unchanged: true, residuals: residuals}
    write.(name <> "-result", report)
    await.(name <> "-reviewed")
    report
  end
  write.("result", %{status: "intent_checkout_observed", cases: cases, elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Private direct admin-boolean caller only. No HTTP privilege/adoption/atomicity. New early intent candidate; owner-loss/coordinator restart/controlled rejection/ordinary contracts NOT proved. No recovery/cleanup permission."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
