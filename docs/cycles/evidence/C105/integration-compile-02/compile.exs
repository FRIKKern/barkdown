[release, source, output] = Enum.map(System.argv(), &String.replace(&1, <<92>>, "/"))
Code.prepend_paths(Path.wildcard(Path.join([release, "lib", "*", "ebin"])))
Code.put_compiler_option(:ignore_module_conflict, true)
File.mkdir_p!(output)
for file <- [
  "api/lib/barkpark/media/storage/delete_operation.ex",
  "api/lib/barkpark/tenancy/workspace_bundle/catalog.ex",
  "api/lib/barkpark/tenancy/workspace_bundle.ex"
] do
  for {module, binary} <- Code.compile_file(Path.join(source, file)) do
    File.write!(Path.join(output, Atom.to_string(module) <> ".beam"), binary)
    IO.puts("compiled " <> Atom.to_string(module))
  end
end
for file <- [
  "api/test/barkpark/media/pending_delete_boundary_test.exs",
  "api/test/barkpark/media/media_pending_delete_interrupt_live.exs"
] do
  Code.string_to_quoted!(File.read!(Path.join(source, file)))
  IO.puts("parsed " <> file)
end
