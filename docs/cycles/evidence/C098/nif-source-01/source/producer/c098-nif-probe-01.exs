defmodule C098CarriedNifProbe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
        {:data, bytes} -> until(marker, deadline, text <> bytes)
        {:exit, code, signal} -> raise "premature PTY exit #{inspect({code, signal})}"
      after
        max(1, deadline - System.monotonic_time(:millisecond)) -> raise "PTY output deadline: #{marker}"
      end
    end
  end
  def wait_file(file, nonce, deadline) do
    case File.read(file) do
      {:ok, ^nonce} -> :ok
      _ ->
        if System.monotonic_time(:millisecond) >= deadline, do: raise("module observation acknowledgement deadline")
        Process.sleep(100)
        wait_file(file, nonce, deadline)
    end
  end
  def record(file, receipt) do
    File.write!(file <> ".next", :json.encode(receipt) |> IO.iodata_to_binary())
    File.rename!(file <> ".next", file)
  end
end

out = System.fetch_env!("C098_NIF_RESULT")
data = System.fetch_env!("C098_NIF_DATA")
nonce = System.fetch_env!("C098_NIF_NONCE")
record = fn r -> C098CarriedNifProbe.record(out, r) end
receipt = %{status: "running", beam_pid: String.to_integer(System.pid()), checks: [], lifecycle_accepted: false}
record.(receipt)
try do
  hash = Argon2.hash_pwd_salt("Disposable C098 native fixture Chø 🐕")
  true = String.starts_with?(hash, "$argon2id$")
  true = Argon2.verify_pass("Disposable C098 native fixture Chø 🐕", hash)
  false = Argon2.verify_pass("Wrong disposable fixture password", hash)
  receipt = Map.merge(receipt, %{checks: ["default-argon2id-hash", "correct-password-verifies", "wrong-password-refuses"], argon2_module: List.to_string(:code.which(Argon2.Base)), argon2_priv: List.to_string(:code.priv_dir(:argon2_elixir)), hash_length: byte_size(hash)})
  record.(receipt)
  case Application.load(:expty) do
    :ok -> :ok
    {:error, {:already_loaded, :expty}} -> :ok
  end
  {:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
  parent = self()
  executable = System.fetch_env!("C098_NIF_POWERSHELL")
  child_keys = ~w(PATH PATHEXT SystemRoot WINDIR ComSpec USERPROFILE APPDATA LOCALAPPDATA TEMP TMP PSModuleAnalysisCachePath)
  terminal_env = Enum.reduce(child_keys, %{}, fn key, env ->
    case System.get_env(key) do
      nil -> env
      value -> Map.put(env, key, value)
    end
  end) |> Map.merge(%{"C098_NIF_CHILD_IDENTITY" => Path.join(data, "child-identity.json"), "C098_NIF_NONCE" => nonce})
  {:ok, pty} = ExPTY.spawn(executable, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_NIF_CHILD")], cwd: data, cols: 80, rows: 24, env: terminal_env, on_data: fn _, _, bytes -> send(parent, {:data, bytes}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, code, signal}) end)
  state = :sys.get_state(pty)
  ready = C098CarriedNifProbe.until("C098_CARRIED_READY:" <> nonce, System.monotonic_time(:millisecond) + 15000)
  :ok = ExPTY.resize(pty, 112, 34)
  :ok = ExPTY.write(pty, nonce <> "\r")
  read = C098CarriedNifProbe.until("C098_CARRIED_READ:" <> nonce, System.monotonic_time(:millisecond) + 15000)
  size = C098CarriedNifProbe.until("C098_CARRIED_SIZE:112:34", System.monotonic_time(:millisecond) + 15000, read)
  kill_result = ExPTY.kill(pty, 9)
  receipt = Map.merge(receipt, %{status: "waiting-observation", child_pid: state.inner_pid, checks: receipt.checks ++ ["expty-spawn", "ready-output", "resize-return", "keyboard-write", "child-readback", "measured-child-console-112x34"], expty_module: List.to_string(:code.which(ExPTY.Nif)), expty_priv: List.to_string(:code.priv_dir(:expty)), kill_result: Atom.to_string(kill_result), output: ready <> size})
  record.(receipt)
  C098CarriedNifProbe.wait_file(Path.join(data, "modules-observed"), nonce, System.monotonic_time(:millisecond) + 60000)
  :ok = ExPTY.write(pty, "finish-" <> nonce <> "\r")
  callback = receive do
    {:exit, code, signal} -> %{received: true, code: code, signal: signal}
  after
    15000 -> %{received: false, waited_ms: 15000}
  end
  :ok = GenServer.stop(pty)
  false = Process.alive?(pty)
  record.(Map.merge(receipt, %{status: "component-observed", callback: callback, pty_alive: false, lifecycle_accepted: callback.received and kill_result == :ok}))
  IO.puts("C098_CARRIED_NIFS_OBSERVED")
rescue
  error ->
    record.(Map.merge(receipt, %{status: "failed", error: Exception.message(error)}))
    reraise error, __STACKTRACE__
end
