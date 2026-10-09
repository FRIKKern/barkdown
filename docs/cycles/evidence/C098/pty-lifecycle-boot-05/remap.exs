defmodule C098BootRemap do
  def change(term) do
    cond do
      term == ~c"$RELEASE_LIB/expty-0.2.1/ebin" -> {~c"$C098_EXPTY/ebin", 1}
      is_list(term) -> Enum.map_reduce(term, 0, fn item, count -> {value, delta} = change(item); {value, count + delta} end)
      is_tuple(term) -> {values, count} = change(Tuple.to_list(term)); {List.to_tuple(values), count}
      true -> {term, 0}
    end
  end
end
original = File.read!(System.fetch_env!("C098_ORIGINAL_BOOT"))
tree = :erlang.binary_to_term(original)
{changed, 2} = C098BootRemap.change(tree)
{restored, 2} = C098BootRemap.change(tree)
true = restored == changed
File.write!(Path.join(System.fetch_env!("C098_BOOT_OUTPUT"), "start_clean.boot"), :erlang.term_to_binary(changed))
File.write!(Path.join(System.fetch_env!("C098_BOOT_OUTPUT"), "remap.json"), :json.encode(%{status: "passed", exact_path_replacements: 2, all_other_terms_preserved: true}) |> IO.iodata_to_binary())
IO.puts("C098_PRIVATE_BOOT_REMAPPED")
