# Actual direct Magick positive only. Not a rendition caller/fence/native PID proof.
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
      System.monotonic_time(:millisecond) >= deadline -> raise("Actual renderer positive marker timeout")
      true -> Process.sleep(20); false
    end
  end) |> Enum.find(& &1)
end
started = System.monotonic_time(:millisecond)
try do
  await.("render-go")
  backend = Barkpark.Media.ImageBackend.impl()
  true = backend == Barkpark.Media.ImageBackend.Magick
  [binding] = Path.join(output, "candidate-bindings.json") |> File.read!() |> JSON.decode!()
  true = binding["loaded_md5"] == Base.encode16(backend.module_info(:md5), case: :lower)
  original_config = Application.get_env(:barkpark, backend)
  source = Path.join(output, "original.png")
  destination = Path.join(output, "rendered.jpg")
  payload = Base.decode64!("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=")
  File.write!(source, payload, [:exclusive])
  false = File.exists?(destination)
  result = try do
    Application.put_env(:barkpark, backend, Keyword.put(original_config || [], :bin, System.fetch_env!("C108_IMAGE_BIN")))
    true = backend.available?()
    backend.render(source, destination, %{max_width: 320, max_height: 320, quality: 80, format: "jpg"}, nil)
  after
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  :ok = result
  ^payload = File.read!(source)
  bytes = File.read!(destination)
  <<255, 216, _::binary>> = bytes
  true = byte_size(bytes) > 10
  write.("render-result", %{status: "actual_direct_renderer_positive_observed", returned: "ok", source: source, destination: destination, source_sha256: Base.encode16(:crypto.hash(:sha256, payload), case: :lower), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower), output_bytes: byte_size(bytes), config_restored: true, executable: System.fetch_env!("C108_IMAGE_BIN"), limits: "Actual direct backend output only; Node must validate JPEG dimensions. Not caller/fence/native PID/loaded DLL/decode quality/owner-loss acceptance."})
  await.("render-reviewed")
  write.("result", %{status: "actual_direct_renderer_positive_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
