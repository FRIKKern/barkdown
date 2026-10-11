# Select supported Windows release options without editing the pinned upstream project.
Mix.start()
Mix.env(:prod)
[api, build, output] = System.argv()
Mix.Project.in_project(:barkpark, api,
  [build_path: build, releases: [barkpark: [include_executables_for: [:windows], include_erts: true, steps: [:assemble]]]],
  fn _ ->
    Mix.Task.run("loadconfig")
    versions = %{elixir: System.version(), otp: System.otp_release(), erts: :erlang.system_info(:version) |> List.to_string()}
    Mix.Task.run("deps.get", ["--only", "prod", "--check-locked"])
    Mix.Task.run("release", ["barkpark", "--path", output])
    File.write!(Path.join(build, "toolchain.json"), Jason.encode!(versions))
  end)
