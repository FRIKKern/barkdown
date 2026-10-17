# PRIVATE new owner-loss observation; full application required, no recovery.
alias Barkpark.{Media, Repo}
alias Barkpark.Media.Storage.{Checkout, MediaFile}
alias Barkpark.Plugins.Media.Assets
alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
write = fn name, value ->
  file = Path.join(output, name <> ".json")
  File.write!(file <> ".writing", JSON.encode!(value), [:exclusive])
  File.rename!(file <> ".writing", file)
end
await = fn name ->
  deadline = System.monotonic_time(:millisecond) + 90_000
  Stream.repeatedly(fn -> cond do
    File.exists?(Path.join(output, name)) -> true
    System.monotonic_time(:millisecond) >= deadline -> raise("Owner-loss marker timeout: #{name}")
    true -> Process.sleep(20); false
  end end) |> Enum.find(& &1)
end
state = fn -> Map.take(Admission.status(Door.server()), [:phase, :generation, :pending, :writers, :dead_writers]) end
view = fn doc -> Map.take(doc, [:id, :doc_id, :dataset, :rev, :current_revision_id, :released_revision_id, :content, :workspace_id, :project_id]) end
started = System.monotonic_time(:millisecond)
try do
  await.("setup-go")
  true = Door.enabled?()
  %{phase: :open, pending: 0, writers: 0} = state.()
  [[workspace, project, dataset]] = Ecto.Adapters.SQL.query!(Repo, "SELECT w.id::text,p.id::text,d.slug FROM workspaces w JOIN projects p ON p.workspace_id=w.id JOIN datasets d ON d.project_id=p.id WHERE w.is_default AND p.slug='default' ORDER BY d.slug LIMIT 1", []).rows
  original = Path.join(output, "owner-loss-original.bin")
  payload = "Synthetic Checkout owner loss before physical admission"
  File.write!(original, payload, [:exclusive])
  {:ok, %MediaFile{} = file} = Media.upload(%Plug.Upload{path: original, filename: "owner-loss.bin", content_type: "application/octet-stream"}, dataset, workspace_id: workspace, project_id: project)
  {:ok, asset} = Assets.ensure_for_upload(file)
  {:ok, checked} = Checkout.checkout(file, "fixture-holder", dataset)
  "fixture-holder" = checked.content["checkedOutBy"]
  true = checked.rev != asset.rev
  ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
  before_row = Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__])
  directory = Path.join([Media.upload_dir(), "_renditions", file.id])
  File.mkdir_p!(directory)
  children = for name <- ["a-first.bin", "z-second.bin"] do
    path = Path.join(directory, name)
    File.write!(path, "Synthetic untouched owner-loss cache " <> name, [:exclusive])
    %{name: name, path: path}
  end
  write.("setup", %{original: original, media: Media.upload_dir(), directory: directory, file: Map.take(file, [:id, :path, :object_key, :dataset, :workspace_id, :project_id]), checked: view.(checked), children: children})
  await.("release-go")
  Application.put_env(:barkpark, :checkout_release_test_hook, fn old, observed, updated ->
    if observed.id == file.id do
      raw = :sys.get_state(Door.server())
      writer = Map.fetch!(raw.writers, self())
      write.("after-content", %{old: view.(old), updated: view.(updated), worker: inspect(self()), state: state.(), physical: Map.get(writer, :physical_effect?, false), tickets: MapSet.size(writer.tickets)})
      await.("never-continue")
    end
  end)
  Application.put_env(:barkpark, :rendition_delete_before_test_hook, fn id, dir, key ->
    if id == file.id, do: write.("unexpected-before-effect", %{file_id: id, directory: dir, key: key})
  end)
  Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, dir, result ->
    if id == file.id, do: write.("unexpected-rm", %{file_id: id, directory: dir, result: inspect(result)})
  end)
  parent = self()
  {worker, monitor} = spawn_monitor(fn -> send(parent, {:returned, self(), Checkout.undo_checkout(file, "non-holder", dataset, true)}) end)
  write.("worker", %{worker: inspect(worker),owned_by: inspect(self())})
  await.("kill-go")
  observed = Path.join(output, "after-content.json") |> File.read!() |> JSON.decode!()
  true = observed["worker"] == inspect(worker)
  true = observed["physical"]
  true = Process.alive?(worker)
  Process.exit(worker, :kill)
  reason = receive do {:DOWN, ^monitor, :process, ^worker, reason} -> reason after 5_000 -> raise("Owned worker DOWN timeout") end
  :killed = reason
  false = Process.alive?(worker)
  returned = receive do {:returned, ^worker, _} -> true after 0 -> false end
  false = returned
  deadline = System.monotonic_time(:millisecond) + 5_000
  Stream.repeatedly(fn ->
    current = state.()
    cond do
      current.writers == 0 and (current.pending == 0 or current.phase == :recovery_required) -> true
      System.monotonic_time(:millisecond) >= deadline -> raise("Coordinator owner-loss settlement timeout: #{inspect(current)}")
      true -> Process.sleep(10); false
    end
  end) |> Enum.find(& &1)
  %{phase: :recovery_required, pending: 1, writers: 0} = after_down = state.()
  old_coordinator = GenServer.whereis(Door.server())
  true = is_pid(old_coordinator) and Process.alive?(old_coordinator)
  {_id, ^old_coordinator, :worker, _modules} = Enum.find(Supervisor.which_children(Barkpark.Supervisor), fn {id, _, _, _} -> id == Admission end)
  before_restart = Admission.status(old_coordinator)
  config = Door.config()
  journal = Keyword.fetch!(config, :journal)
  instance = Keyword.fetch!(config, :instance_id)
  true = File.regular?(journal)
  coordinator_monitor = Process.monitor(old_coordinator)
  :ok = Supervisor.terminate_child(Barkpark.Supervisor, Admission)
  old_reason = receive do {:DOWN, ^coordinator_monitor, :process, ^old_coordinator, reason} -> reason after 5_000 -> raise("Owned coordinator DOWN timeout") end
  false = Process.alive?(old_coordinator)
  :ok = Supervisor.delete_child(Barkpark.Supervisor, Admission)
  {:ok, new_coordinator} = Supervisor.start_child(Barkpark.Supervisor, {Admission, journal: journal, instance_id: instance, initialize: false})
  true = new_coordinator != old_coordinator and Process.alive?(new_coordinator)
  true = GenServer.whereis(Door.server()) == new_coordinator
  after_restart = Admission.status(new_coordinator)
  %{phase: :recovery_required, pending: 1, writers: 0, dead_writers: 0} = after_restart
  true = after_restart.boot != before_restart.boot
  true = after_restart.generation > before_restart.generation
  restart = %{old_pid: inspect(old_coordinator), new_pid: inspect(new_coordinator), old_reason: inspect(old_reason), journal: journal, before: Map.take(before_restart, [:phase, :generation, :pending, :writers, :dead_writers, :boot]), after: Map.take(after_restart, [:phase, :generation, :pending, :writers, :dead_writers, :boot]), initialize: false}
  write.("coordinator-restart", restart)
  persisted = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file))
  nil = persisted.content["checkedOutBy"]
  true = persisted.rev != checked.rev and persisted.rev == observed["updated"]["rev"]
  true = before_row == (Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__]))
  ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
  false = File.exists?(Path.join(output, "unexpected-before-effect.json"))
  false = File.exists?(Path.join(output, "unexpected-rm.json"))
  write.("result", %{status: "intent_owner_loss_observed", worker: inspect(worker), reason: inspect(reason), returned: returned, persisted: view.(persisted), after_down: after_down, after_restart: restart, residuals: File.ls!(directory) |> Enum.sort(), media_row_unchanged: true, elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Owned worker killed only after actual Content commit; no normal release acknowledgement or physical deletion. Early intent retains recovery/pending1 across owned coordinator clean restart; no backend/power-loss claim. No source adoption, recovery/cleanup or atomicity claim."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
