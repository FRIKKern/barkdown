[helper, output] = System.argv()
[{mod, binary}] = Code.compile_file(helper)
{:ok, {^mod, md5}} = :beam_lib.md5(binary)
^md5 = mod.module_info(:md5)
defmodule Barkdown.PrivateReturnTraceSelftestTarget do
  def ensure(%{id: id}, "thumb", []), do: {:ok, id}
  def ensure(%{id: _}, "preview", []), do: {:error, :controlled}
end
started = System.monotonic_time(:millisecond)
try do
  mfa = {Barkdown.PrivateReturnTraceSelftestTarget, :ensure, 3}
  tracer = Barkdown.PrivateEnsureReturnTrace.arm(mfa)
  {:ok, "owned-synthetic"} = Barkdown.PrivateReturnTraceSelftestTarget.ensure(%{id: "owned-synthetic"}, "thumb", [])
  owner = self()
  {child, monitor} = spawn_monitor(fn ->
    result = Barkdown.PrivateReturnTraceSelftestTarget.ensure(%{id: "owned-synthetic"}, "preview", [])
    send(owner, {:child_return, self(), result})
  end)
  receive do
    {:child_return, ^child, {:error, :controlled}} -> :ok
  after 5_000 -> raise "Pure child did not return"
  end
  receive do
    {:DOWN, ^monitor, :process, ^child, :normal} -> :ok
  after 5_000 -> raise "Pure child did not exit normally"
  end
  first = Barkdown.PrivateEnsureReturnTrace.finish(tracer)
  4 = first.count
  0 = first.unmatched_callers
  [one, two, three, four] = first.events
  true = one.kind == "call" and one.preset == "thumb" and one.media_id == "owned-synthetic"
  true = two.kind == "return" and two.call_seq == one.seq and two.caller == one.caller and two.returned == "{:ok, \"owned-synthetic\"}"
  true = three.kind == "call" and three.preset == "preview" and three.caller == inspect(child)
  true = four.kind == "return" and four.call_seq == three.seq and four.caller == three.caller and four.returned == "{:error, :controlled}"
  second = Barkdown.PrivateEnsureReturnTrace.arm(mfa) |> Barkdown.PrivateEnsureReturnTrace.finish()
  0 = second.count
  [] = second.events
  0 = second.unmatched_callers
  for observed <- [first, second], do: true = observed.pattern_disabled and observed.delivered and observed.processed_ack
  result = %{status: "selftest_passed", elapsedMs: System.monotonic_time(:millisecond) - started,
    module: inspect(mod), source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(helper)), case: :lower),
    binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower),
    events: first, zero_window: second, child_down_before_finish: inspect(child),
    scope: "Real pure function call and returned error, completed owned caller death and fresh zero window; no Barkpark application, database, HTTP or external rendering"}
  File.write!(output, JSON.encode!(result), [:exclusive])
rescue
  e ->
    File.write!(output, JSON.encode!(%{status: "failed", error: Exception.format(:error, e, __STACKTRACE__)}), [:exclusive])
    System.halt(1)
end
System.halt(0)
