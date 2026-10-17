# Prepared private candidate caller fixture; not yet compiled or executed.
# Full application required; same private early-intent candidate, no production source repair/adoption.
alias Barkpark.{Media, Repo}
alias Barkpark.Media.Storage.{Checkout, MediaFile}
alias Barkpark.Plugins.Media.Assets
alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
mode = System.fetch_env!("C108_CHECKOUT_MODE")
unless mode in ["ordinary", "managed", "holder_locked"], do: raise("Unknown mode")
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
      System.monotonic_time(:millisecond) >= deadline -> raise("Contract marker timed out: #{name}")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
view = fn doc -> Map.take(doc, [:id, :doc_id, :dataset, :rev, :current_revision_id, :released_revision_id, :content, :workspace_id, :project_id]) end
state = fn ->
  if mode == "ordinary" do
    false = Door.enabled?()
    nil = Door.server()
    %{enabled: false, configured_server: nil}
  else
    true = Door.enabled?()
    status = Admission.status(Door.server())
    Map.take(status, [:phase, :generation, :pending, :writers, :dead_writers])
  end
end
started = System.monotonic_time(:millisecond)
try do
  await.("setup-go")
  state.()
  [[workspace, project, dataset]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
  base_cases = for role <- ["admin", "holder", "forbidden"], cache <- ["absent", "unlocked", "locked"], do: {role, cache}
  cases = case mode do
    "ordinary" -> base_cases
    "managed" -> Enum.reject(base_cases, fn {role, cache} -> cache == "locked" and role in ["admin", "holder"] end) ++ [{"admin", "locked"}]
    "holder_locked" -> [{"holder", "locked"}]
  end
  checks = for {{role, cache}, index} <- Enum.with_index(cases, 1) do
    name = "case-" <> Integer.to_string(index)
    original = Path.join(output, name <> "-original.bin")
    payload = "Synthetic ordinary Checkout " <> mode <> " " <> name
    File.write!(original, payload, [:exclusive])
    {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: original, filename: name <> ".bin", content_type: "application/octet-stream"}, dataset, workspace_id: workspace, project_id: project)
    {:ok, asset} = Assets.ensure_for_upload(file)
    {:ok, checked} = Checkout.checkout(file, "fixture-holder", dataset)
    "fixture-holder" = checked.content["checkedOutBy"]
    true = checked.rev != asset.rev
    ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
    row_before = Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__])
    directory = Path.join([Media.upload_dir(), "_renditions", file.id])
    children = if cache == "absent" do
      false = File.exists?(directory)
      []
    else
      File.mkdir_p!(directory)
      names = if cache == "locked", do: ["a-unlocked.bin", "z-locked.bin"], else: ["a-first.bin", "z-second.bin"]
      for child <- names do
        path = Path.join(directory, child)
        File.write!(path, "Synthetic cache " <> mode <> " " <> name <> " " <> child, [:exclusive])
        %{path: path, name: child}
      end
    end
    state_before = state.()
    if mode != "ordinary", do: (%{phase: :open, pending: 0, writers: 0} = state_before)
    write.(name <> "-ready", %{name: name, mode: mode, role: role, cache: cache, original: original, media: Media.upload_dir(), directory: directory, children: children, file: Map.take(file, [:id, :path, :dataset, :workspace_id, :project_id]), checked: view.(checked), before: state_before})
    await.(name <> "-go")
    parent = self()
    {worker, monitor} = spawn_monitor(fn ->
      Process.delete(:observed_rm_result)
      Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
        if id == file.id, do: Process.put(:observed_rm_result, %{file_id: id, directory: dir, result: inspect(result, limit: :infinity)})
      end)
      actor = if role == "holder", do: "fixture-holder", else: "non-holder"
      value = Checkout.undo_checkout(file, actor, dataset, role == "admin")
      send(parent, {:returned, self(), value, Process.get(:observed_rm_result)})
    end)
    {returned, observed_rm} = receive do
      {:returned, ^worker, value, rm} -> {value, rm}
      {:DOWN, ^monitor, :process, ^worker, reason} -> raise("Caller died before return: #{inspect(reason)}")
    after 30_000 -> raise("Caller return timeout") end
    receive do {:DOWN, ^monitor, :process, ^worker, :normal} -> :ok after 5_000 -> raise("Caller did not naturally exit") end
    false = Process.alive?(worker)
    persisted = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file))
    if role == "forbidden" do
      {:error, :forbidden} = returned
      nil = observed_rm
      true = persisted.rev == checked.rev
      "fixture-holder" = persisted.content["checkedOutBy"]
    else
      if mode != "ordinary" and cache == "locked" do
        {:error, :storage_unavailable} = returned
        nil = persisted.content["checkedOutBy"]
        true = persisted.rev != checked.rev
        true = is_map(observed_rm)
      else
      {:ok, updated} = returned
      nil = updated.content["checkedOutBy"]
      nil = persisted.content["checkedOutBy"]
      true = persisted.rev == updated.rev
      true = persisted.rev != checked.rev
      true = is_map(observed_rm)
      end
    end
    true = row_before == (Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__]))
    ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
    if mode != "ordinary" do
      deadline = System.monotonic_time(:millisecond) + 5_000
      expected_phase = if(cache == "locked" and role != "forbidden", do: :recovery_required, else: :open)
      Stream.repeatedly(fn ->
        current = state.()
        cond do
          current.writers == 0 and current.phase == expected_phase -> true
          System.monotonic_time(:millisecond) >= deadline -> raise("Caller settlement timeout: #{inspect(current)}")
          true -> Process.sleep(10); false
        end
      end) |> Enum.find(& &1)
    end
    after_state = state.()
    residuals = case File.ls(directory) do {:ok, names} -> Enum.sort(names); {:error, :enoent} -> []; error -> raise("Cache listing uncertain: #{inspect(error)}") end
    returned_view = case returned do {:ok, doc} -> %{status: "ok", document: view.(doc)}; {:error, reason} -> %{status: "error", reason: inspect(reason)} end
    result = %{name: name, mode: mode, role: role, cache: cache, returned: returned_view, persisted: view.(persisted), rm: observed_rm, residuals: residuals, after: after_state, row_unchanged: true, worker: inspect(worker), worker_naturally_exited: true}
    write.(name <> "-result", result)
    await.(name <> "-reviewed")
    result
  end
  write.("result", %{status: "candidate_checkout_contracts_observed", mode: mode, checks: checks, elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Private candidate direct admin-boolean caller; ordinary contracts versus honest managed locked errors. No HTTP privilege/full atomicity/policy acceptance/source adoption."})
rescue
  e -> write.("result", %{status: "failed", mode: mode, error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
