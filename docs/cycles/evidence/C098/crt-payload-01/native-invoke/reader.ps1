param([string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[System.IO.Path]::GetFullPath($Output)
if(Test-Path -LiteralPath $taskOutput){throw 'Output exists'}
$null=New-Item -ItemType Directory -Path $taskOutput
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'
$taskManifest=Get-Content -LiteralPath '.git/c098-crt-minimum-files-01/result.json' -Raw | ConvertFrom-Json
$taskRows=@()
try {
  foreach($taskFile in $taskManifest.files){
    $taskPath=[System.IO.Path]::GetFullPath('.git/c098-crt-minimum-files-01/'+$taskFile.name)
    $taskInfo=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($taskPath)
    $taskSignature=Get-AuthenticodeSignature -LiteralPath $taskPath
    $taskRows += [pscustomobject]@{name=$taskFile.name;path=$taskPath;declaredVersion=$taskFile.declaredVersion;fileVersion=$taskInfo.FileVersion;productVersion=$taskInfo.ProductVersion;signatureStatus=[string]$taskSignature.Status;signer=$taskSignature.SignerCertificate.Subject;timestampSigner=$taskSignature.TimeStamperCertificate.Subject}
    if($taskInfo.FileVersion -ne $taskFile.declaredVersion){throw 'MSI/resource version disagreement'}
    if($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notlike '*Microsoft Corporation*'){throw 'Required Microsoft signature unavailable'}
  }
  $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');scope='Native version resource and Authenticode inspection; no candidate DLL loaded or installer executed';files=$taskRows}
  [System.IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult | ConvertTo-Json -Depth 7)+"`n",[System.Text.UTF8Encoding]::new($false))
}catch{
  [System.IO.File]::WriteAllText($taskOutput+'/failure.json',([pscustomobject]@{status='failed';error=($_|Out-String);files=$taskRows}|ConvertTo-Json -Depth 7)+"`n",[System.Text.UTF8Encoding]::new($false))
  throw
}
