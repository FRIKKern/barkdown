alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
alias Barkpark.ManagedRuntime.WriteAdmission.Door
alias Barkpark.Media.Blobstore.S3

# Test-only integration candidate, not a change to the frozen backend.
# All returned errors conservatively remain uncertain here; classification is
# intentionally unresolved. No pending-delete DB lock or native identity claim.
defmodule CacheEffectCandidate do
  alias Barkpark.ManagedRuntime.WriteAdmission, as: Admission
  alias Barkpark.ManagedRuntime.WriteAdmission.Door
  def run(fun) do
    server = Door.server()
    case Admission.checkout_effect(server) do
      {:ok, ticket} ->
        try do
          result = fun.()
          case result do
            {:ok, _} -> :ok = Admission.checkin(server, ticket)
            _ -> :ok = Admission.uncertain(server, ticket)
          end
          result
        catch
          kind, reason ->
            Admission.uncertain(server, ticket)
            :erlang.raise(kind, reason, __STACKTRACE__)
        end
      {:error, reason} -> {:error, {:write_admission, reason}}
    end
  end
end

[output, endpoint] = System.argv()
root = Path.join(output, "synthetic-fixture")
if File.exists?(root), do: raise("Fixture exists; preserve it")
File.mkdir!(root)
media = Path.join(root, "media")
File.mkdir!(media)
original = Path.join(root, "original.bin")
File.write!(original, "Synthetic original retained across private cache admission proof")
hash = fn file -> Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower) end
original_hash = hash.(original)
payload = "Synthetic delayed cache bytes; no real media"
Application.put_env(:barkpark, :media_upload_dir, media)
Application.put_env(:barkpark, :media_storage, backend: :s3,
  s3: [endpoint: endpoint, bucket: "synthetic-cache-prototype", region: "synthetic-region",
    access_key_id: "synthetic-access", secret_access_key: "synthetic-secret"])
{:ok, _} = Application.ensure_all_started(:req)
started = System.monotonic_time(:millisecond)
parent = self()
checks_key = :prototype_checks
Process.put(checks_key, [])
record = fn item -> Process.put(checks_key, Process.get(checks_key) ++ [item]) end
view = fn gate -> Map.take(Admission.status(gate), [:phase, :pending, :writers, :dead_writers, :generation]) end
await_file = fn file ->
  until = System.monotonic_time(:millisecond) + 10_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(file) -> true
      System.monotonic_time(:millisecond) >= until -> raise("Object request did not arrive")
      true -> Process.sleep(10); false
    end
  end) |> Enum.find(& &1)
end
await_phase = fn gate, phase ->
  until = System.monotonic_time(:millisecond) + 5_000
  Stream.repeatedly(fn ->
    state = view.(gate)
    cond do
      state.phase == phase -> state
      System.monotonic_time(:millisecond) >= until -> raise("Coordinator phase timed out")
      true -> Process.sleep(10); false
    end
  end) |> Enum.find(& &1)
end
start_gate = fn label ->
  instance = "cache-prototype-" <> label <> "-" <> Base.encode16(:crypto.strong_rand_bytes(6), case: :lower)
  journal = Path.join(root, label <> ".dets")
  Application.put_env(:barkpark, :write_admission, enabled: true, instance_id: instance)
  {:ok, gate} = Admission.start_link(journal: journal, instance_id: instance, initialize: true)
  Process.unlink(gate)
  {gate, instance, journal}
