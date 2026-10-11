import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{systemRoot,systemTool}=require('../app/main/windows-system-tools'),base='docs/cycles/evidence/C098/';
const prior=JSON.parse(fs.readFileSync(base+'pty-lifecycle-native-09/result.json'));assert.equal(prior.status,'passed');assert.equal(prior.inputsUnchanged,true);
let child=fs.readFileSync('.git/c098-nif-child-01.ps1','utf8');const ready="Write-Output ('C098_CARRIED_READY:'+$env:C098_NIF_NONCE)";assert.equal(child.split(ready).length,2);child=child.replace(ready,ready+"\nif($env:C098_NIF_HOLD -eq '1'){[Threading.Thread]::Sleep(60000);exit 99}");assert.equal(fs.readFileSync('.git/c098-nif-child-02.ps1','utf8'),child,'Retained child fixture differs');
let probe=fs.readFileSync('.git/c098-pty-lifecycle-probe-09.exs','utf8');const change=(a,b)=>{assert.equal(probe.split(a).length,2,a);probe=probe.replace(a,b);};
change('Enum.reduce(1..7, receipt','Enum.reduce(1..8, receipt');
change('"C098_NIF_NONCE" => child_nonce','"C098_NIF_NONCE" => child_nonce,\n          "C098_NIF_HOLD" => if(index == 8, do: "1", else: "0")');
const a=probe.indexOf('      :ok = ExPTY.resize(pty, 112, 34)'),b=probe.indexOf('      mode =',a);assert.ok(a>=0&&b>a);probe=probe.slice(0,a)+'      if index != 8 do\n'+probe.slice(a,b)+'      end\n'+probe.slice(b);
change('"wrapper-stop", "wrapper-kill"]','"wrapper-stop", "wrapper-kill", "blocked-writer-kill"]');
change('          "wrapper-kill" ->',String.raw`          "blocked-writer-kill" ->
            :ok = ExPTY.on_data(pty, fn _, _, _ -> :ok end)
            writer = Kernel.spawn(fn ->
              result = try do
                {:ok, ExPTY.write(pty, :binary.copy("w", 32 * 1024 * 1024))}
              catch
                :exit, reason -> {:error, reason}
              end
              send(parent, {:writer_result, result})
            end)
            C098LifecycleProbe.blocked_writer(pty, System.monotonic_time(:millisecond) + 5000)
            true = Process.alive?(writer)
            monitor = Process.monitor(pty)
            true = Process.exit(pty, :kill)
            receive do
              {:DOWN, ^monitor, :process, ^pty, :killed} -> :ok
            after
              5000 -> raise "blocked writer wrapper death deadline"
            end
            receive do
              {:writer_result, {:error, _}} -> :ok
              {:writer_result, other} -> raise "write completed before kill: #{inspect(other)}"
            after
              5000 -> raise "blocked writer caller settlement deadline"
            end
            %{received: false, code: nil, signal: nil}
          "wrapper-kill" ->`);
change('          input_readback: true,','          input_readback: index != 8,\n          blocked_writer_observed: index == 8,');
change('          actual_geometry: [112, 34],','          actual_geometry: if(index == 8, do: nil, else: [112, 34]),');
change('  def trace_loop(tracer, parent) do',String.raw`  def blocked_writer(pty, deadline) do
    if System.monotonic_time(:millisecond) > deadline, do: raise("no blocked NIF write observed")
    if Process.info(pty, :current_function) == {:current_function, {ExPTY.Nif, :write, 2}} do
      Process.sleep(100)
      true = Process.info(pty, :current_function) == {:current_function, {ExPTY.Nif, :write, 2}}
      receive do
        {:writer_result, _} -> raise "writer already completed"
      after
        0 -> :ok
      end
    else
      Process.sleep(10)
      blocked_writer(pty, deadline)
    end
  end
  def trace_loop(tracer, parent) do`);
