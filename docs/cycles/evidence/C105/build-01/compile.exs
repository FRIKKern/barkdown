[release, source, dest] = System.argv()
Code.prepend_paths(Path.wildcard(Path.join([release,"lib","*","ebin"])))
Code.put_compiler_option(:ignore_module_conflict, true)
for file <- ["api/lib/barkpark/plugins/media/assets.ex", "api/lib/barkpark/media/storage/delete_operation.ex", "api/lib/barkpark/media.ex"] do
  for {module, binary} <- Code.compile_file(Path.join(source,file)) do
    File.write!(Path.join([dest,"ebin",Atom.to_string(module)<>".beam"]), binary)
    IO.puts("compiled "<>Atom.to_string(module))
  end
end
Code.compile_file(Path.join(source,"api/priv/repo/migrations/20261011140000_add_pending_media_delete_operations.exs"))
IO.puts("migration compiled")
