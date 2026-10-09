param([string]$InputFile,[string]$Output)
$ErrorActionPreference='Stop'
$taskOut=[IO.Path]::GetFullPath($Output)
if(Test-Path -LiteralPath $taskOut){throw 'Output exists'}
$null=New-Item -ItemType Directory -Path $taskOut
$taskInput=[IO.File]::ReadAllText([IO.Path]::GetFullPath($InputFile))|ConvertFrom-Json
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/CimCmdlets/CimCmdlets.psd1'
function TaskIdentity([int]$taskId) {
  if($taskId -le 1){throw 'Invalid owned PID'}
  $taskProcess=[Diagnostics.Process]::GetProcessById($taskId)
  try {return [pscustomobject]@{pid=$taskId;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');path=$taskProcess.MainModule.FileName}} finally {$taskProcess.Dispose()}
}
try {
  $taskLauncher=TaskIdentity $taskInput.launcher.pid
  if($taskLauncher.startedAt -ne $taskInput.launcher.startedAt){throw 'Launcher start identity mismatch'}
  if(-not [string]::Equals($taskLauncher.path,$taskInput.launcher.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Launcher executable identity mismatch'}
  $taskBeam=TaskIdentity $taskInput.beamPid
  if(-not [string]::Equals($taskBeam.path,$taskInput.beamPath,[StringComparison]::OrdinalIgnoreCase)){throw 'BEAM executable path mismatch'}
  $taskChain=@();$taskAncestor=$taskBeam.pid;$taskFound=$false
  for($taskDepth=0;$taskDepth -lt 12;$taskDepth++) {
    $taskRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskAncestor)
    if($null -eq $taskRow){throw 'Owned ancestry missing'}
    $taskIdentity=TaskIdentity $taskAncestor
    $taskChain += [pscustomobject]@{pid=$taskAncestor;parentPid=[int]$taskRow.ParentProcessId;startedAt=$taskIdentity.startedAt;path=$taskIdentity.path}
    if($taskAncestor -eq $taskLauncher.pid){if($taskIdentity.startedAt -ne $taskLauncher.startedAt){throw 'Launcher reused'};$taskFound=$true;break}
    $taskAncestor=[int]$taskRow.ParentProcessId
  }
  if(-not $taskFound){throw 'BEAM is outside owned launcher'}
  $taskChild=$null;$taskChildParent=$null
  if($null -ne $taskInput.child) {
    $taskChild=TaskIdentity $taskInput.child.pid
    if($taskChild.startedAt -cne $taskInput.child.startedAt -or -not [string]::Equals($taskChild.path,$taskInput.child.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Terminal child identity mismatch'}
    $taskChildRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskChild.pid)
    if($null -eq $taskChildRow -or $taskChildRow.ParentProcessId -ne $taskBeam.pid){throw 'Terminal child is outside owned BEAM'}
    $taskChildParent=[int]$taskChildRow.ParentProcessId
  }
  $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');launcher=$taskLauncher;ancestry=$taskChain;child=$taskChild;childParentPid=$taskChildParent;targets=@([pscustomobject]@{role='beam';pid=$taskBeam.pid;startedAt=$taskBeam.startedAt;path=$taskBeam.path})}
  [IO.File]::WriteAllText($taskOut+'/result.json',($taskResult|ConvertTo-Json -Depth 8)+"`n",[Text.UTF8Encoding]::new($false))
} catch {
  [IO.File]::WriteAllText($taskOut+'/failure.json',([pscustomobject]@{status='failed';error=$_.Exception.Message}|ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false));throw
}
