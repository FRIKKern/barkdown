param([string]$InputFile,[string]$Output)
$ErrorActionPreference='Stop'
$taskOutput=[IO.Path]::GetFullPath($Output)
if([IO.Directory]::Exists($taskOutput)){throw 'Output exists'}
$null=[IO.Directory]::CreateDirectory($taskOutput)
$taskInput=[IO.File]::ReadAllText([IO.Path]::GetFullPath($InputFile))|ConvertFrom-Json
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'
Import-Module 'C:/Windows/System32/WindowsPowerShell/v1.0/Modules/CimCmdlets/CimCmdlets.psd1'
$taskRows=@()
try {
  if(-not [Environment]::Is64BitProcess -or @($taskInput.targets).Count -lt 1 -or @($taskInput.targets).Count -gt 3){throw 'Invalid observation target roster'}
  $taskRoles=@();$taskIds=@()
  foreach($taskTarget in $taskInput.targets) {
    if($taskTarget.role -notin @('beam','postgres','postgres-backend') -or $taskRoles -contains $taskTarget.role -or $taskIds -contains $taskTarget.pid -or $taskTarget.pid -le 1 -or -not [IO.Path]::IsPathRooted($taskTarget.path)){throw 'Invalid or duplicate owned target'}
    $taskRoles += $taskTarget.role;$taskIds += $taskTarget.pid
    $taskProcess=[Diagnostics.Process]::GetProcessById([int]$taskTarget.pid)
    try {
      $taskStart=$taskProcess.StartTime.ToUniversalTime().ToString('o')
      if($taskStart -ne $taskTarget.startedAt){throw 'Target PID/start identity mismatch'}
      $taskMain=$taskProcess.MainModule.FileName
      if(-not [string]::Equals($taskMain,$taskTarget.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Target executable path mismatch'}
      if($taskTarget.role -eq 'postgres-backend') {
        $taskParent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskTarget.pid)
        if($taskParent.ParentProcessId -ne $taskInput.postmasterPid){throw 'Backend is outside owned postmaster'}
      }
      $taskModules=@()
      foreach($taskModule in $taskProcess.Modules) {
        $taskFile=$taskModule.FileName
        try {
          $taskBytes=[IO.File]::ReadAllBytes($taskFile);$taskHasher=[Security.Cryptography.SHA256]::Create()
          try {$taskHash=([BitConverter]::ToString($taskHasher.ComputeHash($taskBytes))).Replace('-','').ToLowerInvariant()} finally {$taskHasher.Dispose()}
          $taskInfo=[Diagnostics.FileVersionInfo]::GetVersionInfo($taskFile)
          $taskSignature=$null
          if($taskModule.ModuleName -match '^(msvcp140|vcruntime140|vcruntime140_1|ucrtbase)\.dll$') {
            $taskAuth=Get-AuthenticodeSignature -LiteralPath $taskFile
            $taskSignature=[pscustomobject]@{status=[string]$taskAuth.Status;signer=$taskAuth.SignerCertificate.Subject}
          }
          $taskModules += [pscustomobject]@{name=$taskModule.ModuleName;file=$taskFile;status='observed';mappedBytes=$taskModule.ModuleMemorySize;diskBytes=$taskBytes.Length;diskSha256=$taskHash;fileVersion=$taskInfo.FileVersion;productVersion=$taskInfo.ProductVersion;signature=$taskSignature}
        } catch {$taskModules += [pscustomobject]@{name=$taskModule.ModuleName;file=$taskFile;status='unreadable';error=$_.Exception.GetType().FullName}}
      }
      $taskProcess.Refresh()
      if($taskProcess.HasExited -or $taskProcess.StartTime.ToUniversalTime().ToString('o') -ne $taskStart){throw 'Target exited or PID changed during observation'}
      $taskRows += [pscustomobject]@{role=$taskTarget.role;pid=$taskTarget.pid;startedAt=$taskStart;path=$taskMain;modules=$taskModules}
    } finally {$taskProcess.Dispose()}
  }
  $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');process64=[Environment]::Is64BitProcess;targets=$taskRows;limits=@('Sampled owned process module paths with current on-disk hashes/resources; mapped memory bytes are not hashed','Not complete dynamic closure, loader flag/callsite, ABI/minimum or clean-machine acceptance')}
  [IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult|ConvertTo-Json -Depth 10)+"`n",[Text.UTF8Encoding]::new($false))
} catch {
  [IO.File]::WriteAllText($taskOutput+'/failure.json',([pscustomobject]@{status='failed';observedAt=[DateTime]::UtcNow.ToString('o');error=$_.Exception.Message;completedTargets=$taskRows}|ConvertTo-Json -Depth 10)+"`n",[Text.UTF8Encoding]::new($false));throw
}
