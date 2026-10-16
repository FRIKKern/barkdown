# PRIVATE new owner-loss observation; full application required, no recovery.
alias Barkpark.{Content, Media, Repo}
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
  opts = MediaFile.scope_opts(file)
  {:ok, schema} = Content.upsert_schema(%{"name" => "mediaAsset", "title" => "Synthetic controlled checkout rejection", "fields" => [%{"name" => "title", "type" => "string"}, %{"name" => "checkedOutBy", "type" => "string", "validation" => %{"required" => true}}]}, dataset, opts)
  {:ok, read_schema} = Content.get_schema("mediaAsset", dataset, opts)
  true = read_schema.id == schema.id and read_schema.workspace_id == file.workspace_id
  Application.put_env(:barkpark, Barkpark.Content.Validation, enforce_datasets: [dataset])
  true = Barkpark.Content.Validation.enforce?(dataset)
  {:ok, _} = Barkpark.Content.Writer.validate_document("mediaAsset", checked.title, checked.content, dataset, opts)
  {:error, validation_errors} = Barkpark.Content.Writer.validate_document("mediaAsset", checked.title, Map.put(checked.content, "checkedOutBy", nil), dataset, opts)
  true = Map.has_key?(validation_errors, "checkedOutBy")
  gate = Door.server()
  gate_config = Door.config()
  view_gate = fn -> Map.take(Admission.status(gate), [:phase, :generation, :pending, :writers, :dead_writers]) end
  before_doc = Repo.get!(Barkpark.Content.Document, checked.id) |> Map.from_struct() |> Map.drop([:__meta__])
  write.("setup", %{original: original, media: Media.upload_dir(), directory: directory, file: Map.take(file, [:id, :path, :object_key, :dataset, :workspace_id, :project_id]), checked: view.(checked), children: children, schema: %{id: schema.id, workspace_id: schema.workspace_id, project_id: schema.project_id, fields: schema.fields}, validation_errors: validation_errors})
  await.("release-go")
  cases = for mode <- ["managed", "ordinary"] do
    Application.put_env(:barkpark, :write_admission, if(mode == "managed", do: gate_config, else: Keyword.put(gate_config, :enabled, false)))
    Application.put_env(:barkpark, :checkout_intent_test_hook, fn _old, observed ->
      if observed.id == file.id do
        raw = :sys.get_state(gate)
        writer = Map.fetch!(raw.writers, self())
        true = Map.get(writer, :physical_effect?, false)
        write.(mode <> "-intent", %{state: view_gate.(), physical: true, worker: inspect(self())})
      end
    end)
    Application.put_env(:barkpark, :checkout_release_test_hook, fn _old, observed, _updated -> if observed.id == file.id, do: write.("unexpected-after-content", %{mode: mode}) end)
    Application.put_env(:barkpark, :rendition_delete_before_test_hook, fn id, _dir, _key -> if id == file.id, do: write.("unexpected-before-effect", %{mode: mode}) end)
    Application.put_env(:barkpark, :rendition_delete_result_test_hook, fn id, _dir, result -> if id == file.id, do: write.("unexpected-rm", %{mode: mode, result: inspect(result)}) end)
    parent = self()
    {worker, monitor} = spawn_monitor(fn -> send(parent, {:returned, self(), Checkout.undo_checkout(file, "non-holder", dataset, true)}) end)
    returned = receive do {:returned, ^worker, value} -> value; {:DOWN, ^monitor, :process, ^worker, reason} -> raise("Controlled worker died before return: #{inspect(reason)}") after 15_000 -> raise("Controlled return timed out") end
    receive do {:DOWN, ^monitor, :process, ^worker, :normal} -> :ok after 5_000 -> raise("Controlled worker did not naturally exit") end
    false = Process.alive?(worker)
    {:error, {:schema_validation_failed, errors, findings}} = returned
    true = Map.has_key?(errors, "checkedOutBy")
    true = Enum.any?(findings, fn finding -> finding.path == "/checkedOutBy" and finding.code == :required end)
    true = before_doc == (Repo.get!(Barkpark.Content.Document, checked.id) |> Map.from_struct() |> Map.drop([:__meta__]))
    true = before_row == (Repo.get!(MediaFile, file.id) |> Map.from_struct() |> Map.drop([:__meta__]))
    persisted = Assets.find_by_media_file_id(file.id, dataset, opts)
    true = persisted.rev == checked.rev
    "fixture-holder" = persisted.content["checkedOutBy"]
    %{phase: :open, pending: 0, writers: 0} = current = view_gate.()
    false = File.exists?(Path.join(output, "unexpected-after-content.json"))
    false = File.exists?(Path.join(output, "unexpected-before-effect.json"))
    false = File.exists?(Path.join(output, "unexpected-rm.json"))
    ^payload = File.read!(Path.join(Media.upload_dir(), file.path))
    observed = %{mode: mode, returned: "schema_validation_failed", errors: errors, findings: findings, raw_return: inspect(returned, limit: :infinity), worker: inspect(worker), naturally_exited: true, state: current, persisted: view.(persisted), media_row_unchanged: true, full_document_unchanged: true}
    write.(mode <> "-result", observed)
    observed
  end
  Application.put_env(:barkpark, :write_admission, gate_config)
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
  %{phase: :open, pending: 0, writers: 0, dead_writers: 0} = after_restart
  true = after_restart.boot != before_restart.boot
  true = after_restart.generation > before_restart.generation
  restart = %{old_pid: inspect(old_coordinator), new_pid: inspect(new_coordinator), old_reason: inspect(old_reason), journal: journal, before: Map.take(before_restart, [:phase, :generation, :pending, :writers, :dead_writers, :boot]), after: Map.take(after_restart, [:phase, :generation, :pending, :writers, :dead_writers, :boot]), initialize: false}
  write.("coordinator-restart", restart)
  write.("result", %{status: "schema_rejection_observed", cases: cases, after_restart: restart, schema_id: schema.id, elapsedMs: System.monotonic_time(:millisecond) - started, limits: "Actual controlled schema rejection in owned synthetic full application only; unchanged document/cache and open0 settlement, not full ordinary caller matrix or accepted blanket error policy. No source adoption, recovery/cleanup or stage acceptance."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
