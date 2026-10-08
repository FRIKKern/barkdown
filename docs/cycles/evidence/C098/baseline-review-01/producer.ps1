param([string]$Configuration,[string]$Source,[string]$Output)
$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$taskTokens,[ref]$taskErrors)
if($taskErrors.Count){throw 'Collector has parse errors'}
$taskXml=[xml][IO.File]::ReadAllText($Configuration)
$taskRoot=$taskXml.Configuration
if($taskRoot.MappedFolders.MappedFolder.Count -ne 2){throw 'Unexpected map count'}
foreach($taskName in @('vGPU','Networking','AudioInput','VideoInput','PrinterRedirection','ClipboardRedirection')){if($taskRoot.$taskName -cne 'Disable'){throw 'Unexpected shared capability'}}
$taskMaps=@($taskRoot.MappedFolders.MappedFolder)
if($taskMaps[0].SandboxFolder -cne 'C:\BarkdownBaselineInput' -or $taskMaps[0].ReadOnly -cne 'true'){throw 'Input mapping changed'}
if($taskMaps[1].SandboxFolder -cne 'C:\BarkdownBaselineOutput' -or $taskMaps[1].ReadOnly -cne 'false'){throw 'Output mapping changed'}
if([IO.Path]::GetDirectoryName($taskMaps[0].HostFolder) -ine [IO.Path]::GetDirectoryName($taskMaps[1].HostFolder)){throw 'Separate output owners'}
if([IO.Path]::GetFileName($taskMaps[0].HostFolder) -cne 'input' -or [IO.Path]::GetFileName($taskMaps[1].HostFolder) -cne 'output'){throw 'Unexpected physical mapping'}
$taskCommand='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\BarkdownBaselineInput\collector.ps1" -OutputDirectory "C:\BarkdownBaselineOutput" -Role candidate-guest'
if($taskRoot.LogonCommand.Command -cne $taskCommand){throw 'Logon command changed'}
$taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');parserErrors=$taskErrors.Count;maps=@($taskMaps|ForEach-Object {[pscustomobject]@{host=$_.HostFolder;guest=$_.SandboxFolder;readOnly=$_.ReadOnly}});command=$taskRoot.LogonCommand.Command;guestExecuted=$false}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskResult|ConvertTo-Json -Depth 6)+"`n")
$taskStream=[IO.File]::Open($Output,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
