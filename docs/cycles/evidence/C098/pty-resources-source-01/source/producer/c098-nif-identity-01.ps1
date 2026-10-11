param([string]$InputFile,[string]$Output)
$ErrorActionPreference='Stop'
$taskOut=[IO.Path]::GetFullPath($Output)
if(Test-Path -LiteralPath $taskOut){throw 'Output exists'}
$null=New-Item -ItemType Directory -Path $taskOut
$taskInput=[IO.File]::ReadAllText([IO.Path]::GetFullPath($InputFile))|ConvertFrom-Json
$taskRows=@()
foreach($taskId in $taskInput.pids) {
  if($taskId -le 1){throw 'Invalid explicit PID'}
  try {$taskProcess=[Diagnostics.Process]::GetProcessById([int]$taskId)} catch [ArgumentException] {$taskRows += [pscustomobject]@{pid=$taskId;status='absent'};continue}
  try {$taskRows += [pscustomobject]@{pid=$taskId;status='observed';startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');path=$taskProcess.MainModule.FileName}} finally {$taskProcess.Dispose()}
}
[IO.File]::WriteAllText($taskOut+'/result.json',([pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');targets=$taskRows}|ConvertTo-Json -Depth 6)+"`n",[Text.UTF8Encoding]::new($false))
