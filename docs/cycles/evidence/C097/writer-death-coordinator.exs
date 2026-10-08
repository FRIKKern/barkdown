# Standalone proof against the unchanged pinned module. No application, HTTP,
# database or blob writer is started; those effects need a separate rehearsal.
ExUnit.start(seed: 0)
source = System.fetch_env!("C097_BP_SOURCE")
Code.require_file("api/lib/barkpark/managed_runtime/write_admission.ex", source)
Code.require_file("api/test/barkpark/managed_runtime/write_admission_test.exs", source)

defmodule C097.ForcedWriterDeathTest do
  use ExUnit.Case, async: false
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission

  test "a killed admitted writer retains uncertainty through coordinator restart" do
    root = Path.join(System.tmp_dir!(), "c097-killed-writer-" <> Base.encode16(:crypto.strong_rand_bytes(8)))
    File.mkdir_p!(root)
    journal = Path.join(root, "admission.dets")
    opts = [journal: journal, instance_id: "c097-killed-writer"]
    {:ok, gate} = Admission.start_link(opts ++ [initialize: true])
    Process.unlink(gate)
    on_exit(fn -> if Process.alive?(gate), do: GenServer.stop(gate) end)
    parent = self()
    {writer, monitor} = spawn_monitor(fn ->
      {:ok, _ticket} = Admission.checkout(gate)
      send(parent, {:admitted, self()})
      receive do: (:never_sent -> :ok)
    end)
    on_exit(fn -> if Process.alive?(writer), do: Process.exit(writer, :kill) end)
    assert_receive {:admitted, ^writer}, 5_000
    before = Admission.status(gate)
    assert %{phase: :open, pending: 1, writers: 1} = before
    {:ok, :closing, hold} = Admission.begin_hold(gate, "forced-death", before.generation)
    assert {:error, :admission_closed} = Admission.checkout(gate)
    Process.exit(writer, :kill)
    assert_receive {:DOWN, ^monitor, :process, ^writer, :killed}, 5_000
    await_recovery(gate, System.monotonic_time(:millisecond) + 5_000)
    dead = Admission.status(gate)
    assert %{phase: :recovery_required, pending: 1, writers: 0, dead_writers: 1} = dead
    assert false == Admission.held?(gate, hold)
    assert {:error, :invalid_hold} = Admission.reopen(gate, hold)
    assert {:error, :admission_closed} = Admission.checkout(gate)
    GenServer.stop(gate)

    {:ok, restarted} = Admission.start_link(opts)
    Process.unlink(restarted)
    on_exit(fn -> if Process.alive?(restarted), do: GenServer.stop(restarted) end)
    seen = Admission.status(restarted)
    assert %{phase: :recovery_required, pending: 1, writers: 0} = seen
    assert seen.generation > dead.generation
    refute seen.boot == dead.boot
    assert {:error, :admission_closed} = Admission.checkout(restarted)
    assert {:error, :invalid_hold} = Admission.reopen(restarted, hold)
    assert {:error, :stale_generation} = Admission.recover(restarted, dead.generation, 1)
    assert {:error, :unreconciled} = Admission.recover(restarted, seen.generation, 0)
    assert :ok = Admission.recover(restarted, seen.generation, seen.pending)
    assert %{phase: :open, pending: 0, writers: 0, generation: next} = Admission.status(restarted)
    assert next == seen.generation + 1
    assert {:ok, ticket} = Admission.checkout(restarted)
    assert :ok = Admission.checkin(restarted, ticket)
    IO.puts("C097 forced writer death: killed, recovery retained across restart, stale recovery refused, explicit recovery reopened; journal retained at #{root}")
  end

  defp await_recovery(gate, deadline) do
    cond do
      Admission.status(gate).phase == :recovery_required -> :ok
      System.monotonic_time(:millisecond) >= deadline -> flunk("writer death did not reach recovery")
      true -> Process.sleep(5); await_recovery(gate, deadline)
    end
  end
end
