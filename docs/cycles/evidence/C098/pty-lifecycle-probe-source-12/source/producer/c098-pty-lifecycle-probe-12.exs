defmodule C098LifecycleProbe do
  def record(file, receipt) do
    File.write!(file <> ".next", :json.encode(receipt) |> IO.iodata_to_binary())
    File.rename!(file <> ".next", file)
  end

  def ack(data, name, nonce) do
    wait_file(Path.join(data, "ack-" <> name), nonce, System.monotonic_time(:millisecond) + 30000)
  end

  def wait_file(file, nonce, deadline) do
    case File.read(file) do
      {:ok, ^nonce} ->
        :ok

      _ ->
        if System.monotonic_time(:millisecond) >= deadline,
          do: raise("lifecycle observation deadline")

        Process.sleep(50)
        wait_file(file, nonce, deadline)
    end
  end

  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
        {:data, _, bytes} ->
          until(marker, deadline, text <> bytes)

        {:exit, index, code, signal} ->
          raise "premature/duplicate exit #{inspect({index, code, signal})}"
      after
        max(1, deadline - System.monotonic_time(:millisecond)) -> raise "PTY output deadline"
      end
    end
  end

  def exit_callback(index, timeout) do
    receive do
      {:exit, ^index, code, signal} ->
        %{received: true, code: code, signal: signal}

      {:exit, other, code, signal} ->
        raise "wrong/duplicate callback #{inspect({other, code, signal})}"
    after
      timeout -> raise "lifecycle callback deadline"
    end
  end

  def no_duplicate do
    receive do
      {:exit, index, code, signal} -> raise "duplicate callback #{inspect({index, code, signal})}"
    after
      500 -> :ok
    end
  end

  def blocked_writer(pty, deadline) do
    if System.monotonic_time(:millisecond) > deadline, do: raise("no blocked NIF write observed")

    if Process.info(pty, :current_function) == {:current_function, {ExPTY.Nif, :write, 2}} do
      Process.sleep(100)
      true = Process.info(pty, :current_function) == {:current_function, {ExPTY.Nif, :write, 2}}

      receive do
        {:writer_result, _} -> raise "writer already completed"
      after
        0 -> :ok
      end
    else
      Process.sleep(10)
      blocked_writer(pty, deadline)
    end
  end

  def trace_loop(tracer, parent) do
    receive do
      {:trace, ^parent, :spawn, pid, mfa} ->
        send(parent, {:failed_wrapper, pid, mfa})
        trace_loop(tracer, parent)

      :stop ->
        :ok

      _ ->
        trace_loop(tracer, parent)
    end
  end
end

out = System.fetch_env!("C098_NIF_RESULT")
data = System.fetch_env!("C098_NIF_DATA")
nonce = System.fetch_env!("C098_NIF_NONCE")
candidate = System.fetch_env!("C098_CANDIDATE")
record = fn r -> C098LifecycleProbe.record(out, r) end

receipt = %{
  status: "running",
  beam_pid: String.to_integer(System.pid()),
  checks: [],
  children: [],
  lifecycle_accepted: false
}

record.(receipt)

