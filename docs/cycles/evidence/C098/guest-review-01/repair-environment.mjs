import fs from 'node:fs';
let ps=fs.readFileSync('.git/c098-guest-capability-local-01.ps1','utf8');
ps=ps.replace("$taskHost=[pscustomobject]@{status='not-run'}",`function Get-TaskDiagnostic($Record){
  $taskMessage=$Record.Exception.Message
  foreach($taskIdentity in @([Environment]::MachineName,$env:USERNAME,$env:USERDOMAIN)){
    if(-not [string]::IsNullOrWhiteSpace($taskIdentity)){$taskMessage=$taskMessage.Replace($taskIdentity,'<identity>')}
  }
  return [pscustomobject]@{category=[string]$Record.CategoryInfo.Category;fullyQualifiedErrorId=$Record.FullyQualifiedErrorId;type=$Record.Exception.GetType().FullName;message=$taskMessage;innerType=$(if($Record.Exception.InnerException){$Record.Exception.InnerException.GetType().FullName}else{$null});innerHresult=$(if($Record.Exception.InnerException){$Record.Exception.InnerException.HResult}else{$null})}
}
$taskHost=[pscustomobject]@{status='not-run'}`);
ps=ps.replace("$taskHost=[pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName}","$taskHost=[pscustomobject]@{status='unreadable';error=(Get-TaskDiagnostic $_)}").replace("$taskMachines=[pscustomobject]@{status='unreadable';error=$_.Exception.GetType().FullName}","$taskMachines=[pscustomobject]@{status='unreadable';error=(Get-TaskDiagnostic $_)}");
fs.writeFileSync('.git/c098-guest-capability-environment-01.ps1',ps);
let n=fs.readFileSync('.git/c098-guest-native-03.mjs','utf8').replaceAll('guest-native-03','guest-native-04').replaceAll('c098-guest-capability-local-01.ps1','c098-guest-capability-environment-01.ps1');
n=n.replace("SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:","SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMPUTERNAME:process.env.COMPUTERNAME,USERDOMAIN:process.env.USERDOMAIN,USERNAME:process.env.USERNAME,USERPROFILE:process.env.USERPROFILE,ProgramData:process.env.ProgramData,SystemDrive:process.env.SystemDrive,PATH:");
fs.writeFileSync('.git/c098-guest-native-04.mjs',n);console.log('Prepared identity-only child metadata environment and guarded diagnostic');
