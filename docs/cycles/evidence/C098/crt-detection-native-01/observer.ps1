param([string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($Output)
if([IO.Directory]::Exists($taskOutput)){throw 'Output exists'}
$null=[IO.Directory]::CreateDirectory($taskOutput)
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'
$taskViews=@()
$taskKey='SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
foreach($taskView in @('Registry32','Registry64')) {
  $taskBase=$null; $taskOpened=$null
  try {
    $taskBase=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::$taskView)
    $taskOpened=$taskBase.OpenSubKey($taskKey,$false)
    if($null -eq $taskOpened){$taskViews += [pscustomobject]@{view=$taskView;status='missing';values=@()};continue}
    $taskValues=@()
    $taskNames=$taskOpened.GetValueNames()
    foreach($taskName in @('Installed','Version','Major','Minor','Bld','Rbld')) {
      if($taskNames -notcontains $taskName){$taskValues += [pscustomobject]@{name=$taskName;present=$false};continue}
      $taskValues += [pscustomobject]@{name=$taskName;present=$true;kind=[string]$taskOpened.GetValueKind($taskName);value=$taskOpened.GetValue($taskName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}
    }
    $taskViews += [pscustomobject]@{view=$taskView;status='present';values=$taskValues}
  } catch {
    $taskViews += [pscustomobject]@{view=$taskView;status='unreadable';error=$_.Exception.GetType().FullName;values=@()}
  } finally { if($null -ne $taskOpened){$taskOpened.Dispose()};if($null -ne $taskBase){$taskBase.Dispose()} }
}
$taskSystem=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)
$taskFiles=@()
foreach($taskName in @('msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll')) {
  $taskPath=[IO.Path]::Combine($taskSystem,$taskName)
  if(-not [IO.File]::Exists($taskPath)){$taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='missing'};continue}
  try {
    $taskBytes=[IO.File]::ReadAllBytes($taskPath);$taskHasher=[Security.Cryptography.SHA256]::Create()
    try {$taskHash=([BitConverter]::ToString($taskHasher.ComputeHash($taskBytes))).Replace('-','').ToLowerInvariant()} finally {$taskHasher.Dispose()}
    $taskInfo=[Diagnostics.FileVersionInfo]::GetVersionInfo($taskPath)
    $taskSignature=Get-AuthenticodeSignature -LiteralPath $taskPath
    $taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='observed';bytes=$taskBytes.Length;sha256=$taskHash;fileVersion=$taskInfo.FileVersion;productVersion=$taskInfo.ProductVersion;signatureStatus=[string]$taskSignature.Status;signer=$taskSignature.SignerCertificate.Subject}
  } catch {$taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='unreadable';error=$_.Exception.GetType().FullName}}
}
$taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');process64=[Environment]::Is64BitProcess;os64=[Environment]::Is64BitOperatingSystem;registration=[pscustomobject]@{hive='HKLM';path=$taskKey;architecture='x64';views=$taskViews};systemDirectory=$taskSystem;files=$taskFiles;limits=@('Read-only developer-host metadata; no DLL loaded, copied or installer executed','Registration is not minimum-version selection, loader compatibility or clean-machine installation proof')}
[IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult|ConvertTo-Json -Depth 9)+"`n",[Text.UTF8Encoding]::new($false))
