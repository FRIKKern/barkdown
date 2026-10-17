[helper, output] = System.argv()
[{mod, binary}] = Code.compile_file(helper)
{:ok, {^mod, md5}} = :beam_lib.md5(binary)
^md5 = mod.module_info(:md5)
defmodule Barkdown.PrivatePathReturnTraceSelftestTarget do
  def probe("owned-ok"), do: {:ok, "owned-ok"}
  def probe("owned-error"), do: {:error, :controlled}

end
started = System.monotonic_time(:millisecond)
try do
  mfa = {Barkdown.PrivatePathReturnTraceSelftestTarget, :probe, 1}
  tracer = Barkdown.PrivatePathReturnTrace.arm(mfa)
  {:ok, "owned-ok"} = Barkdown.PrivatePathReturnTraceSelftestTarget.probe("owned-ok")
  owner = self()
  {child, monitor} = spawn_monitor(fn ->
    result = Barkdown.PrivatePathReturnTraceSelftestTarget.probe("owned-error")
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
  first = Barkdown.PrivatePathReturnTrace.finish(tracer)
  4 = first.count
  0 = first.unmatched_callers
  [one, two, three, four] = first.events
  true = one.kind == "call" and one.argument == "owned-ok"
  true = two.kind == "return" and two.call_seq == one.seq and two.caller == one.caller and two.returned == "{:ok, \"owned-ok\"}"
  true = three.kind == "call" and three.argument == "owned-error" and three.caller == inspect(child)
  true = four.kind == "return" and four.call_seq == three.seq and four.caller == three.caller and four.returned == "{:error, :controlled}"
  second = Barkdown.PrivatePathReturnTrace.arm(mfa) |> Barkdown.PrivatePathReturnTrace.finish()
  0 = second.count
  [] = second.events
  0 = second.unmatched_callers
  for observed <- [first, second], do: true = observed.pattern_disabled and observed.delivered and observed.processed_ack
  result = %{status: "selftest_passed", elapsedMs: System.monotonic_time(:millisecond) - started,
    module: inspect(mod), source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(helper)), case: :lower),
    binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower),
    events: first, zero_window: second, child_down_before_finish: inspect(child),
    scope: "Real one-argument pure function normal/error returns, child DOWN normal before finish, fresh zero window. No File.rm_rf invocation/filesystem deletion/Barkpark application/database/HTTP/native rendering; this is helper protocol validation only."}
  File.write!(output, JSON.encode!(result), [:exclusive])
rescue
  e ->
    File.write!(output, JSON.encode!(%{status: "failed", error: Exception.format(:error, e, __STACKTRACE__)}), [:exclusive])
    System.halt(1)
end
System.halt(0)
