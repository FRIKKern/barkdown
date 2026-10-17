# Read-only full-runtime renderer resolution; do not invoke the resolved executable.
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
  modules = for mod <- [Barkpark.Media.ImageBackend, Barkpark.Media.ImageBackend.Magick, Barkpark.Media.Renditions, Barkpark.Media.Blobstore, Barkpark.ManagedRuntime.WriteAdmission.Door] do
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
  available = backend.available?()
  ^available = not is_nil(selected)
  env_path = System.get_env("PATH", "")
  write.("resolution", %{status: "full_runtime_renderer_resolution_observed", backend: inspect(backend), os: inspect(:os.type()), available: available, explicit_bin: explicit, magick_lookup: magick, convert_lookup: convert, selected_by_actual_precedence: selected, timeout_ms: Keyword.get(config, :timeout_ms, 30_000), path_sha256: Base.encode16(:crypto.hash(:sha256, env_path), case: :lower), path_entries: String.split(env_path, ";", trim: true), original_modules: modules, no_renderer_invocation: true, no_upload_or_media_mutation: true})
  await.("resolution-reviewed")
  write.("result", %{status: "read_only_renderer_preflight_completed", elapsedMs: System.monotonic_time(:millisecond) - started, no_renderer_invocation: true, limits: "Actual isolated owned runtime selection/path only; not actual rendition/native-child or host-global support."})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
