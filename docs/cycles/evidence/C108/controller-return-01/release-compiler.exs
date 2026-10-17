root = System.fetch_env!("C108_ROOT")
output = System.fetch_env!("C108_OUTPUT")
bindings = for file <- [Path.join(root, ".git/C108-renderer-positive768/magick-candidate.exs"), Path.join(root, ".git/C108-renderer-preflight1011/renditions-candidate.exs"), Path.join(root, ".git/C108-http-storage-controller1150/media-controller-candidate.exs")], {mod, binary} <- Code.compile_file(file) do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  File.write!(Path.join(Path.dirname(output), inspect(mod) <> ".beam"), binary)
  %{module: inspect(mod), source: file, source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!(file)), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(output, JSON.encode!(%{status: "release_context_compiled_not_executed", cwd: File.cwd!(), compiler_options: inspect(Code.compiler_options()), bindings: bindings, limits: "Three private modules compiled/loaded in actual carried release eval context only. No application/Repo/PG/upload/renderer functions executed; actual full runtime equality and behavior remain unproved."}))
