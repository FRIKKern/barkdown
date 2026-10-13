[original, candidate, behaviour] = System.argv()
unless Code.ensure_loaded?(Vix.Vips.Image) == false, do: raise("Vix must be absent")
Code.compile_file(behaviour)
refused =
  try do
    Code.compile_file(original)
    false
  rescue
    CompileError -> true
  end
unless refused, do: raise("Original struct pattern unexpectedly compiled")
Code.compile_file(candidate)
unless Code.ensure_loaded?(Barkpark.Media.ImageBackend.Vix), do: raise("Backend missing")
unless Barkpark.Media.ImageBackend.Vix.available?() == false, do: raise("Image must be absent")
IO.puts("original_refused=true repaired_compiles=true image_available=false")
