defmodule C098BootCompare do
  def differences(a, b, path) when a === b, do: []
  def differences(a, b, path) when is_tuple(a) and is_tuple(b) and tuple_size(a) == tuple_size(b) do
    Enum.flat_map(0..(tuple_size(a)-1), fn index -> differences(elem(a,index),elem(b,index),path ++ [index]) end)
  end
  def differences(a, b, path) when is_list(a) and is_list(b) do
    if a == ~c"$RELEASE_LIB/expty-0.2.1/ebin" and b == ~c"$C098_EXPTY/ebin" do
      [%{path: path, original: List.to_string(a), candidate: List.to_string(b)}]
    else
      true = length(a) == length(b)
      Enum.zip(a,b) |> Enum.with_index() |> Enum.flat_map(fn {{left,right},index} -> differences(left,right,path ++ [index]) end)
    end
  end
  def differences(a, b, path), do: raise("unapproved boot difference #{inspect({path,a,b})}")
end
original = :erlang.binary_to_term(File.read!(System.fetch_env!("C098_ORIGINAL_BOOT")))
candidate = :erlang.binary_to_term(File.read!(System.fetch_env!("C098_PRIVATE_BOOT")))
differences = C098BootCompare.differences(original, candidate, [])
2 = length(differences)
File.write!(Path.join(System.fetch_env!("C098_COMPARE_OUT"),"comparison.json"),:json.encode(%{status: "passed", differences: differences, all_other_terms_equal: true}) |> IO.iodata_to_binary())
IO.puts("C098_BOOT_INDEPENDENT_COMPARISON")
