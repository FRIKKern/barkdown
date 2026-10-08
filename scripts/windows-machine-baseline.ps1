param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [ValidateSet('developer-host','candidate-guest')][string]$Role='candidate-guest'
)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($OutputDirectory)
if(-not [IO.Directory]::Exists($taskOutput)){throw 'Output directory must already exist'}
$taskDirectory=[IO.DirectoryInfo]::new($taskOutput)
if(($taskDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Output directory is a reparse point'}
if([IO.Directory]::EnumerateFileSystemEntries($taskOutput).GetEnumerator().MoveNext()){throw 'Output directory must be empty'}
Set-Location -LiteralPath $taskOutput
$env:PSModuleAnalysisCachePath=[IO.Path]::Combine($taskOutput,'ModuleAnalysisCache')
$taskModules=[IO.Path]::Combine($PSHOME,'Modules')
Import-Module ([IO.Path]::Combine($taskModules,'CimCmdlets','CimCmdlets.psd1'))
Import-Module ([IO.Path]::Combine($taskModules,'Microsoft.PowerShell.Security','Microsoft.PowerShell.Security.psd1'))
function Get-TaskHash([string]$File) {
  $taskHasher=[Security.Cryptography.SHA256]::Create()
  try {return ([BitConverter]::ToString($taskHasher.ComputeHash([IO.File]::ReadAllBytes($File)))).Replace('-','').ToLowerInvariant()}
  finally {$taskHasher.Dispose()}
}
function Get-TaskCim([string]$Class,[string[]]$Properties) {
  try {
    $taskRows=@(Get-CimInstance -ClassName $Class -Property $Properties -OperationTimeoutSec 10)
    $taskValues=@(foreach($taskRow in $taskRows){
      $taskObject=[ordered]@{}
      foreach($taskProperty in $Properties){$taskObject[$taskProperty]=$taskRow.$taskProperty}
      [pscustomobject]$taskObject
    })
    return [pscustomobject]@{status='observed';values=$taskValues}
  } catch {return [pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName;values=@()}}
}
$taskOs=Get-TaskCim 'Win32_OperatingSystem' @('Caption','Version','BuildNumber','OSArchitecture')
$taskComputer=Get-TaskCim 'Win32_ComputerSystem' @('HypervisorPresent','TotalPhysicalMemory')
$taskProcessor=Get-TaskCim 'Win32_Processor' @('NumberOfCores','VMMonitorModeExtensions','SecondLevelAddressTranslationExtensions','VirtualizationFirmwareEnabled')
$taskFeatureNames=@('Containers-DisposableClientVM','Microsoft-Hyper-V-All','Microsoft-Hyper-V','VirtualMachinePlatform','HypervisorPlatform','Microsoft-Windows-Subsystem-Linux')
$taskFeatures=@()
foreach($taskFeatureName in $taskFeatureNames){
  try {
    $taskRows=@(Get-CimInstance -ClassName Win32_OptionalFeature -Filter "Name='$taskFeatureName'" -Property Name,InstallState -OperationTimeoutSec 10)
    $taskFeatures += [pscustomobject]@{name=$taskFeatureName;status=$(if($taskRows.Count){'observed'}else{'not-reported'});values=@($taskRows|ForEach-Object {[pscustomobject]@{name=$_.Name;installState=$_.InstallState}})}
  } catch {$taskFeatures += [pscustomobject]@{name=$taskFeatureName;status='unreadable';error=$_.Exception.GetType().FullName;values=@()}}
}
$taskViews=@();$taskKey='SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
foreach($taskView in @('Registry32','Registry64')) {
  $taskBase=$null;$taskOpened=$null
  try {
    $taskBase=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::$taskView)
    $taskOpened=$taskBase.OpenSubKey($taskKey,$false)
    if($null -eq $taskOpened){$taskViews += [pscustomobject]@{view=$taskView;status='missing';values=@()};continue}
    $taskValues=@();$taskNames=$taskOpened.GetValueNames()
    foreach($taskName in @('Installed','Version','Major','Minor','Bld','Rbld')) {
      if($taskNames -notcontains $taskName){$taskValues += [pscustomobject]@{name=$taskName;present=$false};continue}
      $taskValues += [pscustomobject]@{name=$taskName;present=$true;kind=[string]$taskOpened.GetValueKind($taskName);value=$taskOpened.GetValue($taskName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}
    }
    $taskViews += [pscustomobject]@{view=$taskView;status='present';values=$taskValues}
  } catch {$taskViews += [pscustomobject]@{view=$taskView;status='unreadable';error=$_.Exception.GetType().FullName;values=@()}}
  finally {if($null -ne $taskOpened){$taskOpened.Dispose()};if($null -ne $taskBase){$taskBase.Dispose()}}
}
$taskSystem=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)
$taskFiles=@()
foreach($taskName in @('WindowsSandbox.exe','vmconnect.exe','msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll','ucrtbase.dll')) {
  $taskPath=[IO.Path]::Combine($taskSystem,$taskName)
  if(-not [IO.File]::Exists($taskPath)){$taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='missing'};continue}
  try {
    $taskInfo=[Diagnostics.FileVersionInfo]::GetVersionInfo($taskPath);$taskSignature=Get-AuthenticodeSignature -LiteralPath $taskPath
    $taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='observed';bytes=[IO.FileInfo]::new($taskPath).Length;sha256=(Get-TaskHash $taskPath);fileVersion=$taskInfo.FileVersion;productVersion=$taskInfo.ProductVersion;signatureStatus=[string]$taskSignature.Status;signer=$taskSignature.SignerCertificate.Subject}
  } catch {$taskFiles += [pscustomobject]@{name=$taskName;path=$taskPath;status='unreadable';error=$_.Exception.GetType().FullName}}
}
# Look only for fixed executable names on PATH; do not run discovered developer tools.
$taskTools=@()
foreach($taskName in @('node.exe','git.exe','erl.exe','elixir.bat','psql.exe','mix.bat','npm.cmd','dotnet.exe')) {
  $taskMatches=@()
  foreach($taskPart in ($env:PATH -split ';')) {
    if([string]::IsNullOrWhiteSpace($taskPart)){continue}
    try {$taskCandidate=[IO.Path]::Combine($taskPart.Trim('"'),$taskName);if([IO.File]::Exists($taskCandidate)){$taskMatches += $taskCandidate}}
    catch {}
  }
  $taskTools += [pscustomobject]@{name=$taskName;paths=@($taskMatches|Select-Object -Unique)}
}
$taskResult=[pscustomobject]@{
  version=1;status='recorded';observedAt=[DateTime]::UtcNow.ToString('o');role=$Role
  roleVerified=$false;process64=[Environment]::Is64BitProcess;os64=[Environment]::Is64BitOperatingSystem
  collectorSha256=(Get-TaskHash $PSCommandPath);os=$taskOs;computer=$taskComputer;processors=$taskProcessor
  features=$taskFeatures;systemDirectory=$taskSystem;files=$taskFiles;pathTools=$taskTools
  registration=[pscustomobject]@{hive='HKLM';path=$taskKey;architecture='x64';views=$taskViews}
  sandboxLaunchReady='unknown';cleanMachineAccepted=$false;installationAccepted=$false
  limits=@('Role is a caller label, not guest isolation proof','Fixed-path presence and CIM metadata do not establish launch readiness; policies and pending reboot are unexamined','CRT registration is not a runtime minimum or loader/ABI proof','No app, prerequisite, VM or feature operation; only new owned output/cache written')
}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskResult|ConvertTo-Json -Depth 12)+"`n")
$taskStream=[IO.File]::Open([IO.Path]::Combine($taskOutput,'result.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$taskStream.Write($taskBytes,0,$taskBytes.Length)} finally {$taskStream.Dispose()}
