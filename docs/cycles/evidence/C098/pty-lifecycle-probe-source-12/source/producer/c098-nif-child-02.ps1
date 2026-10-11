$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$taskSelf=[Diagnostics.Process]::GetCurrentProcess()
try {
  $taskIdentity=[pscustomobject]@{pid=$taskSelf.Id;startedAt=$taskSelf.StartTime.ToUniversalTime().ToString('o');path=$taskSelf.MainModule.FileName;cwd=(Get-Location).Path}
  [IO.File]::WriteAllText($env:C098_NIF_CHILD_IDENTITY,($taskIdentity|ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false))
} finally {$taskSelf.Dispose()}
Write-Output ('C098_CARRIED_READY:'+$env:C098_NIF_NONCE)
if($env:C098_NIF_HOLD -eq '1'){[Threading.Thread]::Sleep(60000);exit 99}
$taskLine=[Console]::ReadLine()
if($taskLine -ne $env:C098_NIF_NONCE){throw 'Keyboard fixture nonce mismatch'}
Write-Output ('C098_CARRIED_READ:'+$taskLine)
Write-Output ('C098_CARRIED_SIZE:'+[Console]::WindowWidth+':'+[Console]::WindowHeight)
$taskFinish=[Console]::ReadLine()
if($taskFinish -ne ('finish-'+$env:C098_NIF_NONCE)){throw 'Finish fixture nonce mismatch'}
exit 23
