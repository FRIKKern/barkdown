param([string]$Output)
$ErrorActionPreference='Stop'
if([IO.File]::Exists($Output)){throw 'Output exists'}
Set-Location -LiteralPath ([IO.Path]::GetDirectoryName($Output))
$env:PSModuleAnalysisCachePath=[IO.Path]::Combine([IO.Path]::GetDirectoryName($Output),'ModuleAnalysisCache')
Import-Module ([IO.Path]::Combine($PSHOME,'Modules','Hyper-V','2.0.0.0','Hyper-V.psd1'))
$taskResult=$null
try {$null=Get-VMHost -ErrorAction Stop;$taskResult=[pscustomobject]@{status='observed';changedSincePrior=$true}}
catch {
  $taskChain=@();$taskException=$_.Exception
  while($null -ne $taskException){$taskChain += [pscustomobject]@{type=$taskException.GetType().FullName;hresult=$taskException.HResult};$taskException=$taskException.InnerException}
  $taskResult=[pscustomobject]@{status='unreadable';category=[string]$_.CategoryInfo.Category;reason=[string]$_.CategoryInfo.Reason;fullyQualifiedErrorId=$_.FullyQualifiedErrorId;exceptions=$taskChain}
}
[IO.File]::WriteAllText($Output,($taskResult|ConvertTo-Json -Depth 8)+"`n",[Text.UTF8Encoding]::new($false))
