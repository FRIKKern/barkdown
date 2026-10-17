param([Parameter(Mandatory=$true)][string]$OwnedRoot,[Parameter(Mandatory=$true)][string]$Target,[Parameter(Mandatory=$true)][string]$Ready)
$ErrorActionPreference='Stop'
$rootPath=[IO.Path]::GetFullPath($OwnedRoot).TrimEnd('\')+'\'
$targetPath=[IO.Path]::GetFullPath($Target)
$readyPath=[IO.Path]::GetFullPath($Ready)
if(-not $targetPath.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)){throw 'Target escapes owned media root'}
if(-not [IO.File]::Exists($targetPath)){throw 'Owned target missing'}
if([IO.File]::Exists($readyPath)){throw 'Ready receipt already exists'}
$stream=$null
try {
  $stream=[IO.FileStream]::new($targetPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $proc=Get-Process -Id $PID
  $receipt=@{pid=$PID;startedAt=$proc.StartTime.ToUniversalTime().ToString('o');executable=$proc.Path;target=$targetPath;ownedRoot=$rootPath;share='Read';length=$stream.Length}
  [IO.File]::WriteAllText($readyPath,($receipt|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  Write-Output 'owned-lock-ready'
  $null=[Console]::In.ReadLine()
} finally {
  if($null -ne $stream){$stream.Dispose()}
  Write-Output 'owned-lock-released'
}
