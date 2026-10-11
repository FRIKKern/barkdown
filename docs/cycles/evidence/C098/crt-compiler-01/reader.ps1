param([string]$Manifest,[string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[System.IO.Path]::GetFullPath($Output)
if(Test-Path -LiteralPath $taskOutput){throw 'Output exists'}
$null=New-Item -ItemType Directory -Path $taskOutput
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'
$taskFiles=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$taskRows=@()
try {
 foreach($taskFile in $taskFiles){
  $taskPath=[System.IO.Path]::GetFullPath($taskFile.path)
  $taskInfo=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($taskPath)
  $taskSignature=Get-AuthenticodeSignature -LiteralPath $taskPath
  $taskRows += [pscustomobject]@{role=$taskFile.role;path=$taskPath;fileVersion=$taskInfo.FileVersion;productVersion=$taskInfo.ProductVersion;signatureStatus=[string]$taskSignature.Status;signer=$taskSignature.SignerCertificate.Subject}
 }
 $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');scope='Version resource and Authenticode metadata; no compiler, linker or candidate code invoked';files=$taskRows}
 [System.IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult|ConvertTo-Json -Depth 7)+"`n",[System.Text.UTF8Encoding]::new($false))
}catch{
 [System.IO.File]::WriteAllText($taskOutput+'/failure.json',([pscustomobject]@{status='failed';error=($_|Out-String);files=$taskRows}|ConvertTo-Json -Depth 7)+"`n",[System.Text.UTF8Encoding]::new($false))
 throw
}
