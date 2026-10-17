[root, output] = System.argv()
actual = JSON.decode!(File.read!(Path.join(root, ".git/C108-native-settlement-positive897/candidate-bindings.json")))
process = JSON.decode!(File.read!(Path.join(root, ".git/C108-native-settlement-positive897/process.json")))
release = process["release"]
paths = [root, Path.join(root, "app"), release, Path.join(release, "bin"), Path.join(release, "releases/0.1.0"), process["fixture"], process["data"], System.fetch_env!("SystemRoot"), Path.join(System.fetch_env!("SystemRoot"), "System32")]
results = for cwd <- paths do
  File.cd!(cwd)
  bindings = for expected <- actual do
    [{mod, binary}] = Code.compile_file(expected["source"])
    {:ok, {^mod, md5}} = :beam_lib.md5(binary)
    ^md5 = mod.module_info(:md5)
    hash = Base.encode16(:crypto.hash(:sha256, binary), case: :lower)
    if hash == expected["binary_sha256"], do: File.write!(Path.join(Path.dirname(output), String.replace(expected["module"], ".", "-") <> ".matched.beam"), binary)
    %{module: expected["module"], binary_sha256: hash, loaded_md5: Base.encode16(md5, case: :lower), exact_full_binary: hash == expected["binary_sha256"]}
  end
  %{cwd: File.cwd!(), bindings: bindings, all_match: Enum.all?(bindings, & &1.exact_full_binary)}
end
File.write!(output, JSON.encode!(%{status: "bounded_cwd_compiler_search", results: results, limits: "Private compiler VM changes its own cwd among nine named existing paths only; no application/Repo/upload/native invocation or file mutation except owned diagnostic outputs."}))
