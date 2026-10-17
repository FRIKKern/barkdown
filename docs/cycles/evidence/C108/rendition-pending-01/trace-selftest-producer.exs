[source, output] = System.argv()
[{mod, binary}] = Code.compile_file(source)
Barkdown.PrivateNativeInvocationTrace = mod
{:ok, {^mod, md5}} = :beam_lib.md5(binary)
^md5 = mod.module_info(:md5)
attempt = fn ->
  try do
    apply(:erlang, :open_port, [:controlled_invalid_port_name, []])
    raise "Invalid port name unexpectedly accepted"
  rescue
    ArgumentError -> :actual_badarg
  end
end
started = System.monotonic_time(:millisecond)
first = mod.arm()
:actual_badarg = attempt.()
one = mod.finish(first)
1 = one.count
[%{name: ":controlled_invalid_port_name", options_count: 0}] = one.events
second = mod.arm()
parent = self()
{worker, monitor} = spawn_monitor(fn ->
  :actual_badarg = attempt.()
  send(parent, {:actual_attempt_finished, self()})
end)
receive do {:actual_attempt_finished, ^worker} -> :ok after 5_000 -> raise "Attempt missing" end
receive do {:DOWN, ^monitor, :process, ^worker, :normal} -> :ok after 5_000 -> raise "Worker DOWN missing" end
two = mod.finish(second)
1 = two.count
[%{caller: caller, name: ":controlled_invalid_port_name", options_count: 0}] = two.events
true = caller == inspect(worker)
third = mod.arm()
zero = mod.finish(third)
0 = zero.count
[] = zero.events
File.write!(output, JSON.encode!(%{status: "actual_invalid_open_port_detection_passed", module: inspect(mod),
  source: source, source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(source)), case: :lower),
  binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower),
  elapsedMs: System.monotonic_time(:millisecond) - started, checks: [one, two, zero],
  limits: "Two real invalid open_port BIF attempts fail badarg before external execution, including an already-dead owned caller; fresh zero window also drained. No application/Repo/renderer/native executable invocation. Full-runtime negative case not executed."}))
