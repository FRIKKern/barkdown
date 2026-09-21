Logger.configure(level: :warning)
# Invoked with mix run --no-start --no-compile. Never uses the checkout's dev DB.
root = System.fetch_env!("BARKDOWN_LOCAL_DATA")
repo = Application.fetch_env!(:barkpark, Barkpark.Repo)
Application.put_env(:barkpark, Barkpark.Repo, Keyword.merge(repo,
  hostname: "127.0.0.1", port: String.to_integer(System.fetch_env!("BARKDOWN_PG_PORT")),
  username: "postgres", password: System.fetch_env!("BARKDOWN_PG_PASSWORD"),
  database: "barkdown", pool_size: 3, show_sensitive_data_on_connection_error: false))
endpoint = Application.fetch_env!(:barkpark, BarkparkWeb.Endpoint)
Application.put_env(:barkpark, BarkparkWeb.Endpoint, Keyword.merge(endpoint,
  server: true, code_reloader: false, debug_errors: false,
  secret_key_base: System.fetch_env!("BARKDOWN_PG_PASSWORD"),
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.fetch_env!("PORT"))]))
Application.put_env(:barkpark, :dev_browser_token, nil)
Mix.Task.run("ecto.create", ["--quiet"])
Mix.Task.run("ecto.migrate", ["--quiet"])
{:ok, _} = Application.ensure_all_started(:barkpark)
unless File.exists?(Path.join(root, "seeded")) do
  Barkpark.Seeds.run()
  File.write!(Path.join(root, "seeded"), "clean\n")
end
File.write!(Path.join(root, "boot-ready"), System.fetch_env!("BARKDOWN_BOOT_ID"))
