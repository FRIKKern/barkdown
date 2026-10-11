param([string]$InputFile,[string]$Output)
$ErrorActionPreference='Stop'
if([IO.Directory]::Exists($Output) -or [IO.File]::Exists($Output)){throw 'Output exists'}
$null=[IO.Directory]::CreateDirectory($Output)
$taskInput=[IO.File]::ReadAllText($InputFile)|ConvertFrom-Json
try {
  if($taskInput.target.role -ne 'beam' -or $taskInput.target.pid -le 1){throw 'Unsupported metric target'}
  $taskProcess=[Diagnostics.Process]::GetProcessById([int]$taskInput.target.pid)
  try {
    $taskStart=$taskProcess.StartTime.ToUniversalTime().ToString('o');$taskPath=$taskProcess.MainModule.FileName
    if($taskStart -cne $taskInput.target.startedAt){throw 'Metric start identity mismatch'}
    if(-not [string]::Equals($taskPath,$taskInput.target.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Metric path identity mismatch'}
    $taskProcess.Refresh()
    $taskResult=[pscustomobject]@{status='observed';observedAt=[DateTime]::UtcNow.ToString('o');monotonicTicks=[Diagnostics.Stopwatch]::GetTimestamp();monotonicFrequency=[Diagnostics.Stopwatch]::Frequency;pid=$taskProcess.Id;startedAt=$taskStart;path=$taskPath;cpuTicks=$taskProcess.TotalProcessorTime.Ticks;handleCount=$taskProcess.HandleCount;threadCount=$taskProcess.Threads.Count;privateBytes=$taskProcess.PrivateMemorySize64;workingSetBytes=$taskProcess.WorkingSet64}
  }finally{$taskProcess.Dispose()}
  [IO.File]::WriteAllText($Output+'/result.json',($taskResult|ConvertTo-Json -Depth 6)+"`n",[Text.UTF8Encoding]::new($false))
}catch{[IO.File]::WriteAllText($Output+'/failure.json',([pscustomobject]@{status='refused';error=$_.Exception.Message}|ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false));throw}
