import fs from 'node:fs';
const ps='.git/c098-guest-provider-01.ps1';
const t=`param([string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($Output)
if([IO.File]::Exists($taskOutput)){throw 'Output exists'}
$taskParent=[IO.Path]::GetDirectoryName($taskOutput)
Set-Location -LiteralPath $taskParent
$env:PSModuleAnalysisCachePath=[IO.Path]::Combine($taskParent,'ModuleAnalysisCache')
Import-Module ([IO.Path]::Combine($PSHOME,'Modules','CimCmdlets','CimCmdlets.psd1'))
function Get-TaskError($Record){
  $taskChain=@();$taskException=$Record.Exception
  while($null -ne $taskException){$taskChain += [pscustomobject]@{type=$taskException.GetType().FullName;hresult=$taskException.HResult};$taskException=$taskException.InnerException}
  return [pscustomobject]@{category=[string]$Record.CategoryInfo.Category;reason=[string]$Record.CategoryInfo.Reason;fullyQualifiedErrorId=$Record.FullyQualifiedErrorId;exceptions=$taskChain}
}
$taskQueries=@()
foreach($taskQuery in @(
  [pscustomobject]@{name='host-defaults';class='Msvm_VirtualSystemManagementServiceSettingData';properties=@('DefaultVirtualHardDiskPath','DefaultExternalDataRoot');filter=$null},
  [pscustomobject]@{name='guest-states';class='Msvm_ComputerSystem';properties=@('EnabledState');filter="Caption='Virtual Machine'"}
)){
  try {
    $taskArgs=@{Namespace='Root/Virtualization/V2';ClassName=$taskQuery.class;Property=$taskQuery.properties;OperationTimeoutSec=10;ErrorAction='Stop'}
    if($taskQuery.filter){$taskArgs.Filter=$taskQuery.filter}
    $taskInstances=@(Get-CimInstance @taskArgs)
    $taskValues=@(foreach($taskInstance in $taskInstances){$taskSelected=[ordered]@{};foreach($taskProperty in $taskQuery.properties){$taskSelected[$taskProperty]=$taskInstance.$taskProperty};[pscustomobject]$taskSelected})
    $taskQueries += [pscustomobject]@{name=$taskQuery.name;status='observed';values=$taskValues}
  } catch {$taskQueries += [pscustomobject]@{name=$taskQuery.name;status='unreadable';values=@();error=(Get-TaskError $_)}}
}
$taskResult=[pscustomobject]@{status='recorded';observedAt=[DateTime]::UtcNow.ToString('o');namespace='Root/Virtualization/V2';queries=$taskQueries;guestLaunched=$false;installationAccepted=$false;limits=@('Selected local provider metadata only; no VM identifiers/names/content','Unsuccessful query is unreadable, not empty inventory','No remote session, alternate credentials, elevation or method invocation')}
[IO.File]::WriteAllText($taskOutput,($taskResult|ConvertTo-Json -Depth 12)+"\u0060n",[Text.UTF8Encoding]::new($false))
`;
fs.writeFileSync(ps,t);
let n=fs.readFileSync('.git/c098-guest-native-02.mjs','utf8').replaceAll('guest-native-02','guest-provider-01').replaceAll('c098-guest-capability-01.ps1','c098-guest-provider-01.ps1');fs.writeFileSync('.git/c098-guest-provider-01.mjs',n);
console.log('Prepared read-only provider query with structured error metadata');
