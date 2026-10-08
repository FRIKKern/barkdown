import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const [nativeArg,releaseArg,outArg]=process.argv.slice(2),native=path.resolve(nativeArg),release=path.resolve(releaseArg),out=path.resolve(outArg);if(fs.existsSync(out))throw Error('Existing proof retained');fs.mkdirSync(out);
const app=path.join(native,'expty'),base=path.join(release,'lib/expty-0.2.1');if(fs.existsSync(path.join(app,'ebin')))throw Error('Test app exists');fs.cpSync(path.join(base,'ebin'),path.join(app,'ebin'),{recursive:true,force:false,errorOnExist:true});
const script=path.join(out,'probe.exs'),child=path.join(out,'child.ps1'),result=path.join(out,'behavior.json');
fs.writeFileSync(child,'[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\nWrite-Output "C098_NATIVE_READY"\n$line = [Console]::ReadLine()\nWrite-Output ("C098_NATIVE_READ:" + $line)\nWrite-Output ("C098_NATIVE_SIZE:" + [Console]::WindowWidth + ":" + [Console]::WindowHeight)\nexit 23\n',{flag:'wx'});
fs.writeFileSync(script,String.raw`defmodule C098Probe do
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker), do: text, else: receive do
      {:data, bytes} -> until(marker, deadline, text <> bytes)
      {:exit, code, signal} -> raise "premature exit #{inspect({code, signal})}: #{inspect(text)}"
    after
      max(1, deadline - System.monotonic_time(:millisecond)) -> raise "output deadline for #{marker}: #{inspect(text)}"
    end
  end
end
:ok = Application.load(:expty)
{:module, ExPTY.Nif} = Code.ensure_loaded(ExPTY.Nif)
parent = self()
exe = Path.join(System.fetch_env!("SystemRoot"), "System32/WindowsPowerShell/v1.0/powershell.exe")
{:ok, pty} = ExPTY.spawn(exe, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", System.fetch_env!("C098_CHILD")], cwd: System.fetch_env!("C098_CWD"), cols: 80, rows: 24, env: System.get_env(), on_data: fn _, _, data -> send(parent, {:data, data}) end, on_exit: fn _, _, code, signal -> send(parent, {:exit, code, signal}) end)
state = :sys.get_state(pty)
ready = C098Probe.until("C098_NATIVE_READY", System.monotonic_time(:millisecond) + 15000)
:ok = ExPTY.resize(pty, 112, 34)
:ok = ExPTY.write(pty, "C098_TYPED_NATIVE\r")
read = C098Probe.until("C098_NATIVE_READ:C098_TYPED_NATIVE", System.monotonic_time(:millisecond) + 15000)
size = C098Probe.until("C098_NATIVE_SIZE:112:34", System.monotonic_time(:millisecond) + 15000, read)
{code, signal} = receive do {:exit, code, signal} -> {code, signal} after 15000 -> raise "no exit" end
23 = code
:ok = GenServer.stop(pty)
false = Process.alive?(pty)
File.write!(System.fetch_env!("C098_RESULT"), inspect(%{status: :passed, os_pid: state.inner_pid, exit_code: code, signal: signal, resize: {112,34}, nif_module: :code.which(ExPTY.Nif), priv: :code.priv_dir(:expty), output: ready <> size}) <> "\n")
IO.puts("C098_NATIVE_BEHAVIOR_PASSED")
`,{flag:'wx'});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(SystemRoot|windir|TEMP|TMP|ComSpec|PATHEXT|USERPROFILE|HOMEDRIVE|HOMEPATH|ALLUSERSPROFILE|ProgramData|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i.test(k)));env.PATH=path.join(process.env.SystemRoot,'System32')+';'+process.env.SystemRoot;Object.assign(env,{C098_CHILD:child,C098_CWD:out,C098_RESULT:result,ERL_CRASH_DUMP:path.join(out,'private-crash.dump')});
const erl=path.join(release,'erts-16.4/bin/erl.exe');const args=['-noshell','-pa',path.join(release,'lib/elixir-1.20.1/ebin'),path.join(release,'lib/logger-1.20.1/ebin'),path.join(app,'ebin'),'-s','elixir','start_cli',script];const startedAt=new Date().toISOString(),start=Date.now(),r=spawnSync(erl,args,{env,cwd:out,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:4e6});
fs.writeFileSync(path.join(out,'stdout.log'),r.stdout||'');fs.writeFileSync(path.join(out,'stderr.log'),r.stderr||'');const report={status:r.status===0&&!r.error&&r.stdout.includes('C098_NATIVE_BEHAVIOR_PASSED')?'passed':'failed',startedAt,finishedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message,signal:r.signal,executable:erl,args,path:env.PATH,producerInputs:hash(path.join(native,'inputs.json')),native:JSON.parse(fs.readFileSync(path.join(native,'native-result.json'),'utf8')).native,source:{scriptSha256:hash(script),childSha256:hash(child)},limits:['Carried runtime on developer host, not clean-machine acceptance','Ordinary CRT still available on host','No helper successful attach/console enumeration claim']};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
