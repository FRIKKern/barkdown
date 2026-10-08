defmodule C098PtyResourceProbe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
        {:data, bytes} -> until(marker, deadline, text <> bytes)
        {:exit, index, code, signal} -> raise "premature PTY exit #{inspect({index, code, signal})}"
      after
        max(1, deadline - System.monotonic_time(:millisecond)) -> raise "PTY output deadline"
      end
    end
  end
  def wait_file(file, nonce, deadline) do
    case File.read(file) do
      {:ok, ^nonce} -> :ok
      _ ->
        if System.monotonic_time(:millisecond) >= deadline, do: raise("resource observation deadline")
        Process.sleep(50)
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
record = fn r -> C098PtyResourceProbe.record(out, r) end
receipt = %{status: "running", beam_pid: String.to_integer(System.pid()), checks: [], lifecycle_accepted: false}
record.(receipt)
try do
  case Application.load(:expty) do
    :ok -> :ok
    {:error, {:already_loaded, :expty}} -> :ok
  end
  {:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
  receipt = Map.merge(receipt, %{status: "measure", phase: "baseline", expty_module: List.to_string(:code.which(ExPTY.Nif)), expty_priv: List.to_string(:code.priv_dir(:expty)), children: []})
  record.(receipt)
  C098PtyResourceProbe.wait_file(Path.join(data, "ack-baseline"), nonce, System.monotonic_time(:millisecond) + 60000)
  parent = self()
  executable = System.fetch_env!("C098_NIF_POWERSHELL")
  child_keys = ~w(PATH PATHEXT SystemRoot WINDIR ComSpec USERPROFILE APPDATA LOCALAPPDATA TEMP TMP PSModuleAnalysisCachePath)
  terminal_env = Enum.reduce(child_keys, %{}, fn key, env ->
    case System.get_env(key) do nil -> env; value -> Map.put(env, key, value) end
  end)
  receipt = Enum.reduce(1..3, receipt, fn index, receipt ->
    child_nonce = nonce <> "-" <> Integer.to_string(index)
    child_env = Map.merge(terminal_env, %{"C098_NIF_CHILD_IDENTITY" => Path.join(data, "child-identity-#{index}.json"), "C098_NIF_NONCE" => child_nonce})
    {:ok, pty} = ExPTY.spawn(executable, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_NIF_CHILD")], cwd: data, cols: 80, rows: 24, env: child_env, on_data: fn _, _, bytes -> send(parent, {:data, bytes}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, index, code, signal}) end)
    state = :sys.get_state(pty)
    ready = C098PtyResourceProbe.until("C098_CARRIED_READY:" <> child_nonce, System.monotonic_time(:millisecond) + 15000)
    child = %{index: index, pid: state.inner_pid, pty_alive: Process.alive?(pty), ready_nonce_seen: String.contains?(ready, child_nonce)}
    receipt = Map.merge(receipt, %{status: "waiting-child", phase: "child-#{index}", child: child})
    record.(receipt)
    C098PtyResourceProbe.wait_file(Path.join(data, "ack-child-#{index}"), nonce, System.monotonic_time(:millisecond) + 30000)
    :ok = ExPTY.write(pty, child_nonce <> "\r")
    readback = C098PtyResourceProbe.until("C098_CARRIED_READ:" <> child_nonce, System.monotonic_time(:millisecond) + 15000)
    true = String.contains?(readback, child_nonce)
    :ok = ExPTY.write(pty, "finish-" <> child_nonce <> "\r")
    callback = receive do
      {:exit, ^index, code, signal} -> %{received: true, code: code, signal: signal}
    after
      500 -> %{received: false, waited_ms: 500}
    end
    child = Map.merge(child, %{callback: callback, input_readback: true, pty_alive_after_exit_wait: Process.alive?(pty)})
    receipt = Map.merge(receipt, %{status: "measure", phase: "exited-#{index}", child: child})
    record.(receipt)
    C098PtyResourceProbe.wait_file(Path.join(data, "ack-exited-#{index}"), nonce, System.monotonic_time(:millisecond) + 30000)
    :ok = GenServer.stop(pty)
    false = Process.alive?(pty)
    Map.put(receipt, :children, receipt.children ++ [Map.put(child, :pty_stopped, true)])
  end)
  record.(Map.merge(receipt, %{status: "measure", phase: "wrappers-stopped"}))
  C098PtyResourceProbe.wait_file(Path.join(data, "ack-wrappers-stopped"), nonce, System.monotonic_time(:millisecond) + 30000)
  record.(Map.merge(receipt, %{status: "component-observed", late_messages: inspect(elem(Process.info(self(), :messages), 1)), lifecycle_accepted: false}))
rescue
  error -> record.(Map.merge(receipt, %{status: "failed", error: Exception.message(error)})); reraise error, __STACKTRACE__
end
