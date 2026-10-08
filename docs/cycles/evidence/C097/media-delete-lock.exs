# Characterization of unchanged compiled Windows blobstore behavior. This does
# not start a server, recover admission, touch a library or install a repair.
[root, output, phase] = System.argv()
Application.put_env(:barkpark, :media_upload_dir, root)
alias Barkpark.Media.Blobstore.Local

snapshot = fn name ->
  file = Path.join(root, name)
  case File.read(file) do
    {:ok, bytes} -> %{present: true, bytes: byte_size(bytes), sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)}
    {:error, :enoent} -> %{present: false}
    other -> raise "Unexpected file read: #{inspect(other)}"
  end
end

control = snapshot.("control.bin")
true = control.present
target = if phase == "normal", do: "normal.bin", else: "locked.bin"
before = snapshot.(target)
true = before.present

# The locked case first establishes the OS refusal independently of the
# wrapper. If this unexpectedly succeeds, stop; it is not a lock proof.
raw = if phase == "locked" do
  result = File.rm(Path.join(root, target))
  {:error, :eacces} = result
  result
else
  :not_attempted
end

result = Local.delete(target)
:ok = result
after_delete = snapshot.(target)
if phase == "locked" do
  ^before = after_delete
else
  %{present: false} = after_delete
end
^control = snapshot.("control.bin")

report = %{
  phase: phase,
  raw_delete: inspect(raw),
  returned: inspect(result),
  before: before,
  after: after_delete,
  control: control,
  module: to_string(:code.which(Local)),
  media_module: to_string(:code.which(Barkpark.Media)),
  elixir: System.version(),
  otp: to_string(:erlang.system_info(:otp_release))
}
File.write!(output, Jason.encode!(report, pretty: true) <> "\n")
IO.puts("#{phase}: returned #{inspect(result)}, original present after call=#{after_delete.present}")
