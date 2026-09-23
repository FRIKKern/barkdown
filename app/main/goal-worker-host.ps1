param([switch]$Verify)
$ErrorActionPreference = 'Stop'
$spec = [Console]::ReadLine() | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class BarkdownGoalJob {
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long PerProcess, PerJob; public uint Flags; public UIntPtr Min, Max; public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT { public BASIC_LIMIT Basic; public IO_COUNTERS Io; public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob; }
  [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING { public long User, Kernel, PeriodUser, PeriodKernel; public uint Faults, Total, Active, Terminated; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct STARTUP { public uint Size; public string Reserved, Desktop, Title; public uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags; public ushort Show,Reserved2; public IntPtr ReservedBytes,Input,Output,Error; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFO { public IntPtr Process,Thread; public uint Pid,Tid; }
  [StructLayout(LayoutKind.Sequential)] struct STARTUP_EX { public STARTUP Startup; public IntPtr Attributes; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr OpenJobObject(uint access, bool inherit, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref EXTENDED_LIMIT info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out ACCOUNTING info, uint size, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr ps, IntPtr ts, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUP_EX startup, out PROCESS_INFO info);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint millis);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static void Require(bool ok, string op) { if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), op); }
  static string Q(string value) { return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }
  static string Identity(string nonce, string profile, string attempt, string job) {
    return "\"version\":1,\"containment\":\"job-list-v1\",\"nonce\":"+Q(nonce)+",\"profileId\":"+Q(profile)+",\"attemptId\":"+Q(attempt)+",\"jobName\":"+Q(job)+",\"helperPid\":"+Process.GetCurrentProcess().Id+",\"helperStarted\":"+Q(Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString());
  }
  static void Save(string path, string identity, string phase, uint child, uint active) {
    string json = "{"+identity+",\"phase\":"+Q(phase)+",\"childPid\":"+child+",\"activeProcesses\":"+active+"}";
    string tmp = path+"."+Guid.NewGuid().ToString()+".tmp";
    using (var file = new FileStream(tmp,FileMode.CreateNew,FileAccess.Write,FileShare.None)) { byte[] bytes=Encoding.UTF8.GetBytes(json); file.Write(bytes,0,bytes.Length); file.Flush(true); }
    if (File.Exists(path)) File.Replace(tmp,path,null); else File.Move(tmp,path);
    Console.WriteLine(json); Console.Out.Flush();
  }
  static uint Active(IntPtr job) { ACCOUNTING info; Require(QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero),"Query job"); return info.Active; }
  public static void Run(string exe, string args, string cwd, string jobName, string receipt, string nonce, string profile, string attempt) {
    IntPtr job=IntPtr.Zero,attributes=IntPtr.Zero,jobValue=IntPtr.Zero; PROCESS_INFO child=new PROCESS_INFO();
    string identity=Identity(nonce,profile,attempt,jobName);
    try {
      job=CreateJobObject(IntPtr.Zero,jobName); Require(job!=IntPtr.Zero,"Create job");
      Require(Marshal.GetLastWin32Error()!=183,"Job identity already exists");
      var limits=new EXTENDED_LIMIT(); limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE; no breakaway flags.
      Require(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(EXTENDED_LIMIT))),"Configure job");
      Save(receipt,identity,"prepared",0,0);
      IntPtr size=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
      attributes=Marshal.AllocHGlobal(size); Require(InitializeProcThreadAttributeList(attributes,1,0,ref size),"Initialize job launch attributes");
      jobValue=Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobValue,job);
      Require(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x2000D),jobValue,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero),"Set atomic job assignment");
      var startup=new STARTUP_EX(); startup.Startup.Size=(uint)Marshal.SizeOf(typeof(STARTUP_EX)); startup.Attributes=attributes;
      Require(CreateProcess(exe,new StringBuilder(args),IntPtr.Zero,IntPtr.Zero,false,0x08080004,IntPtr.Zero,cwd,ref startup,out child),"Create suspended job-owned worker");
      // This acknowledgement is durable before the first worker instruction runs.
      Save(receipt,identity,"assigned",child.Pid,Active(job));
      Require(ResumeThread(child.Thread)!=0xffffffff,"Resume worker");
      var input=Task.Run(() => Console.ReadLine());
      while (WaitForSingleObject(child.Process,50)==258 && !input.IsCompleted) { }
      Require(TerminateJobObject(job,1),"Stop owned process tree");
      var timeout=Stopwatch.StartNew();
      while (Active(job)!=0) { if(timeout.ElapsedMilliseconds>30000) throw new Exception("Owned process tree did not drain"); Thread.Sleep(25); }
      Save(receipt,identity,"stopped",child.Pid,0);
    } finally {
      if (job!=IntPtr.Zero) CloseHandle(job);
      if (child.Thread!=IntPtr.Zero) CloseHandle(child.Thread);
      if (child.Process!=IntPtr.Zero) CloseHandle(child.Process);
      if (attributes!=IntPtr.Zero) { DeleteProcThreadAttributeList(attributes); Marshal.FreeHGlobal(attributes); }
      if (jobValue!=IntPtr.Zero) Marshal.FreeHGlobal(jobValue);
    }
  }
  public static bool Verify(string jobName, int helperPid, string helperStarted, string phase) {
    // While the exact helper is alive it may still be launching or writing proof.
    try { var helper=Process.GetProcessById(helperPid); if(helper.StartTime.ToUniversalTime().Ticks.ToString()==helperStarted && !helper.HasExited) return false; } catch(ArgumentException) { }
    IntPtr job=OpenJobObject(4,false,jobName);
    if(job!=IntPtr.Zero) { try { return Active(job)==0; } finally { CloseHandle(job); } }
    int error=Marshal.GetLastWin32Error();
    // Atomic job-list creation leaves no unassigned child even if startup dies.
    return error==2 && (phase=="prepared" || phase=="assigned" || phase=="stopped");
  }
}
'@
if ($Verify) {
  $ok = [BarkdownGoalJob]::Verify($spec.jobName, $spec.helperPid, $spec.helperStarted, $spec.phase)
  [Console]::WriteLine(($ok.ToString().ToLowerInvariant()))
} else {
  [BarkdownGoalJob]::Run($spec.exe, $spec.commandLine, $spec.cwd, $spec.jobName, $spec.receipt, $spec.nonce, $spec.profileId, $spec.attemptId)
}
