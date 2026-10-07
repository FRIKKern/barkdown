# Disposable caller exercises the real public deferred-delete protocol.
# It is not the complete Tenancy.delete_workspace function.
defmodule C097.DeleteCommit do
  alias Barkpark.Repo
  alias Barkpark.Media
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
  alias Barkpark.ManagedRuntime.WriteAdmission.Door

  def await(fun, label, deadline) do
    cond do
      fun.() -> :ok
      System.monotonic_time(:millisecond) >= deadline -> raise "delete probe timeout: #{label}"
      true -> Process.sleep(20); await(fun, label, deadline)
    end
  end
  def write(root, name, value), do: File.write!(Path.join(root, name), Jason.encode!(value))
  def read(root, name), do: Jason.decode!(File.read!(Path.join(root, name)))
  def hash(bytes), do: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)
  def control(id) do
    {:ok, file} = Media.get_file(id)
    {:ok, path} = Media.Blobstore.ensure_local(file)
    bytes = File.read!(path)
    %{id: file.id, path: file.path, size: file.size, stored_bytes: byte_size(bytes), sha256: hash(bytes)}
  end
  def blob(relative) do
    bytes = File.read!(Path.join(Media.upload_dir(), relative))
    %{rows: [[rows]]} = Repo.query!("SELECT count(*) FROM media_files WHERE path = $1", [relative])
    %{path: relative, row_count: rows, stored_bytes: byte_size(bytes), sha256: hash(bytes)}
  end
  def upload(root, name, bytes) do
    path = Path.join(root, name); File.write!(path, bytes)
    Media.upload(%Plug.Upload{path: path, filename: name, content_type: "application/octet-stream"}, "production")
  end
  def delete_in_outer(file, after_commit) do
    Door.admit(fn ->
      Media.clear_deferred_media_effects()
      {:ok, _} = Repo.transaction(fn ->
        {:ok, deleted} = Media.delete_file(file.id, where_used: :cascade)
        deleted
      end)
      false = Repo.in_transaction?()
      1 = length(Process.get(:barkpark_deferred_media_effects, []))
      after_commit.()
      :ok = Media.flush_deferred_media_effects()
      [] = Process.get(:barkpark_deferred_media_effects, [])
      :ok
    end)
  end
  def run(root) do
    if File.exists?(Path.join(root, "probe-killed.json")) do
      previous = read(root, "probe-killed.json")
      write(root, "probe-restarted.json", %{orphan: blob(previous["path"]), control: control(previous["control"])})
    else
      deadline = System.monotonic_time(:millisecond) + 120_000
      await(fn -> File.exists?(Path.join(root, "probe-start")) end, "start", deadline)
      {:ok, acknowledged} = upload(root, "c097-control.bin", :binary.copy("Acknowledged control bytes\n", 263))
      baseline = control(acknowledged.id)
      write(root, "probe-control.json", baseline)
      {:ok, ordinary} = upload(root, "c097-delete-success.bin", "ordinary committed deletion")
      :ok = delete_in_outer(ordinary, fn -> :ok end)
      {:error, :not_found} = Media.get_file(ordinary.id)
      false = File.exists?(Path.join(Media.upload_dir(), ordinary.path))
      write(root, "probe-flush.json", %{row_absent: true, blob_absent: true, queue_empty: true})
      {:ok, target} = upload(root, "c097-delete-target.bin", :binary.copy("Unacknowledged orphan bytes\n", 257))
      1 = blob(target.path).row_count
      {writer, monitor} = spawn_monitor(fn ->
        delete_in_outer(target, fn ->
          snapshot = blob(target.path)
          0 = snapshot.row_count
          write(root, "probe-barrier.json", %{orphan: snapshot, control: baseline, queued_media_effects: 1, outside_transaction: true})
          receive do
            :continue -> :ok
          after
            120_000 -> raise "post-commit barrier deadline"
          end
        end)
      end)
      try do
        await(fn -> File.exists?(Path.join(root, "probe-kill")) end, "kill authorization", deadline)
        %{phase: :closing, writers: 1} = Admission.status(Door.server())
        # An independent database read confirms the delete committed, not just
        # an uncommitted view from the writer's own transaction connection.
        0 = blob(target.path).row_count
        Process.exit(writer, :kill)
        receive do
          {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok
        after
          5_000 -> raise "owned writer did not die"
        end
        write(root, "probe-killed.json", %{control: acknowledged.id, path: target.path, reason: "killed"})
        write(root, "probe-after-kill.json", %{orphan: blob(target.path), control: control(acknowledged.id)})
      after
        if Process.alive?(writer), do: Process.exit(writer, :kill)
      end
    end
  end
end
spawn(fn ->
  root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
  try do
    C097.DeleteCommit.run(root)
  rescue
    error -> File.write!(Path.join(root, "probe-error.txt"), Exception.format(:error, error, __STACKTRACE__))
  end
end)
