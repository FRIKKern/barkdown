# Runtime configuration was loaded by the release. Restrict the actual listener;
# PHX_HOST changes generated URLs and does not restrict upstream's bind address.
Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint,
  Keyword.merge(endpoint, server: true,
    http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]),
  persistent: true)
# Private known-system-path refusal candidate, before full application start.
bindings = for file <- ["C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-positive768/magick-candidate.exs", "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-controlled-boundary1511/local-write-candidate.exs", "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-guard-compose1344/renditions-candidate.exs", "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-controlled-boundary1511/checkout-candidate.exs", "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-http-storage-controller1150/media-controller-candidate.exs"], {mod, binary} <- Code.compile_file(file) do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  %{module: inspect(mod), source: file, source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "candidate-bindings.json"), JSON.encode!(bindings))
[{trace_mod, trace_binary}] = Code.compile_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-prepared-sql-eof1683/native-trace.exs")
{:ok, {^trace_mod, trace_md5}} = :beam_lib.md5(trace_binary)
^trace_md5 = trace_mod.module_info(:md5)
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "trace-binding.json"), JSON.encode!(%{module: inspect(trace_mod), source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-prepared-sql-eof1683/native-trace.exs")), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, trace_binary), case: :lower), loaded_md5: Base.encode16(trace_md5, case: :lower), beam_os_pid: System.pid()}))
{:ok, _} = Application.ensure_all_started(:barkpark)
{:ok, fixture} = Task.start(fn -> Code.require_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-prepared-sql-eof1683/fixture.exs") end)
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "fixture-pid.txt"), inspect(fixture))
spawn(fn ->
  monitor = Process.monitor(fixture)
  output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
  write = fn name, value ->
    path = Path.join(output, name <> ".json")
    File.write!(path <> ".writing", JSON.encode!(value), [:exclusive])
    File.rename!(path <> ".writing", path)
  end
  write.("caller-monitor-ready", %{caller: inspect(fixture), monitor: inspect(monitor)})
  receive do
    {:DOWN, ^monitor, :process, ^fixture, reason} ->
      write.("caller-natural-down", %{caller: inspect(fixture), monitor: inspect(monitor), reason: inspect(reason), observed_at: DateTime.utc_now() |> DateTime.to_iso8601()})
  after 90_000 -> raise "Owned fixture natural DOWN timeout"
  end
end)
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
Process.sleep(:infinity)
