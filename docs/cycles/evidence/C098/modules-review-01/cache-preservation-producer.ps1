$ErrorActionPreference='Stop'
$taskWorkspace=[IO.Path]::GetFullPath((Get-Location).Path)
$taskSource=[IO.Path]::GetFullPath((Join-Path $taskWorkspace 'Microsoft'))
$taskContainer=[IO.Path]::GetFullPath((Join-Path $taskWorkspace '.git/c098-modules-cache-preserved-01'))
$taskDestination=Join-Path $taskContainer 'Microsoft'
if($taskSource -ne (Join-Path $taskWorkspace 'Microsoft') -or -not $taskContainer.StartsWith($taskWorkspace+'\.git\',[StringComparison]::OrdinalIgnoreCase)){throw 'Artifact path escaped owned workspace'}
if(Test-Path -LiteralPath $taskContainer){throw 'Preservation output exists'}
$taskFiles=@(Get-ChildItem -LiteralPath $taskSource -Recurse -File -Force)
if($taskFiles.Count -ne 1 -or $taskFiles[0].FullName -ne (Join-Path $taskSource 'Windows/PowerShell/ModuleAnalysisCache')){throw 'Unexpected artifact contents; left untouched'}
if($taskFiles[0].CreationTimeUtc.ToString('o') -notmatch '^2026-10-08T19:41:00\.') {throw 'Artifact time differs from current owned probe'}
$taskHash=(Get-FileHash -LiteralPath $taskFiles[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$null=New-Item -ItemType Directory -Path $taskContainer
$taskReceipt=[pscustomobject]@{status='preserved';observedAt=[DateTime]::UtcNow.ToString('o');source=$taskSource;destination=$taskDestination;file='Windows/PowerShell/ModuleAnalysisCache';bytes=$taskFiles[0].Length;sha256=$taskHash;createdAt=$taskFiles[0].CreationTimeUtc.ToString('o');reason='Native PowerShell created a module-analysis cache relative to cwd under the synthetic device environment. Sole measured cache artifact moved recoverably into private Git metadata; no deletion or account change. Future fixture must set PSModuleAnalysisCachePath to the owned data directory.'}
[IO.File]::WriteAllText((Join-Path $taskContainer 'before-move.json'),($taskReceipt|ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $taskSource -Destination $taskDestination
if(Test-Path -LiteralPath $taskSource){throw 'Original artifact still present'}
if((Get-FileHash -LiteralPath (Join-Path $taskDestination $taskReceipt.file) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash){throw 'Preserved artifact hash differs'}
Copy-Item -LiteralPath (Join-Path $taskContainer 'before-move.json') -Destination 'docs/cycles/evidence/C098/modules-review-01/cache-preservation.json'
Copy-Item -LiteralPath '.git/c098-modules-cache-preserve-01.ps1' -Destination 'docs/cycles/evidence/C098/modules-review-01/cache-preservation-producer.ps1'
Write-Output 'Sole owned PowerShell module cache preserved privately with exact hash.'
