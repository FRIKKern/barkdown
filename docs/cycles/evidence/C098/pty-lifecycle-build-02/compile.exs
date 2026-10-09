case Application.load(:expty) do
 :ok -> :ok
 {:error, {:already_loaded, :expty}} -> :ok
end
expected = Path.join(System.fetch_env!("C098_CANDIDATE"), "priv") |> Path.expand()
true = Path.expand(List.to_string(:code.priv_dir(:expty))) == expected
Code.compiler_options(ignore_module_conflict: true)
for name <- ["expty_nif.ex", "expty.ex"], {module, binary} <- Code.compile_file(Path.join(System.fetch_env!("C098_SOURCE"), "lib/" <> name)) do
 File.write!(Path.join(System.fetch_env!("C098_CANDIDATE"), "ebin/" <> Atom.to_string(module) <> ".beam"), binary)
end
true = function_exported?(ExPTY.Nif, :close, 1)
IO.puts("C098_LIFECYCLE_COMPILED")
