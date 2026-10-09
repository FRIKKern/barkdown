$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path -LiteralPath '.').Path
$taskCache = (Resolve-Path -LiteralPath 'Microsoft').Path
$taskDestination = Join-Path $taskWorkspace '.git\c102-preserved-module-cache'
if (-not $taskCache.StartsWith($taskWorkspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Cache target escapes workspace' }
if (-not $taskDestination.StartsWith($taskWorkspace + '\.git\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Private destination escapes Git directory' }
if (Test-Path -LiteralPath $taskDestination) { throw 'Private destination exists' }
$taskFiles = @(Get-ChildItem -LiteralPath $taskCache -Recurse -File -Force)
$taskEntryUtc = [DateTimeOffset]::Parse('2026-10-09T05:29:32Z').UtcDateTime
if ($taskFiles.Count -ne 1 -or $taskFiles[0].Name -ne 'ModuleAnalysisCache' -or $taskFiles[0].CreationTimeUtc -lt $taskEntryUtc) { throw 'Unexpected artifact; preserve in place' }
$taskHash = (Get-FileHash -LiteralPath $taskFiles[0].FullName -Algorithm SHA256).Hash.ToLower()
$taskOriginal = $taskFiles[0].FullName
$taskBytes = $taskFiles[0].Length
Move-Item -LiteralPath $taskCache -Destination $taskDestination
$taskSaved = Join-Path $taskDestination 'Windows\PowerShell\ModuleAnalysisCache'
if ((Get-FileHash -LiteralPath $taskSaved -Algorithm SHA256).Hash.ToLower() -ne $taskHash) { throw 'Preserved bytes differ' }
[ordered]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');generatedDuring='C102 isolated Windows native run';previousPath=$taskOriginal;preservedPath=$taskSaved;bytes=$taskBytes;sha256=$taskHash;deleted=$false} | ConvertTo-Json | Set-Content -LiteralPath 'docs/cycles/evidence/C102/manifest-01/generated-cache-preserved.json' -Encoding UTF8
Copy-Item -LiteralPath '.git/c102-preserve-cache-02.ps1' -Destination 'docs/cycles/evidence/C102/manifest-01/preserve-cache-producer.ps1'
Write-Output 'Owned module cache preserved privately, bytes exact'
