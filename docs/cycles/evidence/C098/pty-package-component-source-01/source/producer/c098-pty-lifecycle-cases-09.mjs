import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{systemRoot,systemTool}=require('../app/main/windows-system-tools'),base='docs/cycles/evidence/C098/';
const prior=JSON.parse(fs.readFileSync(base+'pty-lifecycle-native-08/result.json'));assert.equal(prior.status,'passed');assert.equal(prior.inputsUnchanged,true);
let probe=fs.readFileSync('.git/c098-pty-lifecycle-probe-03.exs','utf8');
const change=(a,b)=>{assert.equal(probe.split(a).length,2,a);probe=probe.replace(a,b);};
change('Enum.reduce(1..3, receipt','Enum.reduce(1..7, receipt');
change('      :ok = ExPTY.write(pty, "finish-" <> child_nonce <> "\\r")\n      callback = C098LifecycleProbe.exit_callback(index, 5000)\n      %{received: true, code: 23, signal: nil} = callback\n      {:error, _} = ExPTY.write(pty, "closed")\n      {:error, _} = ExPTY.write(pty, "closed-again")\n      {:error, _} = ExPTY.resize(pty, 80, 24)',String.raw`      mode = Enum.at(["natural", "natural", "natural", "kill9", "kill15", "wrapper-stop", "wrapper-kill"], index - 1)
      callback = case mode do
        "natural" ->
          :ok = ExPTY.write(pty, "finish-" <> child_nonce <> "\r")
          result = C098LifecycleProbe.exit_callback(index, 5000)
          %{received: true, code: 23, signal: nil} = result
          result
        value when value in ["kill9", "kill15"] ->
          {:error, _} = ExPTY.kill(pty, 2)
          signal = if value == "kill9", do: 9, else: 15
          :ok = ExPTY.kill(pty, signal)
          result = C098LifecycleProbe.exit_callback(index, 5000)
          true = result == %{received: true, code: 128 + signal, signal: signal}
          result
        "wrapper-stop" ->
          :ok = GenServer.stop(pty)
          false = Process.alive?(pty)
          %{received: false, code: nil, signal: nil}
        "wrapper-kill" ->
          monitor = Process.monitor(pty)
          true = Process.exit(pty, :kill)
          receive do
            {:DOWN, ^monitor, :process, ^pty, :killed} -> :ok
          after
            5000 -> raise "wrapper death deadline"
          end
          false = Process.alive?(pty)
          %{received: false, code: nil, signal: nil}
      end
      if Process.alive?(pty) do
        {:error, _} = ExPTY.write(pty, "closed")
        {:error, _} = ExPTY.write(pty, "closed-again")
        {:error, _} = ExPTY.resize(pty, 80, 24)
      end`);
change('          callback: callback,','          callback: callback,\n          mode: mode,');
change('      C098LifecycleProbe.ack(data, "exited-#{index}", nonce)\n      :ok = GenServer.stop(pty)','      C098LifecycleProbe.ack(data, "exited-#{index}", nonce)\n      if Process.alive?(pty), do: GenServer.stop(pty)');
change('  record.(Map.merge(receipt, %{status: "measure", phase: "wrappers-stopped"}))',String.raw`  tracer = Kernel.spawn(fn -> C098LifecycleProbe.trace_loop(self(), parent) end)
  1 = :erlang.trace(parent, true, [:procs, {:tracer, tracer}])
  failures = Enum.map(1..20, fn index ->
    kind = if rem(index, 2) == 1, do: "missing-executable", else: "missing-cwd"
    file = if kind == "missing-executable", do: Path.join(data, "no-executable-#{nonce}.exe"), else: executable
    cwd = if kind == "missing-cwd", do: Path.join(data, "no-cwd-#{nonce}"), else: data
    {:error, reason} = ExPTY.spawn(file, [], cwd: cwd, env: env)
    wrapper = receive do
      {:failed_wrapper, pid, {:proc_lib, :init_p, _}} -> pid
    after
      1000 -> raise "failed spawn wrapper trace deadline"
    end
    false = Process.alive?(wrapper)
    %{index: index, kind: kind, error: reason, wrapper_stopped: true}
  end)
  1 = :erlang.trace(parent, false, [:procs])
  send(tracer, :stop)
  receipt = Map.put(receipt, :failures, failures)
  record.(Map.merge(receipt, %{status: "measure", phase: "failures-stopped"}))
  C098LifecycleProbe.ack(data, "failures-stopped", nonce)
  record.(Map.merge(receipt, %{status: "measure", phase: "wrappers-stopped"}))`);
