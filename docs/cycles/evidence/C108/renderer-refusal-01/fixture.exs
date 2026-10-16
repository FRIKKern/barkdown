# Private known-System32 refusal contract; no actual native renderer may execute.
output = System.fetch_env!("C108_CHECKOUT_OUTPUT")
write = fn name, value ->
  path = Path.join(output, name <> ".json")
  File.write!(path <> ".writing", JSON.encode!(value), [:exclusive])
  File.rename!(path <> ".writing", path)
end
await = fn name ->
  deadline = System.monotonic_time(:millisecond) + 90_000
  Stream.repeatedly(fn ->
    cond do
      File.exists?(Path.join(output, name)) -> true
      System.monotonic_time(:millisecond) >= deadline -> raise("Read-only preflight marker timeout")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
started = System.monotonic_time(:millisecond)
try do
  await.("observe-go")
  modules = for mod <- [Barkpark.Media.ImageBackend, Barkpark.Media.Renditions, Barkpark.Media.Blobstore, Barkpark.ManagedRuntime.WriteAdmission.Door] do
    {:module, ^mod} = Code.ensure_loaded(mod)
    {^mod, binary, path} = :code.get_object_code(mod)
    {:ok, {^mod, md5}} = :beam_lib.md5(binary)
    ^md5 = mod.module_info(:md5)
    %{module: inspect(mod), file: List.to_string(path), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
  end
  backend = Barkpark.Media.ImageBackend.impl()
  magick = System.find_executable("magick")
  convert = System.find_executable("convert")
  config = Application.get_env(:barkpark, Barkpark.Media.ImageBackend.Magick, [])
  explicit = Keyword.get(config, :bin)
  selected = explicit || magick || convert
  {:win32, _} = :os.type()
  true = backend == Barkpark.Media.ImageBackend.Magick
  bindings = Path.join(output, "candidate-bindings.json") |> File.read!() |> JSON.decode!()
  [binding] = bindings
  true = binding["module"] == inspect(backend)
  true = binding["loaded_md5"] == Base.encode16(backend.module_info(:md5), case: :lower)
  false = available = backend.available?()
  destination = Path.join(output, "must-not-render.jpg")
  source = Path.join(output, "source-not-read.bin")
  false = File.exists?(source)
  false = File.exists?(destination)
  spec = %{max_width: 1, max_height: 1, quality: 80, format: "jpg"}
  {:error, :imagemagick_not_found} = backend.render(source, destination, spec, nil)
  false = File.exists?(source)
  false = File.exists?(destination)
  original_config = Application.get_env(:barkpark, backend)
  variants = [selected, String.upcase(selected), String.replace(selected, "/", "\\")]
  checks = try do
    for path <- variants do
      Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, path))
      false = backend.available?()
      {:error, :imagemagick_not_found} = backend.render(source, destination, spec, nil)
      false = File.exists?(destination)
      %{explicit_known_path: path, available: false, returned: "imagemagick_not_found", output_absent: true}
    end
  after
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  false = backend.available?()
  write.("refusal-contract", %{status: "private_known_system_refusal_observed", default_available: false, default_render: "imagemagick_not_found", explicit_known_path_cases: checks, output_absent: true, config_restored: true, no_native_branch_invocation: true, source_not_read: true})
  env_path = System.get_env("PATH", "")
  write.("resolution", %{status: "private_full_runtime_renderer_refusal_observed", backend: inspect(backend), os: inspect(:os.type()), available: available, explicit_bin: explicit, magick_lookup: magick, convert_lookup: convert, selected_by_actual_precedence: selected, timeout_ms: Keyword.get(config, :timeout_ms, 30_000), path_sha256: Base.encode16(:crypto.hash(:sha256, env_path), case: :lower), path_entries: String.split(env_path, ";", trim: true), original_modules: modules, no_renderer_invocation: true, no_upload_or_media_mutation: true})
  await.("resolution-reviewed")
  write.("result", %{status: "private_renderer_refusal_fixture_completed", elapsedMs: System.monotonic_time(:millisecond) - started, no_renderer_invocation: true, limits: "Private bounded known-system-path refusal only; not valid renderer/alias identity/ordinary dedicated legacy compatibility/native child/full adoption."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
