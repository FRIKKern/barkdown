param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$source = [IO.Path]::GetFullPath((Join-Path $repo '../barkpark-windows-return'))
$pin = (& git -C $source rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $pin -ne '944a57a1e0b2a210d44e5215c13519a378d6efb8') { throw 'Unexpected upstream pin' }
$status = & git -C $source status --porcelain
if ($LASTEXITCODE -ne 0 -or $status) { throw 'Upstream is not clean' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Output exists; preserve the earlier run' }
$null = New-Item -ItemType Directory -Path $output
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('barkdown-C097-delete-lock-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $fixture
$payload = [Text.Encoding]::UTF8.GetBytes(('Disposable locked original bytes' + [char]10) * 211)
$control = [Text.Encoding]::UTF8.GetBytes(('Distinct acknowledged control' + [char]10) * 223)
foreach ($name in @('normal.bin','locked.bin')) { [IO.File]::WriteAllBytes((Join-Path $fixture $name),$payload) }
[IO.File]::WriteAllBytes((Join-Path $fixture 'control.bin'),$control)
$ebin = Join-Path $source 'api/_build/dev/lib/barkpark/ebin'
$jason = Join-Path $source 'api/_build/dev/lib/jason/ebin'
$script = Join-Path $PSScriptRoot 'media-delete-lock.exs'
$env:PATH = 'C:\Users\Frikk\scoop\apps\elixir\current\bin;C:\Users\Frikk\scoop\apps\erlang\current\bin;' + $env:PATH
$elixir = 'C:\Users\Frikk\scoop\apps\elixir\current\bin\elixir.bat'
$report = [ordered]@{startedAt=[DateTime]::UtcNow.ToString('o');source=(& git -C $repo rev-parse HEAD).Trim();upstream=$pin;status='running';fixture=$fixture;files=@{};steps=@();limits='New disposable files; real compiled local storage modules, no database/server/admission protocol, media row, deferred queue or remote effects. Characterizes an ignored OS error; does not fix it.'}
foreach ($file in @($script,$PSCommandPath,(Join-Path $ebin 'Elixir.Barkpark.Media.Blobstore.Local.beam'),(Join-Path $ebin 'Elixir.Barkpark.Media.beam'),(Join-Path $source 'api/lib/barkpark/media/blobstore/local.ex'),(Join-Path $source 'api/lib/barkpark/media.ex'))) { $report.files[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
function Save-Report { [IO.File]::WriteAllText((Join-Path $output 'result.json'),($report | ConvertTo-Json -Depth 12) + [char]10) }
function Invoke-Probe([string]$Phase) {
  $started = [Diagnostics.Stopwatch]::StartNew()
  & $elixir -pa $ebin -pa $jason $script $fixture (Join-Path $output ($Phase + '.json')) $Phase *> (Join-Path $output ($Phase + '.log'))
  $code = $LASTEXITCODE
  $report.steps += @{name=$Phase;elapsedMs=$started.ElapsedMilliseconds;exitCode=$code}
  Save-Report
  if ($code -ne 0) { throw "Probe failed: $Phase, exit $code" }
}
$lockStream = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
Save-Report
try {
  Invoke-Probe 'normal'
  # Share reads, but explicitly deny Windows delete sharing while this parent
  # owns the handle. The child must observe an actual eacces before calling Local.
  $lockStream = [IO.File]::Open((Join-Path $fixture 'locked.bin'),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  Invoke-Probe 'locked'
  $lockStream.Dispose(); $lockStream = $null
  Invoke-Probe 'released'
  $normal = Get-Content -LiteralPath (Join-Path $output 'normal.json') -Raw | ConvertFrom-Json
  $locked = Get-Content -LiteralPath (Join-Path $output 'locked.json') -Raw | ConvertFrom-Json
  $released = Get-Content -LiteralPath (Join-Path $output 'released.json') -Raw | ConvertFrom-Json
  if ($normal.before.sha256 -ne $locked.before.sha256 -or $locked.after.sha256 -ne $released.before.sha256 -or $normal.control.sha256 -ne $released.control.sha256) { throw 'Cross-process byte continuity mismatch' }
  $report.status = 'passed'
  $report.finding = 'Pinned Local.delete returns :ok while Windows refuses removal and the entire original remains. Releasing the owned handle lets the same call remove it. The distinct control remains unchanged.'
} catch {
  $report.status = 'failed'; $report.error = $_.ToString()
} finally {
  if ($null -ne $lockStream) { $lockStream.Dispose() }
  $report.elapsedMs = $timer.ElapsedMilliseconds
  $report.cleanup = 'Owned file handle released; no server started. Fixture and control retained; ordinary successful deletion calls removed only their designated test originals.'
  Save-Report
}
[pscustomobject]$report | Select-Object status,elapsedMs,fixture,error | ConvertTo-Json
if ($report.status -ne 'passed') { exit 1 }
