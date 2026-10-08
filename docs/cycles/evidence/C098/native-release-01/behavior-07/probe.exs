defmodule C098Probe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
      {:data, bytes} -> until(marker, deadline, text <> bytes)
      {:exit, code, signal} -> raise "premature exit #{inspect({code, signal})}: #{inspect(text)}"
    after
      max(1, deadline - System.monotonic_time(:millisecond)) -> raise "output deadline for #{marker}: #{inspect(text)}"
      end
    end
  end
end
case Application.load(:expty) do
  :ok -> :ok
  {:error, {:already_loaded, :expty}} -> :ok
end
expected_priv = Path.join(System.fetch_env!("C098_CWD"), "expty/priv") |> Path.expand()
true = (:code.priv_dir(:expty) |> List.to_string() |> Path.expand()) == expected_priv
{:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
parent = self()
exe = Path.join(System.fetch_env!("SystemRoot"), "System32/WindowsPowerShell/v1.0/powershell.exe")
{:ok, pty} = ExPTY.spawn(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_CHILD")], cwd: System.fetch_env!("C098_CWD"), cols: 80, rows: 24, env: System.get_env(), on_data: fn _, _, data -> send(parent, {:data, data}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, code, signal}) end)
state = :sys.get_state(pty)
receipt = %{status: "running", os_pid: state.inner_pid, checks: [], nif_module: :code.which(ExPTY.Nif) |> List.to_string(), priv: :code.priv_dir(:expty) |> List.to_string()}
record = fn r -> File.write!(System.fetch_env!("C098_RESULT"), :json.encode(r) |> IO.iodata_to_binary()) end
record.(receipt)
ready = C098Probe.until("C098_NATIVE_READY", System.monotonic_time(:millisecond) + 15000)
receipt = %{receipt | checks: receipt.checks ++ ["spawn", "ready-output"]}
record.(receipt)
:ok = ExPTY.resize(pty, 112, 34)
receipt = %{receipt | checks: receipt.checks ++ ["resize-return"]}
record.(receipt)
:ok = ExPTY.write(pty, "C098_TYPED_NATIVE\r")
read = C098Probe.until("C098_NATIVE_READ:C098_TYPED_NATIVE", System.monotonic_time(:millisecond) + 15000)
size = C098Probe.until("C098_NATIVE_SIZE:112:34", System.monotonic_time(:millisecond) + 15000, read)
receipt = Map.merge(receipt, %{checks: receipt.checks ++ ["write", "readback", "measured-size-112x34"], output: ready <> size})
record.(receipt)
{code, signal} = receive do {:exit, code, signal} -> {code, signal} after 15000 ->
  record.(Map.merge(receipt, %{status: "failed", error: "no exit callback within 15000ms", pty_alive: Process.alive?(pty), pending_messages: inspect(Process.info(pty, :messages))}))
  raise "no exit"
end
23 = code
:ok = GenServer.stop(pty)
false = Process.alive?(pty)
record.(Map.merge(receipt, %{status: "passed", exit_code: code, signal: signal, pty_alive: false}))
IO.puts("C098_NATIVE_BEHAVIOR_PASSED")