end
gates_key = :owned_prototype_gates
Process.put(gates_key, [])
own = fn gate -> Process.put(gates_key, [gate | Process.get(gates_key)]) end
try do
  {gate, _, _} = start_gate.("settled")
  own.(gate)
  delayed = "uploads/2026/10/delayed.svg"
  full = Barkpark.Media.file_path(delayed)
  writer = spawn(fn -> send(parent, {:finished, self(), CacheEffectCandidate.run(fn -> S3.ensure_local(delayed) end)}) end)
  await_file.(Path.join(output, "delayed.arrived"))
  %{phase: :open, pending: 1, writers: 1} = open = view.(gate)
  %{generation: gen} = Admission.status(gate)
  {:ok, :closing, hold} = Admission.begin_hold(gate, "candidate-cache-drain", gen)
  false = Admission.held?(gate, hold)
  cold = "uploads/2026/10/refused-cold/missing.svg"
  false = File.exists?(Path.dirname(Barkpark.Media.file_path(cold)))
  {:error, {:write_admission, :admission_closed}} = CacheEffectCandidate.run(fn -> S3.ensure_local(cold) end)
  false = File.exists?(Path.dirname(Barkpark.Media.file_path(cold)))
  %{phase: :closing, pending: 1, writers: 1} = closing = view.(gate)
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/delayed")
  receive do
    {:finished, ^writer, {:ok, ^full}} -> :ok
  after 10_000 -> raise("Cache candidate did not settle") end
  ^payload = File.read!(full)
  %{phase: :held, pending: 0, writers: 0} = held = await_phase.(gate, :held)
  true = Admission.held?(gate, hold)
  record.(%{name: "Private candidate refuses a new cold fill before mkdir and keeps an in-flight real download counted through cache settlement", open: open, closing: closing, held: held, cache_sha256: hash.(full), cold_parent_absent: true})
  GenServer.stop(gate)

  {death_gate, death_instance, journal} = start_gate.("owner-death")
  own.(death_gate)
  interrupted = "uploads/2026/10/interrupted.svg"
  interrupted_full = Barkpark.Media.file_path(interrupted)
  victim = spawn(fn -> CacheEffectCandidate.run(fn -> S3.ensure_local(interrupted) end) end)
  monitor = Process.monitor(victim)
  await_file.(Path.join(output, "interrupted.arrived"))
  %{phase: :open, pending: 1, writers: 1} = before_death = view.(death_gate)
  Process.exit(victim, :kill)
  receive do {:DOWN, ^monitor, :process, ^victim, :killed} -> :ok after 5000 -> raise("Owned writer did not die") end
  %{phase: :recovery_required, pending: 1, writers: 0} = dead = await_phase.(death_gate, :recovery_required)
  {:ok, %{status: 200}} = Req.get(endpoint <> "/control/release/interrupted")
  false = File.exists?(interrupted_full)
  [] = Path.wildcard(interrupted_full <> ".part-*")
  GenServer.stop(death_gate)
  {:ok, restarted} = Admission.start_link(journal: journal, instance_id: death_instance)
  Process.unlink(restarted)
  own.(restarted)
  %{phase: :recovery_required, pending: 1, writers: 0} = persisted = view.(restarted)
  {:error, :admission_closed} = Admission.begin_hold(restarted, "forbidden-clean-hold", persisted.generation)
  record.(%{name: "Owner death during real Req download retains pending uncertainty across coordinator restart; no recovery is invoked", before: before_death, after: dead, restarted: persisted, cache_absent: true, partials: []})
  GenServer.stop(restarted)

  {error_gate, _, _} = start_gate.("controlled-error")
  own.(error_gate)
  {:error, :not_found} = CacheEffectCandidate.run(fn -> S3.ensure_local("uploads/2026/10/missing.svg") end)
  %{phase: :recovery_required, pending: 1, writers: 1} = conservative = view.(error_gate)
  record.(%{name: "Conservative prototype treats controlled404 as uncertainty; this unresolved policy is not accepted as production behavior", state: conservative})
  ^original_hash = hash.(original)
  modules = Enum.map([Admission, Door, S3, Barkpark.Media], fn mod ->
    file = mod |> :code.which() |> to_string()
    %{module: inspect(mod), file: file, sha256: hash.(file)}
  end)
  result = %{status: "private_candidate_observed", at: DateTime.to_iso8601(DateTime.utc_now()), elapsed_ms: System.monotonic_time(:millisecond) - started,
    checks: Process.get(checks_key), modules: modules, root: root, original: original, original_sha256: original_hash,
    limits: "Test-only wrapper around the existing compiled coordinator and S3 helper. Frozen source is unchanged. No pending-delete database lock, NTFS identity, native child, general caller coverage or production repair/adoption is established. Controlled404 deliberately retains uncertainty and needs a reviewed settlement policy. No database, real account/library, recovery, cleanup, merge or deployment."}
  File.write!(Path.join(output, "result.json"), JSON.encode!(result))
  IO.puts(JSON.encode!(Map.take(result, [:status, :elapsed_ms])))
after
  for gate <- Process.get(gates_key), Process.alive?(gate), do: GenServer.stop(gate)
end
