[fixture, output] = System.argv()
source = File.read!(fixture)
ast = Code.string_to_quoted!(source)
wrapped = quote do
  defmodule Barkdown.PrivateCheckoutContractsCompileOnly do
    def run do
      unquote(ast)
    end
  end
end
[{mod, binary}] = Code.compile_quoted(wrapped, fixture)
{:ok, {^mod, md5}} = :beam_lib.md5(binary)
^md5 = mod.module_info(:md5)
File.write!(output, JSON.encode!(%{status: "compiled_not_executed", module: inspect(mod), fixture: fixture, source_sha256: Base.encode16(:crypto.hash(:sha256, source), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower), limits: "Exact fixture body wrapped in a private run function for compiler validation only; run never called, no application/Repo/HTTP/fixture effects. Actual ordinary contracts NOT executed."}))
