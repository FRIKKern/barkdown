for file <- System.argv() do
 formatted = file |> File.read!() |> Code.format_string!() |> IO.iodata_to_binary()
 File.write!(file, formatted<>"\n")
end
