# Private boot-only test plugin. Real Media.upload, Repo and Local Blobstore.
defmodule C097.MediaDeath do
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission

  def after_media_upload(%{media_file: file}) do
    if file.original_name == "c097-uncertain.bin" do
      root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
      snapshot = read(file.id)
      false = Barkpark.Repo.in_transaction?()
      File.write!(Path.join(root, "probe-barrier.json"), Jason.encode!(snapshot))
      send(Process.get(:c097_controller), {:barrier, self()})
      receive do: (:never_sent -> :ok)
    end
    :ok
  end

  def read(id) do
    {:ok, file} = Barkpark.Media.get_file(id, dataset: "production")
    {:ok, path} = Barkpark.Media.Blobstore.ensure_local(file)
    bytes = File.read!(path)
    %{id: file.id, path: file.path, original_name: file.original_name,
      size: file.size, stored_bytes: byte_size(bytes),
      sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)}
  end

  def await_file(file, deadline) do
    cond do
      File.exists?(file) -> :ok
      System.monotonic_time(:millisecond) >= deadline -> raise "media probe timed out: #{Path.basename(file)}"
      true -> Process.sleep(20); await_file(file, deadline)
    end
  end

  def upload(root, name, bytes) do
    path = Path.join(root, name)
    File.write!(path, bytes)
    Barkpark.Media.upload(%Plug.Upload{path: path, filename: name, content_type: "application/octet-stream"}, "production")
  end

  def run(root) do
    killed = Path.join(root, "probe-killed.json")
    if File.exists?(killed) do
      info = Jason.decode!(File.read!(killed))
      snapshot = %{uncertain: read(info["uncertain"]), control: read(info["control"])}
      File.write!(Path.join(root, "probe-restarted.json"), Jason.encode!(snapshot))
    else
      deadline = System.monotonic_time(:millisecond) + 120_000
      await_file(Path.join(root, "probe-start"), deadline)
      bytes = :binary.copy("C097 disposable original bytes\n", 257)
      {:ok, control} = upload(root, "c097-control.bin", bytes)
      control_snapshot = read(control.id)
      File.write!(Path.join(root, "probe-control.json"), Jason.encode!(control_snapshot))
      :ok = Barkpark.Plugins.Registry.register(__MODULE__, %{"plugin_name" => "zz-c097-media-probe"})
      names = Barkpark.Plugins.Registry.ResolverChain.load_ordered_plugins() |> Enum.map(& &1.name)
      Application.put_env(:barkpark, :plugins, Enum.uniq(names ++ ["zz-c097-media-probe"]))
      true = Enum.any?(Barkpark.Plugins.Registry.ResolverChain.load_ordered_plugins(), &(&1.module == __MODULE__))
      parent = self()
      {writer, monitor} = spawn_monitor(fn ->
        Process.put(:c097_controller, parent)
        send(parent, {:unexpected_result, upload(root, "c097-uncertain.bin", bytes)})
      end)
      try do
        receive do
          {:barrier, ^writer} -> :ok
          {:unexpected_result, result} -> raise "upload bypassed barrier: #{inspect(result)}"
        after
          30_000 -> raise "real upload callback did not reach barrier"
        end
        await_file(Path.join(root, "probe-kill"), deadline)
        %{phase: :closing, writers: 1} = Admission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
        Process.exit(writer, :kill)
        receive do
          {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok
        after
          5_000 -> raise "owned upload process did not die"
        end
        uncertain = Jason.decode!(File.read!(Path.join(root, "probe-barrier.json")))
        File.write!(killed, Jason.encode!(%{uncertain: uncertain["id"], control: control.id, reason: "killed"}))
        File.write!(Path.join(root, "probe-after-kill.json"), Jason.encode!(%{uncertain: read(uncertain["id"]), control: read(control.id)}))
      after
        if Process.alive?(writer), do: Process.exit(writer, :kill)
      end
    end
  end
end

spawn(fn ->
  root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
  try do
    C097.MediaDeath.run(root)
  rescue
    error -> File.write!(Path.join(root, "probe-error.txt"), Exception.format(:error, error, __STACKTRACE__))
  end
end)
