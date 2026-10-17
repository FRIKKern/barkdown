defmodule Barkdown.PrivateNativeInvocationTrace do
  # Observes ingress to the real BIF; no command replacement or live-port lookup.
  # OTP call trace messages are sent at function ingress. Disable the pattern,
  # await delivery, then acknowledge processing in the owned tracer mailbox.
  def arm do
    {:meta, false} = :erlang.trace_info({:erlang, :open_port, 2}, :meta)
    tracer = spawn(fn -> loop([]) end)
    1 = :erlang.trace_pattern({:erlang, :open_port, 2}, true, [{:meta, tracer}])
    {:meta, ^tracer} = :erlang.trace_info({:erlang, :open_port, 2}, :meta)
    tracer
  end

  def finish(tracer) do
    {:meta, ^tracer} = :erlang.trace_info({:erlang, :open_port, 2}, :meta)
    1 = :erlang.trace_pattern({:erlang, :open_port, 2}, false, [:meta])
    {:meta, false} = :erlang.trace_info({:erlang, :open_port, 2}, :meta)
    delivered = :erlang.trace_delivered(:all)
    receive do
      {:trace_delivered, :all, ^delivered} -> :ok
    after 5_000 -> raise "Trace delivery barrier timed out"
    end
    ref = make_ref()
    monitor = Process.monitor(tracer)
    send(tracer, {:finish, self(), ref})
    receive do
      {^ref, events} ->
        receive do
          {:DOWN, ^monitor, :process, ^tracer, :normal} -> :ok
        after 5_000 -> raise "Owned invocation tracer did not stop"
        end
        %{status: "invocation_trace_drained", events: events, count: length(events),
          pattern_disabled: true, delivered: true, processed_ack: true,
          scope: "Node-local open_port BIF ingress while meta pattern enabled; no native lifetime or loaded DLL claim"}
      {:DOWN, ^monitor, :process, ^tracer, reason} -> raise "Invocation tracer failed: #{inspect(reason)}"
    after 5_000 -> raise "Trace processing acknowledgment timed out"
    end
  end

  defp loop(events) do
    receive do
      {:trace_ts, caller, :call, {:erlang, :open_port, [name, options]}, timestamp} ->
        event = %{caller: inspect(caller), name: inspect(name),
          options_count: if(is_list(options), do: length(options), else: nil),
          timestamp: inspect(timestamp)}
        loop([event | events])
      {:finish, owner, ref} -> send(owner, {ref, Enum.reverse(events)})
      other -> raise "Unexpected invocation trace message: #{inspect(other)}"
    after 45_000 -> raise "Invocation trace was not finished"
    end
  end
end
