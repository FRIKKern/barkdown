defmodule Barkdown.PrivateWriterSyntaxCatalog do
  # Parses source as data. Never compile/evaluate the inspected application AST.
  # Raw aliases are intentionally unresolved; this is not transitive reachability.
  def inspect_source(source, file) do
    ast = Code.string_to_quoted!(source, columns: true)
    context = %{module: nil, function: nil, file: file}
    walk(ast, context, %{sites: [], definitions: [], aliases: []})
    |> Map.new(fn {key, values} -> {key, Enum.reverse(values)} end)
  end

  defp target({:__aliases__, _, _} = value), do: Macro.to_string(value)
  defp target({:__MODULE__, _, _}), do: "__MODULE__"
  defp target(value) when is_atom(value), do: Atom.to_string(value)
  defp target(_), do: "<dynamic>"

  defp head({:when, _, [first | _]}), do: head(first)
  defp head({name, _, arguments}) when is_atom(name) and is_list(arguments),
    do: Atom.to_string(name) <> "/" <> Integer.to_string(length(arguments))
  defp head({name, _, nil}) when is_atom(name), do: Atom.to_string(name) <> "/0"
  defp head(_), do: "<dynamic>"

  defp category(name) do
    cond do
      name in ["File", "File.Stream", "file"] -> "filesystem-api-site"
      name in ["System", "Port", "os", "erlang"] -> "process-or-runtime-api-site"
      name in ["Task", "Task.Supervisor"] -> "task-api-site"
      name == "<dynamic>" -> "unresolved-target"
      String.contains?(name, ["Renditions", "LocalWrite", "ImageBackend", "Storage", "Media"]) -> "media-layer-site"
      true -> "other-remote-site"
    end
  end

  defp site(context, metadata, receiver, name, arity, kind) do
    raw = target(receiver)
    %{file: context.file, module: context.module, function: context.function,
      line: Keyword.get(metadata, :line, 0), column: Keyword.get(metadata, :column, 0),
      raw_target: raw, name: Atom.to_string(name), source_arity: arity,
      kind: kind, category: category(raw)}
  end

  defp walk({:defmodule, _, [name, body]}, context, result) when is_list(body) do
    walk(Keyword.get(body, :do), %{context | module: target(name), function: nil}, result)
  end

  defp walk({kind, metadata, [first | rest]}, context, result)
      when kind in [:def, :defp, :defmacro, :defmacrop] do
    function = head(first)
    definition = %{file: context.file, module: context.module, function: function,
      line: Keyword.get(metadata, :line, 0), kind: Atom.to_string(kind)}
    result = %{result | definitions: [definition | result.definitions]}
    walk([first | rest], %{context | function: function}, result)
  end

  defp walk({:alias, metadata, arguments}, context, result) do
    declaration = %{file: context.file, module: context.module,
      line: Keyword.get(metadata, :line, 0), raw: Macro.to_string({:alias, metadata, arguments})}
    walk(arguments, context, %{result | aliases: [declaration | result.aliases]})
  end

  defp walk({:&, metadata, [{:/, _, [{{:., _, [receiver, name]}, _, []}, arity]}]}, context, result)
      when is_atom(name) and is_integer(arity) do
    record = site(context, metadata, receiver, name, arity, "remote-capture")
    walk(receiver, context, %{result | sites: [record | result.sites]})
  end

  defp walk({{:., _, [receiver, name]}, metadata, arguments}, context, result)
      when is_atom(name) and is_list(arguments) do
    record = site(context, metadata, receiver, name, length(arguments), "remote-call-syntax")
    walk([receiver | arguments], context, %{result | sites: [record | result.sites]})
  end

  defp walk(values, context, result) when is_list(values),
    do: Enum.reduce(values, result, &walk(&1, context, &2))
  defp walk(value, context, result) when is_tuple(value),
    do: walk(Tuple.to_list(value), context, result)
  defp walk(_, _, result), do: result

  def self_test do
    source = """
    defmodule NeverCompileThisCatalogInput do
      raise "inspected AST must never execute"
      def run(path) do
        File.write!(path, "not executed")
        Task.async(fn -> System.cmd(path, []) end)
        &File.rename/2
      end
    end
    """
    result = inspect_source(source, "synthetic-parser-selftest")
    [{"File", "write!", 2, "remote-call-syntax"},
     {"Task", "async", 1, "remote-call-syntax"},
     {"System", "cmd", 2, "remote-call-syntax"},
     {"File", "rename", 2, "remote-capture"}] =
      Enum.map(result.sites, &{&1.raw_target, &1.name, &1.source_arity, &1.kind})
    true = Enum.all?(result.sites, &(&1.function == "run/1"))
    %{status: "parser-selftest-passed", inspected_body_executed: false, sites: length(result.sites)}
  end
end

[manifest_file, output_file] = System.argv()
false = File.exists?(output_file)
manifest = manifest_file |> File.read!() |> JSON.decode!()
true = length(manifest["files"]) > 0 and length(manifest["files"]) <= 500
self_test = Barkdown.PrivateWriterSyntaxCatalog.self_test()
started = System.monotonic_time(:millisecond)
files = Enum.map(manifest["files"], fn entry ->
  path = entry["file"]
  true = Path.extname(path) in [".ex", ".exs"]
  %{type: :regular, size: size} = File.lstat!(path)
  true = size <= 1_000_000
  bytes = File.read!(path)
  hash = Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)
  true = hash == entry["sha256"]
  parsed = Barkdown.PrivateWriterSyntaxCatalog.inspect_source(bytes, path)
  Map.merge(parsed, %{file: path, sha256: hash, bytes: byte_size(bytes), origin: entry["origin"]})
end)
result = %{status: "bounded-source-syntax-catalog-completed", source_files_executed: false,
  beam_os_pid: System.pid(), self_test: self_test, files: files,
  elapsedMs: System.monotonic_time(:millisecond) - started,
  limits: ["Only listed source files; no repository-wide completeness or runtime writer census",
    "Raw alias targets and source arities only; aliases/imports/apply/macros/generated dispatch unresolved",
    "Remote call syntax and captures are sites, not proof of invocation, physical effect, ownership or settlement",
    "No application AST compile/eval, Barkpark Application/Repo/PostgreSQL/HTTP/renderer/S3 call",
    "No acceptance, reconciliation, recovery permission or source/app/runtime/installer adoption"]}
File.write!(output_file, JSON.encode!(result), [:exclusive])
