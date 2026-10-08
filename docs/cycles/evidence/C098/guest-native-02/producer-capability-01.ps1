param([string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($Output)
if([IO.File]::Exists($taskOutput) -or [IO.Directory]::Exists($taskOutput)){throw 'Output exists'}
$taskParent=[IO.Path]::GetDirectoryName($taskOutput)
if(-not [IO.Directory]::Exists($taskParent)){throw 'Owned parent missing'}
Set-Location -LiteralPath $taskParent
$env:PSModuleAnalysisCachePath=[IO.Path]::Combine($taskParent,'ModuleAnalysisCache')
$taskModuleRoot=[IO.Path]::Combine($PSHOME,'Modules','Hyper-V')
$taskCandidates=@()
if([IO.Directory]::Exists($taskModuleRoot)){
  foreach($taskVersionDir in [IO.Directory]::EnumerateDirectories($taskModuleRoot)){
    $taskVersion=$null
    if(-not [Version]::TryParse([IO.Path]::GetFileName($taskVersionDir),[ref]$taskVersion)){continue}
    if(([IO.DirectoryInfo]::new($taskVersionDir).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){continue}
    $taskLeaf=[IO.Path]::Combine($taskVersionDir,'Hyper-V.psd1')
    if([IO.File]::Exists($taskLeaf)){$taskCandidates += [pscustomobject]@{path=$taskLeaf;version=$taskVersion}}
  }
}
$taskSelected=$taskCandidates|Sort-Object version -Descending|Select-Object -First 1
$taskModulePath=$(if($null -ne $taskSelected){$taskSelected.path}else{[IO.Path]::Combine($taskModuleRoot,'Hyper-V.psd1')})
$taskModule=[pscustomobject]@{path=$taskModulePath;present=[IO.File]::Exists($taskModulePath);imported=$false;candidates=@($taskCandidates|ForEach-Object {[pscustomobject]@{path=$_.path;version=[string]$_.version}})}
$taskService=$null
try {$taskValue=Get-Service -Name vmms -ErrorAction Stop;$taskService=[pscustomobject]@{status='observed';state=[string]$taskValue.Status}}
catch {$taskService=[pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName}}
$taskHost=[pscustomobject]@{status='not-run'};$taskMachines=[pscustomobject]@{status='not-run'};$taskMedia=@()
if($taskModule.present){
  try {Import-Module $taskModulePath;$taskModule.imported=$true}
  catch {$taskModule|Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.GetType().FullName}
  if($taskModule.imported){
    try {$taskValue=Get-VMHost -ErrorAction Stop;$taskHost=[pscustomobject]@{status='observed';virtualHardDiskPath=$taskValue.VirtualHardDiskPath;virtualMachinePath=$taskValue.VirtualMachinePath}}
    catch {$taskHost=[pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName}}
    try {$taskValues=@(Get-VM -ErrorAction Stop);$taskMachines=[pscustomobject]@{status='observed';count=$taskValues.Count;states=@($taskValues|ForEach-Object {[pscustomobject]@{state=[string]$_.State;generation=$_.Generation}})}}
    catch {$taskMachines=[pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName}}
  }
}
if($taskHost.status -eq 'observed'){
  foreach($taskRoot in @($taskHost.virtualHardDiskPath,$taskHost.virtualMachinePath)|Select-Object -Unique){
    if([string]::IsNullOrWhiteSpace($taskRoot)){$taskMedia += [pscustomobject]@{root=$taskRoot;status='not-reported';files=@()};continue}
    try {
      if(-not [IO.Directory]::Exists($taskRoot)){$taskMedia += [pscustomobject]@{root=$taskRoot;status='missing';files=@()};continue}
      $taskInfo=[IO.DirectoryInfo]::new($taskRoot)
      if(($taskInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){$taskMedia += [pscustomobject]@{root=$taskRoot;status='reparse-refused';files=@()};continue}
      $taskFiles=@($taskInfo.EnumerateFiles()|Where-Object {$_.Extension.ToLowerInvariant() -in @('.vhd','.vhdx','.iso')}|ForEach-Object {[pscustomobject]@{extension=$_.Extension;bytes=$_.Length;lastWriteUtc=$_.LastWriteTimeUtc.ToString('o');usableBaseline='unknown'}})
      $taskMedia += [pscustomobject]@{root=$taskRoot;status='observed';files=$taskFiles;recursive=$false}
    } catch {$taskMedia += [pscustomobject]@{root=$taskRoot;status='unreadable';error=$_.Exception.GetType().FullName;files=@()}}
  }
}
$taskResult=[pscustomobject]@{status='recorded';observedAt=[DateTime]::UtcNow.ToString('o');module=$taskModule;service=$taskService;host=$taskHost;machines=$taskMachines;defaultStoreMedia=$taskMedia;guestLaunched=$false;cleanMachineAccepted=$false;installationAccepted=$false;limits=@('Local metadata only, no remote computer or credentials','Existing guests are unowned; names, identifiers and content not collected or operated','Only nonrecursive default-store media metadata; absence there is not absence on the whole machine','Media presence is not OS identity, clean baseline or launch readiness','No feature, service, VM, disk mount or installer operation')}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskResult|ConvertTo-Json -Depth 10)+"`n")
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