try do
  true = Code.prepend_path(Path.join(candidate, "ebin"))

  case Application.load(:expty) do
    :ok -> :ok
    {:error, {:already_loaded, :expty}} -> :ok
  end

  {:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
  {:module, ExPTY} = Code.ensure_loaded(ExPTY)
  true = function_exported?(ExPTY.Nif, :close, 1)

  receipt =
    Map.merge(receipt, %{
      status: "measure",
      phase: "baseline",
      expty_priv: List.to_string(:code.priv_dir(:expty)),
      expty_module: List.to_string(:code.which(ExPTY.Nif))
    })

  record.(receipt)
  C098LifecycleProbe.ack(data, "baseline", nonce)
  parent = self()
  executable = System.fetch_env!("C098_NIF_POWERSHELL")

  keys =
    ~w(PATH PATHEXT SystemRoot WINDIR ComSpec USERPROFILE APPDATA LOCALAPPDATA TEMP TMP PSModuleAnalysisCachePath)

  env =
    Enum.reduce(keys, %{}, fn k, a ->
      case System.get_env(k) do
        nil -> a
        v -> Map.put(a, k, v)
      end
    end)

  receipt =
    Enum.reduce(1..8, receipt, fn index, receipt ->
      child_nonce = nonce <> "-" <> Integer.to_string(index)

      child_env =
        Map.merge(env, %{
          "C098_NIF_CHILD_IDENTITY" => Path.join(data, "child-identity-#{index}.json"),
          "C098_NIF_NONCE" => child_nonce,
          "C098_NIF_HOLD" => if(index == 8, do: "1", else: "0")
        })

      {:ok, pty} =
        ExPTY.spawn(
          executable,
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            System.fetch_env!("C098_NIF_CHILD")
          ],
          cwd: data,
          cols: 80,
          rows: 24,
          env: child_env,
          on_data: fn _, _, bytes -> send(parent, {:data, index, bytes}) end,
          on_exit: fn _, _, code, signal -> send(parent, {:exit, index, code, signal}) end
        )

      state = :sys.get_state(pty)
      true = is_reference(state.pty)

      wrong_owner =
        try do
          ExPTY.Nif.write(state.pty, "unowned")
          :allowed
        rescue
          ArgumentError -> :refused
        end

      :refused = wrong_owner

      ready =
        C098LifecycleProbe.until(
          "C098_CARRIED_READY:" <> child_nonce,
          System.monotonic_time(:millisecond) + 15000
        )

      true = String.contains?(ready, child_nonce)

      child = %{
        index: index,
        pid: state.inner_pid,
        resource_reference: true,
        wrong_owner_refused: true,
        ready_nonce_seen: true
      }

      receipt =
        Map.merge(receipt, %{status: "waiting-child", phase: "child-#{index}", child: child})

      record.(receipt)
      C098LifecycleProbe.ack(data, "child-#{index}", nonce)

      if index != 8 do
        :ok = ExPTY.resize(pty, 112, 34)
        :ok = ExPTY.write(pty, child_nonce <> "\r")

        readback =
          C098LifecycleProbe.until(
            "C098_CARRIED_READ:" <> child_nonce,
            System.monotonic_time(:millisecond) + 15000
          )

        _ =
          C098LifecycleProbe.until(
            "C098_CARRIED_SIZE:112:34",
            System.monotonic_time(:millisecond) + 15000,
            readback
          )
      end

      mode =
        Enum.at(
          [
            "natural",
            "natural",
            "natural",
            "kill9",
            "kill15",
            "wrapper-stop",
            "wrapper-kill",
            "blocked-writer-kill"
          ],
          index - 1
        )

      callback =
        case mode do
          "natural" ->
            :ok = ExPTY.write(pty, "finish-" <> child_nonce <> "\r")
            result = C098LifecycleProbe.exit_callback(index, 5000)
            %{received: true, code: 23, signal: nil} = result
            result

          value when value in ["kill9", "kill15"] ->
            {:error, _} = ExPTY.kill(pty, 2)
            signal = if value == "kill9", do: 9, else: 15
            :ok = ExPTY.kill(pty, signal)
            result = C098LifecycleProbe.exit_callback(index, 5000)
            true = result == %{received: true, code: 128 + signal, signal: signal}
            result

          "wrapper-stop" ->
            :ok = GenServer.stop(pty)
            false = Process.alive?(pty)
            %{received: false, code: nil, signal: nil}

          "blocked-writer-kill" ->
            :ok = ExPTY.on_data(pty, fn _, _, _ -> :ok end)

            writer =
              Kernel.spawn(fn ->
                result =
                  try do
                    {:ok, ExPTY.write(pty, :binary.copy("w", 32 * 1024 * 1024))}
                  catch
                    :exit, reason -> {:error, reason}
                  end

                send(parent, {:writer_result, result})
              end)

            C098LifecycleProbe.blocked_writer(pty, System.monotonic_time(:millisecond) + 5000)
            true = Process.alive?(writer)
            monitor = Process.monitor(pty)
            true = Process.exit(pty, :kill)

            receive do
              {:DOWN, ^monitor, :process, ^pty, :killed} -> :ok
            after
              5000 -> raise "blocked writer wrapper death deadline"
            end

            receive do
              {:writer_result, {:error, _}} -> :ok
              {:writer_result, other} -> raise "write completed before kill: #{inspect(other)}"
            after
              5000 -> raise "blocked writer caller settlement deadline"
            end

            %{received: false, code: nil, signal: nil}

          "wrapper-kill" ->
            monitor = Process.monitor(pty)
            true = Process.exit(pty, :kill)

            receive do
              {:DOWN, ^monitor, :process, ^pty, :killed} -> :ok
            after
              5000 -> raise "wrapper death deadline"
            end

            false = Process.alive?(pty)
            %{received: false, code: nil, signal: nil}
        end

      if Process.alive?(pty) do
        {:error, _} = ExPTY.write(pty, "closed")
        {:error, _} = ExPTY.write(pty, "closed-again")
        {:error, _} = ExPTY.resize(pty, 80, 24)
      end

      child =
        Map.merge(child, %{
          callback: callback,
          mode: mode,
          input_readback: index != 8,
          blocked_writer_observed: index == 8,
          actual_geometry: if(index == 8, do: nil, else: [112, 34]),
          closed_operations_refused: index <= 5
        })

      receipt = Map.merge(receipt, %{status: "measure", phase: "exited-#{index}", child: child})
      record.(receipt)
      C098LifecycleProbe.ack(data, "exited-#{index}", nonce)
      if Process.alive?(pty), do: GenServer.stop(pty)
      false = Process.alive?(pty)
      C098LifecycleProbe.no_duplicate()
      Map.put(receipt, :children, receipt.children ++ [Map.put(child, :pty_stopped, true)])
    end)

  tracer = Kernel.spawn(fn -> C098LifecycleProbe.trace_loop(self(), parent) end)
  1 = :erlang.trace(parent, true, [:procs, {:tracer, tracer}])

  failures =
    Enum.map(1..20, fn index ->
      kind = if rem(index, 2) == 1, do: "missing-executable", else: "missing-cwd"

      file =
        if kind == "missing-executable",
          do: Path.join(data, "no-executable-#{nonce}.exe"),
          else: executable

      cwd = if kind == "missing-cwd", do: Path.join(data, "no-cwd-#{nonce}"), else: data
      {:error, reason} = ExPTY.spawn(file, [], cwd: cwd, env: env)

      wrapper =
        receive do
          {:failed_wrapper, pid, {:proc_lib, :init_p, _}} -> pid
        after
          1000 -> raise "failed spawn wrapper trace deadline"
        end

      false = Process.alive?(wrapper)
      %{index: index, kind: kind, error: reason, wrapper_stopped: true}
    end)

  1 = :erlang.trace(parent, false, [:procs])
  send(tracer, :stop)
  receipt = Map.put(receipt, :failures, failures)
  record.(Map.merge(receipt, %{status: "measure", phase: "failures-stopped"}))
  C098LifecycleProbe.ack(data, "failures-stopped", nonce)
  record.(Map.merge(receipt, %{status: "measure", phase: "wrappers-stopped"}))
  C098LifecycleProbe.ack(data, "wrappers-stopped", nonce)
  C098LifecycleProbe.no_duplicate()

  record.(
    Map.merge(receipt, %{
      status: "component-observed",
      prototype_natural_exit_passed: true,
      prototype_kill_wrapper_failure_passed: true,
      lifecycle_accepted: false
    })
  )
rescue
  error ->
    record.(Map.merge(receipt, %{status: "failed", error: Exception.message(error)}))
    reraise error, __STACKTRACE__
end
