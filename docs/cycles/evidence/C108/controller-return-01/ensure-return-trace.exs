defmodule Barkdown.PrivateEnsureReturnTrace do
  # One node-local MFA, bounded request window. Observe; never replace its code.
  def arm({mod, fun, 3} = mfa) when is_atom(mod) and is_atom(fun) do
    {:module, ^mod} = Code.ensure_loaded(mod)
    {:meta, false} = :erlang.trace_info(mfa, :meta)
    tracer = spawn(fn -> loop(mfa, [], %{}) end)
    spec = [{:_, [], [{:return_trace}]}]
    1 = :erlang.trace_pattern(mfa, spec, [{:meta, tracer}])
    {:meta, ^tracer} = :erlang.trace_info(mfa, :meta)
    {tracer, mfa}
  end

  def finish({tracer, mfa}) do
    {:meta, ^tracer} = :erlang.trace_info(mfa, :meta)
    1 = :erlang.trace_pattern(mfa, false, [:meta])
    {:meta, false} = :erlang.trace_info(mfa, :meta)
    delivered = :erlang.trace_delivered(:all)
    receive do
      {:trace_delivered, :all, ^delivered} -> :ok
    after 5_000 -> raise "Return trace delivery barrier timed out"
    end
    ref = make_ref()
    monitor = Process.monitor(tracer)
    send(tracer, {:finish, self(), ref})
    receive do
      {^ref, events, pending} ->
        receive do
          {:DOWN, ^monitor, :process, ^tracer, :normal} -> :ok
        after 5_000 -> raise "Owned return tracer did not stop"
        end
        %{status: "return_trace_drained", mfa: inspect(mfa), events: events,
          count: length(events), unmatched_callers: pending,
          pattern_disabled: true, delivered: true, processed_ack: true,
          scope: "One node-local MFA call/return window; no native completion or full writer census claim"}
      {:DOWN, ^monitor, :process, ^tracer, why} -> raise "Return tracer failed: #{inspect(why)}"
    after 5_000 -> raise "Return trace processing acknowledgment timed out"
    end
  end

  defp loop(mfa, events, stacks) do
    receive do
      {:trace_ts, caller, :call, {mod, fun, [file, preset, opts]}, timestamp} ->
        true = {mod, fun, 3} == mfa
        true = is_map(file) and is_binary(preset) and is_list(opts)
        seq = length(events) + 1
        event = %{kind: "call", seq: seq, caller: inspect(caller),
          media_id: Map.fetch!(file, :id), preset: preset,
          option_count: length(opts), timestamp: inspect(timestamp)}
        loop(mfa, [event | events], Map.update(stacks, caller, [seq], &[seq | &1]))
      {:trace_ts, caller, :return_from, ^mfa, value, timestamp} ->
        [call_seq | rest] = Map.fetch!(stacks, caller)
        remaining = if rest == [], do: Map.delete(stacks, caller), else: Map.put(stacks, caller, rest)
        event = %{kind: "return", seq: length(events) + 1, caller: inspect(caller),
          call_seq: call_seq, returned: inspect(value, limit: :infinity, printable_limit: :infinity),
          timestamp: inspect(timestamp)}
        loop(mfa, [event | events], remaining)
      {:finish, owner, ref} -> send(owner, {ref, Enum.reverse(events), map_size(stacks)})
      other -> raise "Unexpected return trace message: #{inspect(other)}"
    after 45_000 -> raise "Return trace was not finished"
    end
  end
end
