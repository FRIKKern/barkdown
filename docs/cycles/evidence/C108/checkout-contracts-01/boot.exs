# Runtime configuration was loaded by the release. Restrict the actual listener;
# PHX_HOST changes generated URLs and does not restrict upstream's bind address.
Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint,
  Keyword.merge(endpoint, server: true,
    http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]),
  persistent: true)
# Private observer compilation: loaded binaries bound before full application starts.
bindings = for file <- ["C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-checkout-contract549/checkout-observed.exs","C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-checkout-contract549/renditions-observed.exs"], {mod, binary} <- Code.compile_file(file) do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  %{module: inspect(mod), source: file, source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower), compiled_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "bindings.json"), JSON.encode!(bindings))
{:ok, _} = Application.ensure_all_started(:barkpark)
{:ok, fixture} = Task.start(fn -> Code.require_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-checkout-contract549/fixture.exs") end)
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "fixture-pid.txt"), inspect(fixture))
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
Process.sleep(:infinity)
