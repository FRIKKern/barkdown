# Runtime configuration was loaded by the release. Restrict the actual listener;
# PHX_HOST changes generated URLs and does not restrict upstream's bind address.
Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint,
  Keyword.merge(endpoint, server: true,
    http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]),
  persistent: true)
# Private test-only source compilation before application start, never copied into release.
variant = System.fetch_env!("C108_CACHE_VARIANT")
unless variant in ["original-controller", "pass-refusal"], do: raise("Unknown private variant")
files = ["C:\\Users\\Frikk\\Documents\\GitHub\\barkdown\\.git/C108-cache-http473/s3-private.exs"] ++ if(variant == "pass-refusal", do: ["C:\\Users\\Frikk\\Documents\\GitHub\\barkdown\\.git/C108-cache-http473/controller-private.exs"], else: [])
bindings = for file <- files, {mod, binary} <- Code.compile_file(file) do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  %{module: inspect(mod), source: file, compiled_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "private-candidate-bindings.json"), JSON.encode!(%{variant: variant, bindings: bindings}))
{:ok, _} = Application.ensure_all_started(:barkpark)
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
Process.sleep(:infinity)
