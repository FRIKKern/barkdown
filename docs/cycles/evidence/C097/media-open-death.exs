# Private database instrumentation only: no replaced Media/Blobstore code.
defmodule C097.OpenDeath do
  alias Barkpark.Repo
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
  @lock 970071

  def await(fun, label, deadline) do
    cond do
      fun.() -> :ok
      System.monotonic_time(:millisecond) >= deadline -> raise "pre-row probe timeout: #{label}"
      true -> Process.sleep(20); await(fun, label, deadline)
    end
  end

  def write(root, name, value), do: File.write!(Path.join(root, name), Jason.encode!(value))
  def read(root, name), do: Jason.decode!(File.read!(Path.join(root, name)))
  def hash(bytes), do: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)

  def control(id) do
    {:ok, file} = Barkpark.Media.get_file(id)
    {:ok, path} = Barkpark.Media.Blobstore.ensure_local(file)
    bytes = File.read!(path)
    %{id: file.id, path: file.path, size: file.size, stored_bytes: byte_size(bytes), sha256: hash(bytes)}
  end

  def blob do
    root = Barkpark.Media.upload_dir()
    [path] = Path.wildcard(Path.join(root, "**/c097-pre-row-*.bin"))
    relative = Path.relative_to(path, root)
    bytes = File.read!(path)
    %{rows: [[rows]]} = Repo.query!("SELECT count(*) FROM media_files WHERE path = $1", [relative])
    %{path: relative, row_count: rows, stored_bytes: byte_size(bytes), sha256: hash(bytes)}
  end

  def waiting? do
    %{rows: [[count]]} = Repo.query!("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted", [@lock])
    count == 1
  end

  def upload(root, name, bytes) do
    path = Path.join(root, name)
    File.write!(path, bytes)
    Barkpark.Media.upload(%Plug.Upload{path: path, filename: name, content_type: "application/octet-stream"}, "production")
  end

  def run(root) do
    if File.exists?(Path.join(root, "probe-killed.json")) do
      previous = read(root, "probe-killed.json")
      write(root, "probe-restarted.json", %{orphan: blob(), control: control(previous["control"])})
    else
      deadline = System.monotonic_time(:millisecond) + 120_000
      await(fn -> File.exists?(Path.join(root, "probe-start")) end, "start", deadline)
      {:ok, acknowledged} = upload(root, "c097-control.bin", :binary.copy("Acknowledged control bytes\n", 263))
      baseline = control(acknowledged.id)
      write(root, "probe-control.json", baseline)
      Repo.query!("""
      CREATE FUNCTION c097_pause_media_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.original_name = 'c097-pre-row.bin' THEN
          PERFORM pg_advisory_xact_lock(970071);
        END IF;
        RETURN NEW;
      END $$
      """)
      Repo.query!("CREATE TRIGGER c097_pre_row BEFORE INSERT ON media_files FOR EACH ROW EXECUTE FUNCTION c097_pause_media_insert()")
      parent = self()
      {locker, lock_monitor} = spawn_monitor(fn ->
        Repo.checkout(fn ->
          Repo.query!("SELECT pg_advisory_lock($1)", [@lock])
          send(parent, {:locked, self()})
          receive do
            :release -> Repo.query!("SELECT pg_advisory_unlock($1)", [@lock])
          after
            120_000 -> raise "probe lock deadline"
          end
        end)
      end)
      receive do
        {:locked, ^locker} -> :ok
      after
        5_000 -> raise "lock not acquired"
      end
      {writer, monitor} = spawn_monitor(fn ->
        send(parent, {:unexpected_result, upload(root, "c097-pre-row.bin", :binary.copy("Unacknowledged orphan bytes\n", 257))})
      end)
      try do
        await(&waiting?/0, "one upload waiting in BEFORE INSERT", deadline)
        snapshot = blob()
        0 = snapshot.row_count
        write(root, "probe-barrier.json", %{orphan: snapshot, control: baseline, waiting_lock_count: 1})
        await(fn -> File.exists?(Path.join(root, "probe-kill")) end, "kill authorization", deadline)
        %{phase: :open, writers: 1} = Admission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
        Process.exit(writer, :kill)
        receive do
          {:DOWN, ^monitor, :process, ^writer, :killed} -> :ok
        after
          5_000 -> raise "owned writer did not die"
        end
        send(locker, :release)
        receive do
          {:DOWN, ^lock_monitor, :process, ^locker, :normal} -> :ok
        after
          5_000 -> raise "test lock holder did not finish"
        end
        await(fn -> not waiting?() end, "database lock released", deadline)
        write(root, "probe-killed.json", %{control: acknowledged.id, reason: "killed"})
        write(root, "probe-after-kill.json", %{orphan: blob(), control: control(acknowledged.id)})
      after
        if Process.alive?(writer), do: Process.exit(writer, :kill)
        if Process.alive?(locker), do: send(locker, :release)
      end
    end
  end
end

spawn(fn ->
  root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
  try do
    C097.OpenDeath.run(root)
  rescue
    error -> File.write!(Path.join(root, "probe-error.txt"), Exception.format(:error, error, __STACKTRACE__))
  end
end)
