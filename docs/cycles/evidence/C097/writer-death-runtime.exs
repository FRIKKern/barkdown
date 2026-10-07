# Appended only to a private test boot script; never installed in Barkpark.
defmodule C097.RuntimeWriterDeath do
  def await_file(file, deadline) do
    cond do
      File.exists?(file) -> :ok
      System.monotonic_time(:millisecond) >= deadline -> raise "C097 control deadline: #{Path.basename(file)}"
      true -> Process.sleep(20); await_file(file, deadline)
    end
  end

  def run(root) do
    deadline = System.monotonic_time(:millisecond) + 120_000
    await_file(Path.join(root, "probe-start"), deadline)
    parent = self()
    {writer, monitor} = spawn_monitor(fn ->
      Process.put(:barkpark_mutations_between_barrier, fn ->
        send(parent, {:barrier, self(), Barkpark.Repo.in_transaction?()})
        receive do: (:never_sent -> :ok)
      end)
      mutations = for i <- 0..19, do: %{"createOrReplace" => %{"_id" => "c097-killed-#{i}", "_type" => "tag", "title" => "Killed transaction #{i}"}}
      result = Barkpark.Content.Mutations.apply_mutations(mutations, "production")
      send(parent, {:unexpected_settlement, result})
    end)
    try do
      receive do
        {:barrier, ^writer, true} ->
          File.write!(Path.join(root, "probe-barrier.json"), Jason.encode!(%{inside_transaction: true, after_successful_mutations: 1, batch: 20, writer: inspect(writer)}))
        {:unexpected_settlement, result} -> raise "Writer settled before barrier: #{inspect(result)}"
      after
        30_000 -> raise "No real transaction barrier reached"
      end
      await_file(Path.join(root, "probe-kill"), deadline)
      gate = Barkpark.ManagedRuntime.WriteAdmission.Door.server()
      %{phase: :closing, writers: 1} = Barkpark.ManagedRuntime.WriteAdmission.status(gate)
      Process.exit(writer, :kill)
      receive do
        {:DOWN, ^monitor, :process, ^writer, :killed} ->
          File.write!(Path.join(root, "probe-killed.json"), Jason.encode!(%{writer: inspect(writer), reason: "killed"}))
      after
        5_000 -> raise "Writer did not die"
      end
    after
      if Process.alive?(writer), do: Process.exit(writer, :kill)
    end
  end
end

probe_root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
# Restart uses the same test boot but must never spawn another writer.
unless File.exists?(Path.join(probe_root, "probe-killed.json")) do
  spawn(fn ->
    try do
      C097.RuntimeWriterDeath.run(probe_root)
    rescue
      error -> File.write!(Path.join(probe_root, "probe-error.txt"), Exception.format(:error, error, __STACKTRACE__))
    end
  end)
end
