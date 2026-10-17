source_root = "C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement"
out = "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C109-writer-ast375"
unless Code.ensure_loaded?(JSON), do: raise("Standard-library JSON unavailable")
if File.exists?(out), do: raise("Output already exists; preserve it")
File.mkdir!(out)
File.cp!(__ENV__.file, Path.join(out, "producer.exs"))

defmodule WriterSyntaxInventory do
  @sinks %{
    "File" => ~w(write write! rename rename! cp cp! copy copy! rm rm! rm_rf rm_rf! open open! mkdir mkdir! mkdir_p mkdir_p! ln ln_s),
    "IO" => ~w(binwrite write), "System" => ~w(cmd), "Port" => ~w(open command),
    "Blobstore" => ~w(put_file put_bytes delete ensure_local),
    "Renditions" => ~w(ensure transform delete_for_file),
    "Barkpark.Media.Renditions" => ~w(ensure transform delete_for_file),
    "Door" => ~w(admit admit! admit_or_skip), "LocalWrite" => ~w(run),
    "WriteAdmission" => ~w(checkout_effect uncertain checkin)
  }
  def walk({:defmodule, _, [name, body]}, ctx),
    do: walk(body, Map.put(ctx, :module, Macro.to_string(name)))
  def walk({kind, _, [head, body]}, ctx) when kind in [:def, :defp] do
    name = case head do {:when, _, [head | _]} -> head; other -> other end
    walk(body, Map.put(ctx, :function, Macro.to_string(name)))
  end
  def walk({{:., _, [{:__aliases__, _, parts}, fun]}, meta, args} = node, ctx)
      when is_atom(fun) and is_list(args) do
    mod = Enum.join(parts, ".")
    own = if Atom.to_string(fun) in Map.get(@sinks, mod, []) do
      [%{file: ctx.file, module: ctx.module, function: ctx.function,
        target: mod <> "." <> Atom.to_string(fun), line: meta[:line],
        expression: Macro.to_string(node)}]
    else
      []
    end
    own ++ children(node, ctx)
  end
  def walk(node, ctx) when is_tuple(node), do: children(node, ctx)
  def walk(node, ctx) when is_list(node), do: Enum.flat_map(node, &walk(&1, ctx))
  def walk(_, _), do: []
  defp children(node, ctx), do: node |> Tuple.to_list() |> Enum.flat_map(&walk(&1, ctx))
end

started = System.monotonic_time(:millisecond)
paths = Path.wildcard(Path.join(source_root, "api/lib/barkpark/media/**/*.ex")) ++
  Enum.map(["api/lib/barkpark/media.ex", "api/lib/barkpark_web/controllers/media_controller.ex"], &Path.join(source_root, &1))
paths = Enum.sort(Enum.uniq(paths))
inputs = Enum.map(paths, fn file ->
  bytes = File.read!(file)
  %{file: Path.relative_to(file, source_root), bytes: byte_size(bytes), sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)}
end)
calls = Enum.flat_map(inputs, fn input ->
  file = Path.join(source_root, input.file)
  ast = Code.string_to_quoted!(File.read!(file), file: file, columns: true)
  WriterSyntaxInventory.walk(ast, %{file: input.file, module: nil, function: nil})
end)
Enum.each(inputs, fn input ->
  actual = Base.encode16(:crypto.hash(:sha256, File.read!(Path.join(source_root, input.file))), case: :lower)
  if actual != input.sha256, do: raise("Source changed during parse: " <> input.file)
end)
result = %{at: DateTime.to_iso8601(DateTime.utc_now()), status: "measured",
  elapsed_ms: System.monotonic_time(:millisecond) - started,
  parser: %{elixir: System.version(), otp: to_string(:erlang.system_info(:otp_release))},
  input_files: inputs, selected_calls: calls, files: length(inputs), calls: length(calls),
  original_inputs_unchanged: true,
  limits: "Static literal-module AST calls in the named media owner directory plus media/context controller. Excludes comments, but does not expand macros, resolve all aliases, native/remote effects or every caller. No application modules, databases, renderers or archived binaries were executed. This is a bounded inventory, not a complete writer census or acceptance."}
File.write!(Path.join(out, "result.json"), JSON.encode!(result))
IO.puts(JSON.encode!(%{status: "measured", files: length(inputs), calls: length(calls), elapsed_ms: result.elapsed_ms}))
