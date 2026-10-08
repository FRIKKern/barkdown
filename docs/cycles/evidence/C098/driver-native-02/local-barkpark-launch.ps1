$ErrorActionPreference = 'Stop'
# Put the launcher in a kill-on-close job before it starts mix/BEAM. Children
# inherit membership, not this non-inheritable handle; launcher death kills all.
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class BarkdownRuntimeJob {
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long PerProcess, PerJob; public uint Flags; public UIntPtr Min, Max; public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT { public BASIC_LIMIT Basic; public IO_COUNTERS Io; public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref EXTENDED_LIMIT info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static IntPtr ownedJob;
  static void Require(bool ok, string operation) { if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), operation); }
  public static void Contain() {
    var job = CreateJobObject(IntPtr.Zero, null);
    Require(job != IntPtr.Zero, "Create runtime job");
    try {
      var limits = new EXTENDED_LIMIT(); limits.Basic.Flags = 0x2000;
      Require(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(EXTENDED_LIMIT))), "Configure runtime job");
      Require(AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle), "Contain runtime launcher");
      ownedJob = job; // Retained until process exit.
    } catch { CloseHandle(job); throw; }
  }
}
'@
[BarkdownRuntimeJob]::Contain()
# Values come through the environment; paths are never interpolated as shell code.
if ($env:BARKDOWN_RELEASE_MODE) {
  # Native warnings are output, not a PowerShell command failure. Preserve LASTEXITCODE.
  $ErrorActionPreference = 'Continue'
  switch ($env:BARKDOWN_RELEASE_MODE) {
    'migrate' { & $env:BARKDOWN_RELEASE_BIN eval 'Barkpark.Release.migrate()' }
    'seed' { & $env:BARKDOWN_RELEASE_BIN eval 'Barkpark.Release.seed()' }
    'server' { & $env:BARKDOWN_RELEASE_BIN eval 'Code.require_file(System.get_env(Atom.to_string(:BARKDOWN_RELEASE_BOOT_SCRIPT)))' }
    default { throw 'Unknown packaged runtime action' }
  }
  exit $LASTEXITCODE
}
$env:Path = $env:BARKDOWN_TOOL_PATH + ';' + $env:Path
Set-Location -LiteralPath $env:BARKDOWN_API_DIR
& $env:BARKDOWN_MIX_PATH run --no-start --no-compile --no-deps-check --no-halt $env:BARKDOWN_BOOT_SCRIPT
exit $LASTEXITCODE
