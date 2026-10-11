/**
 * Copyright (c) 2013-2015, Christopher Jeffrey, Peter Sunde (MIT License)
 * Copyright (c) 2016, Daniel Imms (MIT License).
 * Copyright (c) 2018, Microsoft Corporation (MIT License).
 * Copyright (c) 2023, Cocoa Xu (Apache 2.0 License).
 *
 * Altered Windows ExPTY 0.2.1 prototype for Barkdown, 2026-10-08.
 * Private build only: monitored Erlang resource, coordinated native teardown.
 * Existing upstream LICENSE and credits accompany the complete source copy.
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <Windows.h>
#include <Shlwapi.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <limits>
#include <memory>
#include <mutex>
#include <new>
#include <string>
#include <vector>
#include <erl_nif.h>
#include "nif_utils.h"
#include "path_util.h"

using CreatePc = HRESULT(WINAPI*)(COORD,HANDLE,HANDLE,DWORD,HPCON*);
using ResizePc = HRESULT(WINAPI*)(HPCON,COORD);
using ClosePc = void(WINAPI*)(HPCON);
static CreatePc create_pc;
static ResizePc resize_pc;
static ClosePc close_pc;
static ErlNifResourceType* resource_type;

static void close_handle(HANDLE& handle) {
  if(handle && handle!=INVALID_HANDLE_VALUE) CloseHandle(handle);
  handle=nullptr;
}
struct Pty {
  ErlNifPid owner{};
  ErlNifMonitor monitor{};
  std::atomic<bool> owner_alive{true};
  std::atomic<bool> stopping{false};
  std::mutex operation,write,completion;
  std::condition_variable completed;
  bool done=false;
  bool worker_started=false;
  bool connected=false;
  HANDLE input=nullptr,output=nullptr,process=nullptr;
  HANDLE console_input=nullptr,console_output=nullptr;
  HANDLE reader=nullptr,worker=nullptr,writer=nullptr;
  HANDLE gate=nullptr,ready=nullptr,stop=nullptr;
  HPCON console=nullptr;
  DWORD process_id=0;
  int signal=0;
  ~Pty() {
    // The worker retains the resource until its reader has joined and every
    // operational handle is closed. Only failed pre-worker setup reaches this
    // fallback with handles; never wait on a scheduler's destructor thread.
    close_handle(input);close_handle(output);close_handle(process);
    close_handle(console_input);close_handle(console_output);
    close_handle(reader);close_handle(worker);close_handle(writer);
    close_handle(gate);close_handle(ready);close_handle(stop);
  }
};
static void request_stop(Pty* p) {
  std::lock_guard<std::mutex> lock(p->operation);
  p->stopping=true;
  if(p->stop) SetEvent(p->stop);
}
static void send_data(Pty* p,const char* bytes,DWORD size) {
  if(!p->owner_alive.load()) return;
  ErlNifEnv* env=enif_alloc_env();
  if(!env) return;
  ERL_NIF_TERM binary;
  auto data=enif_make_new_binary(env,size,&binary);
  if(data) {
    memcpy(data,bytes,size);
    enif_send(nullptr,&p->owner,env,enif_make_tuple2(env,nif::atom(env,"data"),binary));
  }
  enif_free_env(env);
}
static DWORD WINAPI read_output(void* arg) {
  auto p=static_cast<Pty*>(arg);
  char bytes[16384];DWORD size;
  while(ReadFile(p->output,bytes,sizeof(bytes),&size,nullptr) && size) send_data(p,bytes,size);
  return 0; // Broken pipe/EOF/cancellation ends the reader instead of spinning.
}
static void finish(Pty* p,bool notify) {
  DWORD code=0;
  {
    std::lock_guard<std::mutex> lock(p->operation);
    p->stopping=true;
    if(p->writer) CancelSynchronousIo(p->writer);
    if(p->process && GetExitCodeProcess(p->process,&code) && code==STILL_ACTIVE)
      TerminateProcess(p->process,p->signal?128+p->signal:1);
  }
  {
    // Cancel before joining this mutex: a blocked WriteFile must be allowed
    // to release it. Operations cannot begin once stopping is visible.
    std::lock_guard<std::mutex> write_lock(p->write);
    std::lock_guard<std::mutex> lock(p->operation);
    close_handle(p->input);close_handle(p->console_input);close_handle(p->console_output);
  }
  HPCON console;
  {
    std::lock_guard<std::mutex> lock(p->operation);
    console=p->console;p->console=nullptr;
  }
  // ConPTY may emit its final frame during close. Its reader remains live and
  // draining. If reader creation failed, close its pipe before closing ConPTY.
  if(!p->reader) close_handle(p->output);
  if(console) close_pc(console);
  if(p->reader) {
    if(WaitForSingleObject(p->reader,5000)!=WAIT_OBJECT_0) CancelSynchronousIo(p->reader);
    // Never free memory beneath a live reader. If OS cancellation fails, the
    // worker retains ownership; close/1 reports its bounded timeout instead.
    WaitForSingleObject(p->reader,INFINITE);
  }
  if(p->process) {WaitForSingleObject(p->process,5000);GetExitCodeProcess(p->process,&code);}
  const int signal=p->signal;
  {
    std::lock_guard<std::mutex> lock(p->operation);
    close_handle(p->output);close_handle(p->reader);close_handle(p->process);
    close_handle(p->gate);close_handle(p->ready);close_handle(p->stop);
    close_handle(p->worker);
  }
  {
    std::lock_guard<std::mutex> lock(p->completion);p->done=true;
  }
  p->completed.notify_all();
  if(notify && p->connected && p->owner_alive.load()) {
    ErlNifEnv* env=enif_alloc_env();
    if(env) {
      // Exactly one worker owns the notification; match the Elixir handler's
      // three-element tuple. The PID is a value retained with this resource.
      auto sig=signal?enif_make_int(env,signal):nif::atom(env,"nil");
      enif_send(nullptr,&p->owner,env,enif_make_tuple3(env,nif::atom(env,"exit"),enif_make_uint(env,code),sig));
      enif_free_env(env);
    }
  }
}
static DWORD WINAPI await_exit(void* arg) {
  auto p=static_cast<Pty*>(arg);
  WaitForSingleObject(p->gate,INFINITE);
  HANDLE setup[]={p->stop,p->ready};
  DWORD stage=WAIT_TIMEOUT;
  while(!p->stopping && stage==WAIT_TIMEOUT) stage=WaitForMultipleObjects(2,setup,FALSE,50);
  if(!p->stopping && stage==WAIT_OBJECT_0+1) {
    HANDLE running[]={p->stop,p->process};
    DWORD status=WAIT_TIMEOUT;
    while(!p->stopping && status==WAIT_TIMEOUT) status=WaitForMultipleObjects(2,running,FALSE,50);
  }
  finish(p,true);
  enif_release_resource(p); // Native worker reference; reader already joined.
  return 0;
}
static void destroy(ErlNifEnv*,void* obj) {static_cast<Pty*>(obj)->~Pty();}
static void owner_down(ErlNifEnv*,void* obj,ErlNifPid*,ErlNifMonitor*) {
  // Resource down runs on a VM callback thread. Do not acquire a mutex that
  // an I/O operation may hold or touch a HANDLE concurrently being closed.
  auto p=static_cast<Pty*>(obj);p->owner_alive=false;p->stopping=true;
}
static Pty* owned(ErlNifEnv* env,ERL_NIF_TERM term) {
  void* obj=nullptr;ErlNifPid caller;
  if(!enif_get_resource(env,term,resource_type,&obj) || !enif_self(env,&caller)) return nullptr;
  auto p=static_cast<Pty*>(obj);
  return enif_compare_pids(&caller,&p->owner)==0?p:nullptr;
}
static bool make_pipe(const std::wstring& name,bool input,HANDLE& host,HANDLE& console) {
  console=CreateNamedPipeW(name.c_str(),(input?PIPE_ACCESS_INBOUND:PIPE_ACCESS_OUTBOUND)|FILE_FLAG_FIRST_PIPE_INSTANCE,PIPE_TYPE_BYTE|PIPE_READMODE_BYTE|PIPE_WAIT,1,0,0,30000,nullptr);
  if(console==INVALID_HANDLE_VALUE){console=nullptr;return false;}
  host=CreateFileW(name.c_str(),input?GENERIC_WRITE:GENERIC_READ,0,nullptr,OPEN_EXISTING,0,nullptr);
  if(host==INVALID_HANDLE_VALUE){host=nullptr;close_handle(console);return false;}
  if(!ConnectNamedPipe(console,nullptr) && GetLastError()!=ERROR_PIPE_CONNECTED){close_handle(host);close_handle(console);return false;}
  return true;
}
static ERL_NIF_TERM abandon(ErlNifEnv* env,Pty* p,const char* reason) {
  if(p){if(p->worker_started)request_stop(p);else finish(p,false);enif_release_resource(p);}
  return nif::error(env,reason);
}
static ERL_NIF_TERM spawn_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  Pty* p=nullptr;
  try {
    std::string file,prefix;int cols,rows;bool debug,inherit;
    if(!nif::get(env,args[0],file)||!nif::get(env,args[1],&cols)||!nif::get(env,args[2],&rows)||!nif::get(env,args[3],&debug)||!nif::get(env,args[4],prefix)||!nif::get(env,args[5],&inherit)||cols<=0||rows<=0||cols>32767||rows>32767) return enif_make_badarg(env);
    auto executable=path_util::to_wstring(file);
    if(PathIsRelativeW(executable.c_str())) executable=path_util::get_shell_path(executable.c_str());
    if(executable.empty()||!path_util::file_exists(executable))return nif::error(env,"File not found");
    if(!create_pc||!resize_pc||!close_pc)return nif::error(env,"ConPTY is unavailable");
    void* memory=enif_alloc_resource(resource_type,sizeof(Pty));if(!memory)return nif::error(env,"Resource allocation failed");
    p=new(memory) Pty();enif_self(env,&p->owner);
    p->gate=CreateEventW(nullptr,TRUE,FALSE,nullptr);p->ready=CreateEventW(nullptr,TRUE,FALSE,nullptr);p->stop=CreateEventW(nullptr,TRUE,FALSE,nullptr);
    if(!p->gate||!p->ready||!p->stop)return abandon(env,p,"Event allocation failed");
    std::wstring input_name=L"\\\\.\\pipe\\"+path_util::to_wstring(prefix)+L"-in",output_name=L"\\\\.\\pipe\\"+path_util::to_wstring(prefix)+L"-out";
    if(!make_pipe(input_name,true,p->input,p->console_input))return abandon(env,p,"Input pipe creation failed");
    if(!make_pipe(output_name,false,p->output,p->console_output))return abandon(env,p,"Output pipe creation failed");
    HRESULT result=create_pc({static_cast<SHORT>(cols),static_cast<SHORT>(rows)},p->console_input,p->console_output,inherit?1:0,&p->console);
    if(FAILED(result))return abandon(env,p,"Cannot launch ConPTY");
    p->reader=CreateThread(nullptr,0,read_output,p,0,nullptr);
    if(!p->reader)return abandon(env,p,"Reader creation failed");
    enif_keep_resource(p);
    p->worker=CreateThread(nullptr,0,await_exit,p,0,nullptr);
    if(!p->worker){enif_release_resource(p);return abandon(env,p,"Exit worker creation failed");}
    p->worker_started=true;SetEvent(p->gate);
    if(enif_monitor_process(env,p,&p->owner,&p->monitor)!=0){p->owner_alive=false;return abandon(env,p,"Owner monitor failed");}
    bool success;auto in=nif::make_string(env,("\\\\.\\pipe\\"+prefix+"-in").c_str(),success);
    if(!success)return abandon(env,p,"Input name allocation failed");
    auto out=nif::make_string(env,("\\\\.\\pipe\\"+prefix+"-out").c_str(),success);if(!success)return abandon(env,p,"Output name allocation failed");
    auto term=enif_make_tuple3(env,enif_make_resource(env,p),in,out);enif_release_resource(p);return term;
  } catch(...) {return abandon(env,p,"Native spawn exception");}
}
static ERL_NIF_TERM connect_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  auto p=owned(env,args[0]);if(!p)return enif_make_badarg(env);
  try {
    std::string command,cwd;std::vector<std::string> variables;
    if(!nif::get(env,args[1],command)||!nif::get(env,args[2],cwd)||!nif::get_env(env,args[3],variables))return enif_make_badarg(env);
    auto wide=path_util::to_wstring(command),directory=path_util::to_wstring(cwd);
    std::vector<wchar_t> mutable_command(wide.begin(),wide.end());mutable_command.push_back(0);
    std::vector<std::wstring> sorted;for(const auto& v:variables)sorted.push_back(path_util::to_wstring(v));std::sort(sorted.begin(),sorted.end(),[](const std::wstring& a,const std::wstring& b){return _wcsicmp(a.c_str(),b.c_str())<0;});
    std::vector<wchar_t> environment;for(const auto& v:sorted){environment.insert(environment.end(),v.begin(),v.end());environment.push_back(0);}if(!environment.empty())environment.push_back(0);
    std::lock_guard<std::mutex> lock(p->operation);
    if(p->stopping||p->connected||!p->console)return nif::error(env,"PTY is not connectable");
    STARTUPINFOEXW startup{};startup.StartupInfo.cb=sizeof(startup);
    // Preserve the upstream ConPTY standard-handle policy. In particular, the
    // BEAM launcher has ignored stdin; it must not become the client console.
    startup.StartupInfo.dwFlags=STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput=nullptr;startup.StartupInfo.hStdOutput=nullptr;startup.StartupInfo.hStdError=nullptr;
    SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,1,0,&size);
    std::unique_ptr<unsigned char[]> storage(new unsigned char[size]);startup.lpAttributeList=reinterpret_cast<PPROC_THREAD_ATTRIBUTE_LIST>(storage.get());
    if(!InitializeProcThreadAttributeList(startup.lpAttributeList,1,0,&size))return nif::error(env,"Attribute list creation failed");
    struct Attributes {PPROC_THREAD_ATTRIBUTE_LIST p;~Attributes(){DeleteProcThreadAttributeList(p);}} attributes{startup.lpAttributeList};
    if(!UpdateProcThreadAttribute(startup.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,p->console,sizeof(HPCON),nullptr,nullptr))return nif::error(env,"Pseudoconsole attribute failed");
    PROCESS_INFORMATION child{};
    if(!CreateProcessW(nullptr,mutable_command.data(),nullptr,nullptr,FALSE,EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT,environment.empty()?nullptr:environment.data(),directory.c_str(),&startup.StartupInfo,&child))return nif::error(env,"Cannot create process");
    // Retain the passed console pipe ends through CreateProcess, then release
    // our copies. The pseudoconsole owns the references for the attached child.
    close_handle(p->console_input);close_handle(p->console_output);
    close_handle(child.hThread);p->process=child.hProcess;p->process_id=child.dwProcessId;p->connected=true;SetEvent(p->ready);
    return enif_make_tuple2(env,nif::atom(env,"ok"),enif_make_uint(env,p->process_id));
  }catch(...){return nif::error(env,"Native connect exception");}
}
static ERL_NIF_TERM write_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  auto p=owned(env,args[0]);if(!p)return enif_make_badarg(env);
  ErlNifBinary binary;if(!enif_inspect_iolist_as_binary(env,args[1],&binary)||binary.size>std::numeric_limits<DWORD>::max())return enif_make_badarg(env);
  std::lock_guard<std::mutex> write_lock(p->write);
  HANDLE input;
  {
    std::lock_guard<std::mutex> lock(p->operation);
    if(p->stopping||!p->connected||!p->input)return nif::error(env,"PTY is closed");
    input=p->input;
    if(!DuplicateHandle(GetCurrentProcess(),GetCurrentThread(),GetCurrentProcess(),&p->writer,0,FALSE,DUPLICATE_SAME_ACCESS))return nif::error(env,"Writer identity failed");
  }
  DWORD written=0;BOOL success=WriteFile(input,binary.data,static_cast<DWORD>(binary.size),&written,nullptr);
  {std::lock_guard<std::mutex> lock(p->operation);close_handle(p->writer);}
  if(!success)return nif::error(env,"PTY write failed");
  return written==binary.size?nif::atom(env,"ok"):enif_make_tuple2(env,nif::atom(env,"partial"),enif_make_uint(env,written));
}
static ERL_NIF_TERM resize_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  auto p=owned(env,args[0]);int cols,rows;if(!p||!nif::get(env,args[1],&cols)||!nif::get(env,args[2],&rows)||cols<=0||rows<=0||cols>32767||rows>32767)return enif_make_badarg(env);
  std::lock_guard<std::mutex> lock(p->operation);if(p->stopping||!p->console)return nif::error(env,"PTY is closed");
  return SUCCEEDED(resize_pc(p->console,{static_cast<SHORT>(cols),static_cast<SHORT>(rows)}))?nif::atom(env,"ok"):nif::error(env,"Resize failed");
}
static ERL_NIF_TERM kill_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  auto p=owned(env,args[0]);int signal;if(!p||!nif::get(env,args[1],&signal))return enif_make_badarg(env);
  if(signal!=9&&signal!=15)return nif::error(env,"Unsupported Windows signal");
  std::lock_guard<std::mutex> lock(p->operation);if(p->stopping||!p->process)return nif::error(env,"PTY is closed");p->signal=signal;p->stopping=true;if(p->stop)SetEvent(p->stop);return nif::atom(env,"ok");
}
static ERL_NIF_TERM close_pty(ErlNifEnv* env,int,const ERL_NIF_TERM args[]) {
  auto p=owned(env,args[0]);if(!p)return enif_make_badarg(env);request_stop(p);
  std::unique_lock<std::mutex> lock(p->completion);
  if(!p->completed.wait_for(lock,std::chrono::seconds(10),[p]{return p->done;}))return nif::error(env,"PTY teardown timeout");return nif::atom(env,"ok");
}
static ERL_NIF_TERM stub(ErlNifEnv* env,int,const ERL_NIF_TERM[]) {return nif::error(env,"Invalid platform-specific NIF call");}
static int load(ErlNifEnv* env,void**,ERL_NIF_TERM) {
  HMODULE kernel=GetModuleHandleW(L"kernel32.dll");
  create_pc=reinterpret_cast<CreatePc>(GetProcAddress(kernel,"CreatePseudoConsole"));resize_pc=reinterpret_cast<ResizePc>(GetProcAddress(kernel,"ResizePseudoConsole"));close_pc=reinterpret_cast<ClosePc>(GetProcAddress(kernel,"ClosePseudoConsole"));
  ErlNifResourceTypeInit callbacks{};callbacks.dtor=destroy;callbacks.down=owner_down;callbacks.members=3;
  resource_type=enif_open_resource_type_x(env,"owned_windows_pty",&callbacks,ERL_NIF_RT_CREATE,nullptr);return resource_type?0:-1;
}
static ErlNifFunc functions[]={
  {"spawn_win32",6,spawn_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},{"connect_win32",4,connect_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},
  {"write",2,write_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},{"resize",3,resize_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},
  {"kill",2,kill_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},{"close",1,close_pty,ERL_NIF_DIRTY_JOB_IO_BOUND},
  {"spawn_unix",13,stub,ERL_NIF_DIRTY_JOB_IO_BOUND},{"pause",1,stub,ERL_NIF_DIRTY_JOB_IO_BOUND},{"resume",1,stub,ERL_NIF_DIRTY_JOB_IO_BOUND}
};
ERL_NIF_INIT(Elixir.ExPTY.Nif,functions,load,nullptr,nullptr,nullptr);