fs.writeFileSync('.git/c098-pty-lifecycle-probe-11.exs',probe,{flag:'wx'});
const out=path.resolve(base+'pty-lifecycle-parse-11');fs.mkdirSync(out);const script=out+'/parse.exs';fs.copyFileSync(base+'pty-lifecycle-parse-09/parse.exs',script);
const release=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked/resources/runtime'),device=out+'/device';fs.mkdirSync(device);const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:device,APPDATA:device,LOCALAPPDATA:device,TEMP:out,TMP:out,PSModuleAnalysisCachePath:out+'/cache',ERL_CRASH_DUMP:out+'/crash.dump',C098_PROBE_SOURCE:path.resolve('.git/c098-pty-lifecycle-probe-11.exs')};
const args=['-noshell','-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',release+'/lib/elixir-1.20.1/ebin',release+'/lib/logger-1.20.1/ebin','-s','elixir','start_cli','-extra',script],start=Date.now(),r=spawnSync(release+'/erts-16.4/bin/erl.exe',args,{env,cwd:out,windowsHide:true,timeout:15000,maxBuffer:4e6});fs.writeFileSync(out+'/stdout.bin',r.stdout||Buffer.alloc(0));fs.writeFileSync(out+'/stderr.bin',r.stderr||Buffer.alloc(0));const parsed={status:r.status===0&&!r.error&&r.stdout.toString().includes('C098_PROBE_HELPER_COMPILED')?'passed':'failed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message||null};fs.copyFileSync('.git/c098-pty-lifecycle-blocked-11.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/result.json',JSON.stringify(parsed,null,2)+'\n');assert.equal(parsed.status,'passed',r.stderr.toString());
let parent=fs.readFileSync('.git/c098-pty-lifecycle-native-09.mjs','utf8').replaceAll('pty-lifecycle-native-09','pty-lifecycle-native-11').replaceAll('pty-lifecycle-probe-source-09','pty-lifecycle-probe-source-11').replaceAll('c098-pty-lifecycle-probe-09.exs','c098-pty-lifecycle-probe-11.exs').replaceAll('c098-nif-child-01.ps1','c098-nif-child-02.ps1');
const parentChange=(a,b)=>{assert.equal(parent.split(a).length,2,a);parent=parent.replace(a,b);};
parentChange("'.git/c098-pty-lifecycle-cases-09.mjs'","'.git/c098-pty-lifecycle-cases-09.mjs','.git/c098-pty-lifecycle-blocked-11.mjs'");
parent=parent.replaceAll('i<=7','i<=8').replaceAll('component.children.length,7','component.children.length,8').replaceAll('all seven','all eight');
parentChange("'wrapper-stop','wrapper-kill'][i-1]","'wrapper-stop','wrapper-kill','blocked-writer-kill'][i-1]");
parentChange('assert.equal(component.child.input_readback,true);','assert.equal(component.child.input_readback,i!==8);assert.equal(component.child.blocked_writer_observed,i===8);');
parentChange('assert.deepEqual(component.child.actual_geometry,[112,34]);',"assert.deepEqual(component.child.actual_geometry,i===8?'nil':[112,34]);");
parentChange('assert.equal(r.input_readback,true);','assert.equal(r.input_readback,r.index!==8);');
parent=parent.replaceAll('twenty alternating spawn/connect failures with traced failed-wrapper stop; not all OS races or resource types','twenty alternating spawn/connect failures with traced failed-wrapper stop; eighth child holds input and observed dirty NIF write is interrupted by wrapper death; not all OS races or resource types');
fs.writeFileSync('.git/c098-pty-lifecycle-native-11.mjs',parent,{flag:'wx'});
const cycle=JSON.parse(fs.readFileSync('docs/cycle.json'));cycle.evidence.push(base+'pty-lifecycle-native-09/result.json',base+'pty-lifecycle-parse-11/result.json');cycle.truthReview+=` Native09 passes${prior.elapsedMs}ms/22checks with all seven child absences, Windows forced9/15 callbacks137/143 and20 actual alternating spawn/connect failures, failed wrappers traced stopped. Final316 handles/100threads vs312/100 baseline; counts stay316/100 from forced9 onward. Native11 additionally probes wrapper death during an observed32MiB blocked dirty-NIF write; no native-source/runtime change.`;fs.writeFileSync('docs/cycle.json',JSON.stringify(cycle,null,2)+'\n');console.log(JSON.stringify(parsed));
