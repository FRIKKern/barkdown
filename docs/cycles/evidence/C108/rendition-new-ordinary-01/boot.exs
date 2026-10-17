# Runtime configuration was loaded by the release. Restrict the actual listener;
# PHX_HOST changes generated URLs and does not restrict upstream's bind address.
Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint,
  Keyword.merge(endpoint, server: true,
    http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]),
  persistent: true)
# Private known-system-path refusal candidate, before full application start.
bindings = for file <- ["C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-positive768/magick-candidate.exs", "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-preflight1011/renditions-candidate.exs"], {mod, binary} <- Code.compile_file(file) do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  %{module: inspect(mod), source: file, source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "candidate-bindings.json"), JSON.encode!(bindings))
[{trace_mod, trace_binary}] = Code.compile_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-rendition-new-ordinary1030/native-trace.exs")
{:ok, {^trace_mod, trace_md5}} = :beam_lib.md5(trace_binary)
^trace_md5 = trace_mod.module_info(:md5)
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "trace-binding.json"), JSON.encode!(%{module: inspect(trace_mod), source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-rendition-new-ordinary1030/native-trace.exs")), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, trace_binary), case: :lower), loaded_md5: Base.encode16(trace_md5, case: :lower), beam_os_pid: System.pid()}))
{:ok, _} = Application.ensure_all_started(:barkpark)
{:ok, fixture} = Task.start(fn -> Code.require_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-rendition-new-ordinary1030/fixture.exs") end)
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "fixture-pid.txt"), inspect(fixture))
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
Process.sleep(:infinity)
