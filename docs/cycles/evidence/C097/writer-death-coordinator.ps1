$ErrorActionPreference = 'Stop'
$env:PATH = "$env:USERPROFILE/scoop/apps/elixir/current/bin;$env:USERPROFILE/scoop/apps/erlang/current/bin;$env:PATH"
$env:C097_BP_SOURCE = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../../../barkpark-windows-return'))
$writerProbeTemp = Join-Path ([IO.Path]::GetTempPath()) ('barkdown-C097-coordinator-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $writerProbeTemp | Out-Null
$env:TEMP = $writerProbeTemp
$env:TMP = $writerProbeTemp
& "$env:USERPROFILE/scoop/apps/elixir/current/bin/elixir.bat" (Join-Path $PSScriptRoot 'writer-death-coordinator.exs')
exit $LASTEXITCODE