change('end\n\nout =',String.raw`  def trace_loop(tracer, parent) do
    receive do
      {:trace, ^parent, :spawn, pid, mfa} ->
        send(parent, {:failed_wrapper, pid, mfa})
        trace_loop(tracer, parent)
      :stop -> :ok
      _ -> trace_loop(tracer, parent)
    end
  end
end

out =`);
change('      prototype_natural_exit_passed: true,','      prototype_natural_exit_passed: true,\n      prototype_kill_wrapper_failure_passed: true,');
fs.writeFileSync('.git/c098-pty-lifecycle-probe-09.exs',probe,{flag:'wx'});
const out=path.resolve(base+'pty-lifecycle-parse-09');fs.mkdirSync(out);const script=out+'/parse.exs';fs.writeFileSync(script,'source = File.read!(System.fetch_env!("C098_PROBE_SOURCE"))\n{:__block__, _, [helper | _]} = Code.string_to_quoted!(source)\n[_] = Code.compile_quoted(helper)\nformatted = Code.format_string!(source) |> IO.iodata_to_binary()\nFile.write!(System.fetch_env!("C098_PROBE_SOURCE"), formatted <> <<10>>)\nCode.string_to_quoted!(File.read!(System.fetch_env!("C098_PROBE_SOURCE")))\nIO.puts("C098_PROBE_HELPER_COMPILED")\n',{flag:'wx'});
const release=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked/resources/runtime'),device=out+'/device';fs.mkdirSync(device);const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:device,APPDATA:device,LOCALAPPDATA:device,TEMP:out,TMP:out,PSModuleAnalysisCachePath:out+'/cache',ERL_CRASH_DUMP:out+'/crash.dump',C098_PROBE_SOURCE:path.resolve('.git/c098-pty-lifecycle-probe-09.exs')};
const args=['-noshell','-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',release+'/lib/elixir-1.20.1/ebin',release+'/lib/logger-1.20.1/ebin','-s','elixir','start_cli','-extra',script],start=Date.now(),r=spawnSync(release+'/erts-16.4/bin/erl.exe',args,{env,cwd:out,windowsHide:true,timeout:15000,maxBuffer:4e6});fs.writeFileSync(out+'/stdout.bin',r.stdout||Buffer.alloc(0));fs.writeFileSync(out+'/stderr.bin',r.stderr||Buffer.alloc(0));const parsed={status:r.status===0&&!r.error&&r.stdout.toString().includes('C098_PROBE_HELPER_COMPILED')?'passed':'failed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message||null};fs.copyFileSync('.git/c098-pty-lifecycle-cases-09.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/result.json',JSON.stringify(parsed,null,2)+'\n');assert.equal(parsed.status,'passed',r.stderr.toString());
let parent=fs.readFileSync('.git/c098-pty-lifecycle-native-08.mjs','utf8').replaceAll('pty-lifecycle-native-08','pty-lifecycle-native-09').replaceAll('pty-lifecycle-probe-source-08','pty-lifecycle-probe-source-09').replaceAll('c098-pty-lifecycle-probe-03.exs','c098-pty-lifecycle-probe-09.exs');
const parentChange=(a,b)=>{assert.equal(parent.split(a).length,2,a);parent=parent.replace(a,b);};
parentChange("'.git/c098-pty-lifecycle-json-08.mjs'","'.git/c098-pty-lifecycle-json-08.mjs','.git/c098-pty-lifecycle-cases-09.mjs','.git/c098-pty-lifecycle-build-02/expty/priv/expty.dll','.git/c098-pty-lifecycle-build-02/expty/ebin/Elixir.ExPTY.beam','.git/c098-pty-lifecycle-build-02/expty/ebin/Elixir.ExPTY.Nif.beam','.git/c098-pty-lifecycle-build-02/source/c_src/win/conpty.cc','.git/c098-pty-lifecycle-build-02/source/lib/expty.ex','.git/c098-pty-lifecycle-build-02/source/lib/expty_nif.ex','docs/cycles/evidence/C098/pty-lifecycle-boot-05/start_clean.boot'");
parent=parent.replaceAll('i<=3','i<=7').replaceAll('component.children.length,3','component.children.length,7');
parentChange("assert.deepEqual(component.child.callback,{received:true,code:23,signal:'nil'});", "const mode=['natural','natural','natural','kill9','kill15','wrapper-stop','wrapper-kill'][i-1];assert.equal(component.child.mode,mode);const callback=i<=3?{received:true,code:23,signal:'nil'}:i===4?{received:true,code:137,signal:9}:i===5?{received:true,code:143,signal:15}:{received:false,code:'nil',signal:'nil'};assert.deepEqual(component.child.callback,callback);");
parentChange(" component=await waitFile(path.join(data,'component.json'),r=>r.status==='measure'&&r.phase==='wrappers-stopped',10000);", " component=await waitFile(path.join(data,'component.json'),r=>r.status==='measure'&&r.phase==='failures-stopped',30000);assert.equal(component.failures.length,20);for(const f of component.failures){assert.equal(f.wrapper_stopped,true);assert.ok(['missing-executable','missing-cwd'].includes(f.kind));assert.ok(f.error);}report.failureCases=component.failures;await sample('failures-stopped');fs.writeFileSync(path.join(data,'ack-failures-stopped'),nonce,{flag:'wx'});\n component=await waitFile(path.join(data,'component.json'),r=>r.status==='measure'&&r.phase==='wrappers-stopped',10000);");
parent=parent.replaceAll('Three natural child exits with explicit owned identity/absence checks; callbacks require actual code23/nil within5000ms; prior unpatched gaps remain separate','Three natural exits, forced Windows signals9/15, normal wrapper stop and killed wrapper with exact identity/absence; twenty alternating spawn/connect failures with traced failed-wrapper stop; not all OS races or resource types').replaceAll('all three','all seven').replaceAll('naturally','after scoped teardown').replaceAll('natural owned PTY child exit observed','owned PTY child exit observed');
fs.writeFileSync('.git/c098-pty-lifecycle-native-09.mjs',parent,{flag:'wx'});
const cycle=JSON.parse(fs.readFileSync('docs/cycle.json'));cycle.evidence.push(base+'pty-lifecycle-native-08/result.json',base+'pty-lifecycle-parse-09/result.json');cycle.truthReview+=' Native08 passes36114ms/13checks: three actual callbacks/code23/nil, input/112x34, wrong-owner and closed API refusal, all5 owned PIDs absent. Samples312/100 baseline,315/100 each natural exit,316/100 wrappers stopped. No whole leak-free claim. Native09 extends the same isolated source02 to Windows forced9/15, normal/killed wrapper and twenty alternating missing executable/cwd failures; accepted runtime untouched.';fs.writeFileSync('docs/cycle.json',JSON.stringify(cycle,null,2)+'\n');
console.log(JSON.stringify(parsed));
