param([string]$InputFile,[string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($Output)
if([IO.Directory]::Exists($taskOutput)){throw 'Output exists'}
$null=[IO.Directory]::CreateDirectory($taskOutput)
$taskInput=[IO.File]::ReadAllText([IO.Path]::GetFullPath($InputFile))|ConvertFrom-Json
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/NetTCPIP/NetTCPIP.psd1'
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/CimCmdlets/CimCmdlets.psd1'
function TaskIdentity([int]$taskId) {
  if($taskId -le 1){throw 'Invalid target PID'}
  $taskProcess=[Diagnostics.Process]::GetProcessById($taskId)
  try {return [pscustomobject]@{pid=$taskId;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');path=$taskProcess.MainModule.FileName}} finally {$taskProcess.Dispose()}
}
try {
  $taskLauncher=TaskIdentity $taskInput.launcher.pid
  if($taskLauncher.startedAt -ne $taskInput.launcher.startedAt){throw 'Launcher start identity changed'}
  $taskTargets=@();$taskBindings=@()
  foreach($taskSpec in @([pscustomobject]@{role='beam';port=$taskInput.httpPort},[pscustomobject]@{role='postgres';port=$taskInput.pgPort})) {
    if($taskSpec.port -lt 1024 -or $taskSpec.port -gt 65535){throw 'Invalid owned port'}
    $taskRows=@(Get-NetTCPConnection -State Listen -LocalPort $taskSpec.port)
    if($taskRows.Count -ne 1 -or $taskRows[0].LocalAddress -ne '127.0.0.1'){throw 'Expected one owned IPv4 loopback listener'}
    $taskIdentity=TaskIdentity $taskRows[0].OwningProcess
    $taskTargets += [pscustomobject]@{role=$taskSpec.role;pid=$taskIdentity.pid;startedAt=$taskIdentity.startedAt;path=$taskIdentity.path}
    $taskBindings += [pscustomobject]@{role=$taskSpec.role;localAddress=$taskRows[0].LocalAddress;port=$taskSpec.port;pid=$taskIdentity.pid}
  }
  $taskPg=@($taskTargets|Where-Object {$_.role -eq 'postgres'})[0]
  if($taskPg.pid -ne $taskInput.postmasterPid){throw 'Private postmaster PID/listener disagreement'}
  $taskBeam=@($taskTargets|Where-Object {$_.role -eq 'beam'})[0]
  $taskChain=@();$taskAncestor=$taskBeam.pid;$taskFound=$false
  for($taskDepth=0;$taskDepth -lt 12;$taskDepth++) {
    $taskRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskAncestor)
    if($null -eq $taskRow){throw 'Owned ancestor missing'}
    $taskIdentity=TaskIdentity $taskAncestor
    $taskChain += [pscustomobject]@{pid=$taskAncestor;parentPid=[int]$taskRow.ParentProcessId;startedAt=$taskIdentity.startedAt;path=$taskIdentity.path}
    if($taskAncestor -eq $taskLauncher.pid){if($taskIdentity.startedAt -ne $taskLauncher.startedAt){throw 'Launcher PID reused'};$taskFound=$true;break}
    $taskAncestor=[int]$taskRow.ParentProcessId
  }
  if(-not $taskFound){throw 'Listener is outside owned launcher ancestry'}
  if($taskInput.backendPid) {
    $taskBackend=TaskIdentity $taskInput.backendPid
    $taskBackendRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskBackend.pid)
    if($taskBackendRow.ParentProcessId -ne $taskPg.pid){throw 'Held backend is outside owned postmaster'}
    $taskTargets += [pscustomobject]@{role='postgres-backend';pid=$taskBackend.pid;startedAt=$taskBackend.startedAt;path=$taskBackend.path}
  }
  $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');process64=[Environment]::Is64BitProcess;launcher=$taskLauncher;bindings=$taskBindings;ancestry=$taskChain;targets=$taskTargets}
  [IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult|ConvertTo-Json -Depth 9)+"`n",[Text.UTF8Encoding]::new($false))
} catch {
  [IO.File]::WriteAllText($taskOutput+'/failure.json',([pscustomobject]@{status='failed';observedAt=[DateTime]::UtcNow.ToString('o');error=$_.Exception.Message}|ConvertTo-Json -Depth 5)+"`n",[Text.UTF8Encoding]::new($false));throw
}
