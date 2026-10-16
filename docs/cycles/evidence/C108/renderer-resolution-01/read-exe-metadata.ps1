param([Parameter(Mandatory=$true)][string]$Target)
$ErrorActionPreference = 'Stop'
$metadata = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($Target)
[pscustomobject]@{ FileDescription=$metadata.FileDescription; ProductName=$metadata.ProductName; OriginalFilename=$metadata.OriginalFilename; CompanyName=$metadata.CompanyName; FileVersion=$metadata.FileVersion } | ConvertTo-Json -Compress
