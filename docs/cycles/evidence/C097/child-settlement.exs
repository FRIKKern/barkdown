# Source-loaded, unchanged pinned admission modules; actual DETS and BEAM tasks.
# Marker files are synthetic effects, not a media/blob integration claim.
ExUnit.start(seed: 0)
source = System.fetch_env!("C097_BP_SOURCE")
Code.prepend_path(Path.join(source, "api/_build/dev/lib/plug/ebin"))
Code.require_file("api/lib/barkpark/managed_runtime/write_admission.ex", source)
Code.require_file("api/lib/barkpark/managed_runtime/write_admission/door.ex", source)
Code.require_file("api/test/barkpark/managed_runtime/write_admission/door_test.exs", source)

defmodule C097.ChildSettlementTest do
  use ExUnit.Case, async: false
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
  alias Barkpark.ManagedRuntime.WriteAdmission.Door

  setup do
    previous = Application.get_env(:barkpark, :write_admission)
    id = "c097-child-" <> Base.encode16(:crypto.strong_rand_bytes(8))
    root = Path.join(System.tmp_dir!(), id)
    File.mkdir_p!(root)
    opts = [journal: Path.join(root, "admission.dets"), instance_id: id]
    {:ok, gate} = Admission.start_link(opts ++ [initialize: true])
    Process.unlink(gate)
    supervisor = start_supervised!(Task.Supervisor)
    Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: id)
    on_exit(fn ->
      if Process.alive?(gate), do: GenServer.stop(gate)
      if previous, do: Application.put_env(:barkpark, :write_admission, previous),
        else: Application.delete_env(:barkpark, :write_admission)
    end)
    %{gate: gate, opts: opts, root: root, supervisor: supervisor}
  end

  test "an admitted child completes before the root can drain", c do
    {writer, child} = writers(c)
    on_exit(fn -> stop(writer); stop(child) end)
    {:ok, :closing, hold} = Admission.begin_hold(c.gate, "child-drain", Admission.status(c.gate).generation)
    send(writer, :return)
    assert false == Admission.held?(c.gate, hold)
    assert %{pending: 1, writers: 2} = Admission.status(c.gate)
    refute_receive {:root_returned, ^writer, _}, 100
    assert {:error, {:write_admission, :admission_closed}} = Door.admit(fn -> flunk("new writer entered") end)
    send(child, :finish)
    assert_receive {:child_finished, ^child}, 5_000
    assert_receive {:root_returned, ^writer, :root_result}, 5_000
    assert File.read!(Path.join(c.root, "child-effect.txt")) == "owned child finished"
    assert %{phase: :held, pending: 0, writers: 0} = Admission.status(c.gate)
    assert true == Admission.held?(c.gate, hold)
    assert :ok = Admission.reopen(c.gate, hold)
    IO.puts("C097 child drain PASS: child effect present, root waited, hold became valid; #{c.root}")
  end

  test "timed-out child settlement never becomes a clean hold and survives restart", c do
    {writer, child} = writers(c)
    on_exit(fn -> stop(writer); stop(child) end)
    {:ok, :closing, hold} = Admission.begin_hold(c.gate, "child-timeout", Admission.status(c.gate).generation)
    started = System.monotonic_time(:millisecond)
    send(writer, :return)
    assert_receive {:root_returned, ^writer, :root_result}, 10_000
    assert System.monotonic_time(:millisecond) - started >= 5_000
    assert %{phase: :closing, pending: 1, writers: 2} = Admission.status(c.gate)
    assert false == Admission.held?(c.gate, hold)
    assert {:error, :invalid_hold} = Admission.reopen(c.gate, hold)
    refute File.exists?(Path.join(c.root, "child-effect.txt"))
    monitor = Process.monitor(writer)
    send(writer, :exit)
    assert_receive {:DOWN, ^monitor, :process, ^writer, :normal}, 5_000
    await_phase(c.gate, :recovery_required)
    state = Admission.status(c.gate)
    assert %{pending: 1, writers: 1, dead_writers: 1} = state
    assert {:error, :writers_present} = Admission.recover(c.gate, state.generation, state.pending)
    monitor = Process.monitor(child)
    Process.exit(child, :kill)
    assert_receive {:DOWN, ^monitor, :process, ^child, :killed}, 5_000
    assert %{pending: 1, writers: 0} = Admission.status(c.gate)
    GenServer.stop(c.gate)
    {:ok, restarted} = Admission.start_link(c.opts)
    Process.unlink(restarted)
    on_exit(fn -> if Process.alive?(restarted), do: GenServer.stop(restarted) end)
    next = Admission.status(restarted)
    assert %{phase: :recovery_required, pending: 1, writers: 0} = next
    assert next.generation > state.generation
    refute next.boot == state.boot
    assert {:error, {:write_admission, :admission_closed}} = Door.admit(fn -> flunk("restarted closed gate admitted") end)
    assert {:error, :stale_generation} = Admission.recover(restarted, state.generation, 1)
    assert {:error, :unreconciled} = Admission.recover(restarted, next.generation, 0)
    refute File.exists?(Path.join(c.root, "child-effect.txt"))
    assert :ok = Admission.recover(restarted, next.generation, 1)
    assert :reopened == Door.admit(fn -> :reopened end)
    assert %{phase: :open, pending: 0, writers: 0} = Admission.status(restarted)
    IO.puts("C097 child timeout PASS: no false hold, live child refused recovery, killed child journal survived restart, explicit recovery reopened; #{c.root}")
  end

  defp writers(c) do
    parent = self()
    writer = spawn(fn ->
      result = Door.admit(fn ->
        Task.Supervisor.async_nolink(c.supervisor, fn ->
          Door.admit(fn ->
            send(parent, {:child_entered, self()})
            receive do
              :finish ->
                File.write!(Path.join(c.root, "child-effect.txt"), "owned child finished")
                send(parent, {:child_finished, self()})
            end
          end)
        end)
        receive do: (:return -> :root_result)
      end)
      send(parent, {:root_returned, self(), result})
      receive do: (:exit -> :ok)
    end)
    assert_receive {:child_entered, child}, 5_000
    {writer, child}
  end

  defp stop(pid), do: if(Process.alive?(pid), do: Process.exit(pid, :kill))
  defp await_phase(gate, phase), do: await_phase(gate, phase, System.monotonic_time(:millisecond) + 5_000)
  defp await_phase(gate, phase, deadline) do
    cond do
      Admission.status(gate).phase == phase -> :ok
      System.monotonic_time(:millisecond) >= deadline -> flunk("phase did not become #{phase}")
      true -> Process.sleep(5); await_phase(gate, phase, deadline)
    end
  end
end
