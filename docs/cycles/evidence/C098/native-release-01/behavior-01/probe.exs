defmodule C098Probe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker), do: text, else: receive do
      {:data, bytes} -> until(marker, deadline, text <> bytes)
      {:exit, code, signal} -> raise "premature exit #{inspect({code, signal})}: #{inspect(text)}"
    after
      max(1, deadline - System.monotonic_time(:millisecond)) -> raise "output deadline for #{marker}: #{inspect(text)}"
    end
  end
end
:ok = Application.load(:expty)
{:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
parent = self()
exe = Path.join(System.fetch_env!("SystemRoot"), "System32/WindowsPowerShell/v1.0/powershell.exe")
{:ok, pty} = ExPTY.spawn(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_CHILD")], cwd: System.fetch_env!("C098_CWD"), cols: 80, rows: 24, env: System.get_env(), on_data: fn _, _, data -> send(parent, {:data, data}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, code, signal}) end)
state = :sys.get_state(pty)
ready = C098Probe.until("C098_NATIVE_READY", System.monotonic_time(:millisecond) + 15000)
:ok = ExPTY.resize(pty, 112, 34)
:ok = ExPTY.write(pty, "C098_TYPED_NATIVE\r")
read = C098Probe.until("C098_NATIVE_READ:C098_TYPED_NATIVE", System.monotonic_time(:millisecond) + 15000)
size = C098Probe.until("C098_NATIVE_SIZE:112:34", System.monotonic_time(:millisecond) + 15000, read)
{code, signal} = receive do {:exit, code, signal} -> {code, signal} after 15000 -> raise "no exit" end
23 = code
:ok = GenServer.stop(pty)
false = Process.alive?(pty)
File.write!(System.fetch_env!("C098_RESULT"), inspect(%{status: :passed, os_pid: state.inner_pid, exit_code: code, signal: signal, resize: {112,34}, nif_module: :code.which(ExPTY.Nif), priv: :code.priv_dir(:expty), output: ready <> size}) <> "\n")
IO.puts("C098_NATIVE_BEHAVIOR_PASSED")
