import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const [nativeArg,releaseArg,outArg,kind="rebuilt"]=process.argv.slice(2),native=path.resolve(nativeArg),release=path.resolve(releaseArg),out=path.resolve(outArg);if(fs.existsSync(out))throw Error('Existing proof retained');fs.mkdirSync(out);
const app=path.join(out,'expty'),base=path.join(release,'lib/expty-0.2.1');if(fs.existsSync(path.join(app,'ebin')))throw Error('Test app exists');fs.cpSync(path.join(base,'ebin'),path.join(app,'ebin'),{recursive:true,force:false,errorOnExist:true});
fs.cpSync(kind==='baseline'?path.join(base,'priv'):path.join(native,'expty/priv'),path.join(app,'priv'),{recursive:true,force:false,errorOnExist:true});
const script=path.join(out,'probe.exs'),child=path.join(out,'child.ps1'),result=path.join(out,'behavior.json');
fs.writeFileSync(child,'[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\nWrite-Output "C098_NATIVE_READY"\n$line = [Console]::ReadLine()\nWrite-Output ("C098_NATIVE_READ:" + $line)\nWrite-Output ("C098_NATIVE_SIZE:" + [Console]::WindowWidth + ":" + [Console]::WindowHeight)\nexit 23\n',{flag:'wx'});
fs.writeFileSync(script,String.raw`defmodule C098Probe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
      {:data, bytes} -> until(marker, deadline, text <> bytes)
      {:exit, code, signal} -> raise "premature exit #{inspect({code, signal})}: #{inspect(text)}"
    after
      max(1, deadline - System.monotonic_time(:millisecond)) -> raise "output deadline for #{marker}: #{inspect(text)}"
      end
    end
  end
end
case Application.load(:expty) do
  :ok -> :ok
  {:error, {:already_loaded, :expty}} -> :ok
end
expected_priv = Path.join(System.fetch_env!("C098_CWD"), "expty/priv") |> Path.expand()
true = (:code.priv_dir(:expty) |> List.to_string() |> Path.expand()) == expected_priv
{:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
parent = self()
exe = Path.join(System.fetch_env!("SystemRoot"), "System32/WindowsPowerShell/v1.0/powershell.exe")
{:ok, pty} = ExPTY.spawn(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_CHILD")], cwd: System.fetch_env!("C098_CWD"), cols: 80, rows: 24, env: System.get_env(), on_data: fn _, _, data -> send(parent, {:data, data}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, code, signal}) end)
state = :sys.get_state(pty)
receipt = %{status: "running", os_pid: state.inner_pid, checks: [], nif_module: :code.which(ExPTY.Nif) |> List.to_string(), priv: :code.priv_dir(:expty) |> List.to_string()}
record = fn r -> File.write!(System.fetch_env!("C098_RESULT"), :json.encode(r) |> IO.iodata_to_binary()) end
record.(receipt)
ready = C098Probe.until("C098_NATIVE_READY", System.monotonic_time(:millisecond) + 15000)
receipt = %{receipt | checks: receipt.checks ++ ["spawn", "ready-output"]}
record.(receipt)
:ok = ExPTY.resize(pty, 112, 34)
receipt = %{receipt | checks: receipt.checks ++ ["resize-return"]}
record.(receipt)
:ok = ExPTY.write(pty, "C098_TYPED_NATIVE\r")
read = C098Probe.until("C098_NATIVE_READ:C098_TYPED_NATIVE", System.monotonic_time(:millisecond) + 15000)
size = C098Probe.until("C098_NATIVE_SIZE:112:34", System.monotonic_time(:millisecond) + 15000, read)
receipt = Map.merge(receipt, %{checks: receipt.checks ++ ["write", "readback", "measured-size-112x34"], output: ready <> size})
record.(receipt)
{code, signal} = receive do {:exit, code, signal} -> {code, signal} after 15000 ->
  record.(Map.merge(receipt, %{status: "failed", error: "no exit callback within 15000ms", pty_alive: Process.alive?(pty), pending_messages: inspect(Process.info(pty, :messages))}))
  raise "no exit"
end
23 = code
:ok = GenServer.stop(pty)
false = Process.alive?(pty)
record.(Map.merge(receipt, %{status: "passed", exit_code: code, signal: signal, pty_alive: false}))
IO.puts("C098_NATIVE_BEHAVIOR_PASSED")
`,{flag:'wx'});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(SystemRoot|windir|TEMP|TMP|ComSpec|PATHEXT|USERPROFILE|HOMEDRIVE|HOMEPATH|ALLUSERSPROFILE|ProgramData|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i.test(k)));env.PATH=path.join(process.env.SystemRoot,'System32')+';'+process.env.SystemRoot;Object.assign(env,{C098_CHILD:child,C098_CWD:out,C098_RESULT:result,ERL_CRASH_DUMP:path.join(out,'private-crash.dump')});
const erl=path.join(release,'erts-16.4/bin/erl.exe');const args=['-noshell','-boot',path.join(release,'releases/0.1.0/start_clean'),'-boot_var','RELEASE_LIB',path.join(release,'lib'),'-pa',path.join(release,'lib/elixir-1.20.1/ebin'),path.join(release,'lib/logger-1.20.1/ebin'),path.join(app,'ebin'),'-s','elixir','start_cli','-extra',script];const startedAt=new Date().toISOString(),start=Date.now(),r=spawnSync(erl,args,{env,cwd:out,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:4e6});
fs.writeFileSync(path.join(out,'stdout.log'),r.stdout||'');fs.writeFileSync(path.join(out,'stderr.log'),r.stderr||'');const report={status:r.status===0&&!r.error&&r.stdout.includes('C098_NATIVE_BEHAVIOR_PASSED')?'passed':'failed',startedAt,finishedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message,signal:r.signal,executable:erl,args,path:env.PATH,kind,producerInputs:hash(path.join(native,'inputs.json')),native:['expty.dll','conpty_console_list.exe'].map(name=>({path:'expty/priv/'+name,sha256:hash(path.join(app,'priv',name)),bytes:fs.statSync(path.join(app,'priv',name)).size})),source:{scriptSha256:hash(script),childSha256:hash(child)},limits:['Carried runtime on developer host, not clean-machine acceptance','Ordinary CRT still available on host','No helper successful attach/console enumeration claim']};if(fs.existsSync(result)){report.behavior=JSON.parse(fs.readFileSync(result,'utf8'));const pid=report.behavior.os_pid;assert.ok(Number.isSafeInteger(pid)&&pid>0);const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),query=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){Write-Output 'ABSENT'}else{Write-Output ('PRESENT:'+$p.ExecutablePath)}`],{env,encoding:'utf8',windowsHide:true,timeout:15000});report.childObservation={status:query.status,output:(query.stdout||'').trim(),error:(query.stderr||'').trim()};if(query.status!==0||report.childObservation.output!=='ABSENT')report.status='failed';}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
