[root, output] = System.argv()
walk = fn recur, a, b, path ->
  cond do
    a == b -> []
    is_map(a) and is_map(b) -> Enum.flat_map(Enum.uniq(Map.keys(a) ++ Map.keys(b)), fn k -> recur.(recur, Map.get(a,k), Map.get(b,k), path <> "/" <> inspect(k)) end)
    is_tuple(a) and is_tuple(b) and tuple_size(a) == tuple_size(b) -> Enum.flat_map(0..(tuple_size(a)-1), fn i -> recur.(recur, elem(a,i), elem(b,i), path <> "/t" <> to_string(i)) end)
    is_list(a) and is_list(b) and length(a) == length(b) -> Enum.zip(a,b) |> Enum.with_index() |> Enum.flat_map(fn {{x,y},i} -> recur.(recur,x,y,path <> "/l" <> to_string(i)) end)
    true -> [%{path: path, isolated: inspect(a, limit: 3, printable_limit: 180), release: inspect(b, limit: 3, printable_limit: 180)}]
  end
end
result = for name <- ["Barkpark-Media-ImageBackend-Magick", "Barkpark-Media-Renditions"] do
  original = File.read!(Path.join(root, ".git/C108-native-binding-cwd907/" <> name <> ".beam"))
  release = File.read!(Path.join(root, ".git/C108-native-binding-release911/" <> name <> ".beam"))
  {:ok, _, a} = :beam_lib.all_chunks(original)
  {:ok, _, b} = :beam_lib.all_chunks(release)
  differences = for {tag, bytes} <- a, bytes != elem(List.keyfind(b, tag, 0), 1) do
    other = elem(List.keyfind(b, tag, 0), 1)
    %{chunk: to_string(tag), diffs: if(tag in [~c"Dbgi",~c"Docs"], do: walk.(walk, :erlang.binary_to_term(bytes), :erlang.binary_to_term(other), ""), else: [%{raw: "Different raw chunk"}])}
  end
  %{module: name, differences: differences}
end
File.write!(output, JSON.encode!(%{status: "exact_chunk_term_differences", result: result, limits: "Retained trusted compiler output bytes decoded only, no application/Repo/native invocation."}))
