# Runtime configuration was loaded by the release. Restrict the actual listener;
# PHX_HOST changes generated URLs and does not restrict upstream's bind address.
Application.load(:barkpark)
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint,
  Keyword.merge(endpoint, server: true,
    http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]),
  persistent: true)
{:ok, _} = Application.ensure_all_started(:barkpark)
File.write!(Path.join(System.fetch_env!("BARKDOWN_LOCAL_DATA"), "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
Process.sleep(:infinity)
