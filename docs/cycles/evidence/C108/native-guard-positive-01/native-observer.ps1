[CmdletBinding()]
param([ValidateSet('compile','observe')][string]$Mode,[Parameter(Mandatory=$true)][string]$Output,[string]$ExpectedExecutable,[string]$OpenReceipt)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public sealed class C108NativeHandle : IDisposable {
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint id);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr h,uint flags,StringBuilder name,ref uint size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr h,out long creation,out long exit,out long kernel,out long user);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr h,out uint code);
  IntPtr handle;
  public string Image {get;private set;}
  public DateTime StartedUtc {get;private set;}
  public C108NativeHandle(uint id) {
    handle=OpenProcess(0x00101000,false,id);
    if(handle==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try { uint n=32768;var b=new StringBuilder((int)n);
      if(!QueryFullProcessImageName(handle,0,b,ref n))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      Image=b.ToString();long c,e,k,u;
      if(!GetProcessTimes(handle,out c,out e,out k,out u))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      StartedUtc=DateTime.FromFileTimeUtc(c);
    } catch {Dispose();throw;}
  }
  public uint ExitCode() {uint c;if(!GetExitCodeProcess(handle,out c))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());return c;}
  public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
}
"@
function Write-Receipt([string]$Name,$Value) {
  $target=Join-Path $Output $Name
  if([IO.File]::Exists($target)){throw 'Preserve existing receipt'}
  $json=ConvertTo-Json -InputObject $Value -Depth 8 -Compress
  [IO.File]::WriteAllText($target+'.writing',$json,(New-Object Text.UTF8Encoding($false)))
  [IO.File]::Move($target+'.writing',$target)
}
if($Mode -eq 'compile') {
  Write-Receipt 'compile.json' @{status='compiled_not_observed';type='C108NativeHandle';limits='Read-only Win32 type compiled only; no OpenProcess/native process or renderer invocation.'}
  exit 0
}
$ownedHandle=$null
try {
  if(-not [IO.Path]::IsPathRooted($ExpectedExecutable)){throw 'Expected executable must be absolute'}
  Write-Receipt 'native-observer-ready.json' @{status='ready';at=[DateTime]::UtcNow.ToString('o')}
  $deadline=[DateTime]::UtcNow.AddSeconds(45)
  while(-not [IO.File]::Exists($OpenReceipt)) {
    if([DateTime]::UtcNow -gt $deadline){throw 'Actual port-open receipt timeout'}
    [Threading.Thread]::Sleep(1)
  }
  $opened=Get-Content -LiteralPath $OpenReceipt -Raw | ConvertFrom-Json
  if($opened.os_pid -lt 1 -or $opened.os_pid -gt [uint32]::MaxValue){throw 'Invalid actual port OS PID'}
  $ownedHandle=New-Object C108NativeHandle([uint32]$opened.os_pid)
  $actualPath=[IO.Path]::GetFullPath($ownedHandle.Image)
  if(-not $actualPath.Equals([IO.Path]::GetFullPath($ExpectedExecutable),[StringComparison]::OrdinalIgnoreCase)){throw 'Actual process image mismatches pinned dedicated renderer'}
  $firstCode=$ownedHandle.ExitCode()
  if($firstCode -ne 259){throw 'Actual child already exited before live handle acquisition; lifetime not proved'}
  $startedAt=$ownedHandle.StartedUtc
  if($startedAt -lt [DateTime]::Parse($opened.window_start).ToUniversalTime() -or $startedAt -gt [DateTime]::Parse($opened.observed_at).ToUniversalTime()){throw 'Native creation time outside actual port-open window'}
  $sha=(Get-FileHash -LiteralPath $ExpectedExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
  $active=@{status='actual_native_handle_live';os_pid=[uint32]$opened.os_pid;started_at=$startedAt.ToString('o');image=$actualPath;sha256=$sha;first_exit_code=$firstCode;at=[DateTime]::UtcNow.ToString('o');handle_retained=$true;no_kill_or_suspend=$true}
  Write-Receipt 'native-active.json' $active
  $deadline=[DateTime]::UtcNow.AddSeconds(35)
  $code=$ownedHandle.ExitCode()
  while($code -eq 259 -and [DateTime]::UtcNow -lt $deadline){[Threading.Thread]::Sleep(2);$code=$ownedHandle.ExitCode()}
  if($code -eq 259){throw 'Native child remains active at observation bound; retain uncertainty'}
  Write-Receipt 'native-exit.json' @{status='actual_retained_handle_exit';os_pid=[uint32]$opened.os_pid;started_at=$startedAt.ToString('o');image=$actualPath;exit_code=$code;at=[DateTime]::UtcNow.ToString('o');no_kill_or_suspend=$true}
} catch {
  Write-Receipt 'native-observer-failed.json' @{status='failed';error=$_.Exception.Message;at=[DateTime]::UtcNow.ToString('o')}
  exit 1
} finally {if($null -ne $ownedHandle){$ownedHandle.Dispose()}}
