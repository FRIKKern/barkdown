[root, output] = System.argv()
boot = File.read!(Path.join(root, ".git/C108-native-settlement-positive895/boot.exs"))
[_, rest] = String.split(boot, "bindings = for ", parts: 2)
[compile_body, _] = String.split(rest, "File.write!(Path.join(System.fetch_env!", parts: 2)
{bindings, _} = Code.eval_string("bindings = for " <> compile_body)
actual = JSON.decode!(File.read!(Path.join(root, ".git/C108-native-settlement-positive897/candidate-bindings.json")))
for binding <- bindings do
  match = Enum.find(actual, &(&1["module"] == binding.module))
  unless binding.source_sha256 == match["source_sha256"] and binding.loaded_md5 == match["loaded_md5"], do: raise("Source/loaded code identity mismatch")
end
chunks = for binding <- bindings do
  [{mod, binary}] = Code.compile_file(binding.source)
  {:ok, ^mod, all} = :beam_lib.all_chunks(binary)
  name = binding.module |> String.replace(".", "-")
  File.write!(Path.join(Path.dirname(output), name <> ".beam"), binary)
  %{module: binding.module, binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), chunks: for({tag, bytes} <- all, do: %{tag: to_string(tag), bytes: byte_size(bytes), sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})}
end
File.write!(output, JSON.encode!(%{status: "isolated_compiler_cwd_diagnostic", cwd: File.cwd!(), compiler_options: inspect(Code.compiler_options()), bindings: bindings, chunks: chunks, actual_full_runtime: actual, full_binary_matches: Enum.all?(bindings, fn b -> b.binary_sha256 == Enum.find(actual, &(&1["module"] == b.module))["binary_sha256"] end), limits: "Only private modules compiled/loaded and beam chunks retained; no application/Repo/upload/renderer/native invocation."}))
