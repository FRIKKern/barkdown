param([string]$Output)
$ErrorActionPreference = 'Stop'
$taskOutput = [System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $taskOutput) { throw 'Output already exists' }
$null = New-Item -ItemType Directory -Path $taskOutput
$taskInstaller = $null
$taskRows = @()
function Get-TaskHash([string]$File) {
    $taskHash = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($taskHash.ComputeHash([System.IO.File]::ReadAllBytes($File)))).Replace('-','').ToLowerInvariant() }
    finally { $taskHash.Dispose() }
}
function Read-Table($Database, [string]$Sql, [string[]]$Names) {
    $taskView = $null
    try {
        $taskView = $Database.GetType().InvokeMember('OpenView','InvokeMethod',$null,$Database,@($Sql))
        $null = $taskView.GetType().InvokeMember('Execute','InvokeMethod',$null,$taskView,$null)
        while ($true) {
            $taskRecord = $taskView.GetType().InvokeMember('Fetch','InvokeMethod',$null,$taskView,$null)
            if ($null -eq $taskRecord) { break }
            try {
                $taskRow = [ordered]@{}
                for ($taskIndex=0; $taskIndex -lt $Names.Length; $taskIndex++) {
                    $taskRow[$Names[$taskIndex]] = $taskRecord.GetType().InvokeMember('StringData','GetProperty',$null,$taskRecord,@($taskIndex+1))
                }
                [pscustomobject]$taskRow
            } finally { $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskRecord) }
        }
    } finally {
        if ($null -ne $taskView) {
            $null = $taskView.GetType().InvokeMember('Close','InvokeMethod',$null,$taskView,$null)
            $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskView)
        }
    }
}
try {
    $taskInstaller = New-Object -ComObject WindowsInstaller.Installer
    foreach ($taskFile in @('a1.msi','a2.msi')) {
        $taskInput = [System.IO.Path]::GetFullPath('.git/c098-crt-containers-01/'+$taskFile)
        $taskDatabase = $null
        $taskSummary = $null
        try {
            # OpenDatabase mode0 is read-only; no InstallProduct/action is invoked.
            $taskDatabase = $taskInstaller.GetType().InvokeMember('OpenDatabase','InvokeMethod',$null,$taskInstaller,@($taskInput,0))
            $taskSummary = $taskDatabase.GetType().InvokeMember('SummaryInformation','GetProperty',$null,$taskDatabase,@(0))
            $taskTemplate = $taskSummary.GetType().InvokeMember('Property','GetProperty',$null,$taskSummary,@(7))
            $taskProperties = @(Read-Table $taskDatabase 'SELECT `Property`, `Value` FROM `Property`' @('property','value'))
            $taskFiles = @(Read-Table $taskDatabase 'SELECT `File`, `Component_`, `FileName`, `FileSize`, `Version`, `Language`, `Attributes`, `Sequence` FROM `File`' @('id','component','name','bytes','version','language','attributes','sequence'))
            $taskMedia = @(Read-Table $taskDatabase 'SELECT `DiskId`, `LastSequence`, `Cabinet` FROM `Media`' @('disk','lastSequence','cabinet'))
            if ($taskTemplate -ne 'x64;1033') { throw ('Unexpected selected MSI architecture: '+$taskTemplate) }
            $taskVersion = @($taskProperties | Where-Object property -eq 'ProductVersion')
            if ($taskVersion.Length -ne 1 -or $taskVersion[0].value -ne '14.50.35719') { throw 'Unexpected selected MSI version' }
            $taskRows += [pscustomobject]@{file=$taskFile; path=$taskInput; sha256=(Get-TaskHash $taskInput); template=$taskTemplate; properties=$taskProperties; files=$taskFiles; media=$taskMedia}
        } finally {
            if ($null -ne $taskSummary) { $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskSummary) }
            if ($null -ne $taskDatabase) { $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDatabase) }
        }
    }
    $taskResult = [pscustomobject]@{status='passed'; observedAt=[DateTime]::UtcNow.ToString('o'); scope='Read-only mode0 MSI tables/summary metadata. No installer action, registry mutation or package execution.'; packages=$taskRows}
    [System.IO.File]::WriteAllText($taskOutput+'/result.json',($taskResult | ConvertTo-Json -Depth 9)+"`n",[System.Text.UTF8Encoding]::new($false))
} catch {
    [System.IO.File]::WriteAllText($taskOutput+'/failure.txt',($_ | Out-String),[System.Text.UTF8Encoding]::new($false))
    throw
} finally {
    if ($null -ne $taskInstaller) { $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskInstaller) }
}
