defmodule Barkdown.PrivateNativePortTrace do
  # Prepared only: no production module replacement, no native command interception.
  def arm(output, executable) do
    parent = self()
    tracer = spawn(fn ->
      try do
      send(parent, {:native_trace_ready, self()})
      loop(output, String.downcase(Path.expand(executable)), DateTime.utc_now() |> DateTime.to_iso8601(), nil)
      rescue
        e -> write(output, "native-trace-failed", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__)})
      end
    end)
    receive do {:native_trace_ready, ^tracer} -> :ok after 5_000 -> raise "Trace process not ready" end
    :erlang.trace(:new_ports, true, [:ports, {:tracer, tracer}])
    tracer
  end
  def disarm(tracer) do
    :erlang.trace(:new_ports, false, [:ports])
    send(tracer, :stop)
    :ok
  end
  defp write(output, name, value) do
    path = Path.join(output, name <> ".json")
    File.write!(path <> ".writing", JSON.encode!(value), [:exclusive])
    File.rename!(path <> ".writing", path)
  end
  defp loop(output, expected, window, selected) do
    receive do
      {:trace, port, :open, owner, driver} when is_nil(selected) ->
        case {:erlang.port_info(port, :name), :erlang.port_info(port, :os_pid)} do
          {{:name, name}, {:os_pid, os_pid}} when is_integer(os_pid) and os_pid > 0 ->
            if String.downcase(Path.expand(List.to_string(name))) == expected do
              write(output, "native-port-open", %{status: "actual_beam_port_open", port: inspect(port), owner: inspect(owner), driver: inspect(driver), beam_os_pid: System.pid(), os_pid: os_pid, executable: List.to_string(name), window_start: window, observed_at: DateTime.utc_now() |> DateTime.to_iso8601()})
              deadline = System.monotonic_time(:millisecond) + 5_000
              Stream.repeatedly(fn ->
                cond do
                  File.exists?(Path.join(output, "native-active.json")) -> true
                  File.exists?(Path.join(output, "native-observer-failed.json")) -> raise "Native observer refused live child"
                  System.monotonic_time(:millisecond) >= deadline -> raise "Live native handle acknowledgment timed out"
                  true -> Process.sleep(1); false
                end
              end) |> Enum.find(& &1)
              {:os_pid, ^os_pid} = :erlang.port_info(port, :os_pid)
              {:connected, ^owner} = :erlang.port_info(port, :connected)
              write(output, "native-port-live-recheck", %{status: "actual_port_still_owns_observed_native_pid", port: inspect(port), owner: inspect(owner), os_pid: os_pid, observed_at: DateTime.utc_now() |> DateTime.to_iso8601()})
              loop(output, expected, window, port)
            else
              loop(output, expected, window, selected)
            end
          _ -> loop(output, expected, window, selected)
        end
      {:trace, port, :closed, reason} when port == selected ->
        write(output, "native-port-closed", %{status: "actual_port_closed", port: inspect(port), reason: inspect(reason), observed_at: DateTime.utc_now() |> DateTime.to_iso8601()})
        loop(output, expected, window, selected)
      :stop -> :ok
      _ -> loop(output, expected, window, selected)
    after 45_000 -> raise "Actual native port trace timed out"
    end
  end
end
