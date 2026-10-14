$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$artifactPath='C:/Users/Frikk/Documents/GitHub/barkdown/.git/C106 NSIS Chø 04/Barkdown-0.6.0-x64-setup.exe'
$applicationPath='C:/Users/Frikk/Documents/GitHub/barkdown/.git/C106-extract-04/payload/Barkdown.exe'
$installerSignature=Get-AuthenticodeSignature -LiteralPath $artifactPath
$appSignature=Get-AuthenticodeSignature -LiteralPath $applicationPath
$version=(Get-Item -LiteralPath $applicationPath).VersionInfo
[pscustomobject]@{installerSignature=$installerSignature.Status.ToString();appSignature=$appSignature.Status.ToString();product=$version.ProductName;version=$version.ProductVersion;description=$version.FileDescription}|ConvertTo-Json -Compress
