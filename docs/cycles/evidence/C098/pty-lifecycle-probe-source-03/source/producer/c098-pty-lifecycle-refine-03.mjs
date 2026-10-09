import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{systemRoot,systemTool}=require('../app/main/windows-system-tools'),base='docs/cycles/evidence/C098/';
const prior=JSON.parse(fs.readFileSync(base+'pty-lifecycle-native-02/result.json'));assert.equal(prior.status,'failed');assert.equal(prior.inputsUnchanged,true);
let probe=fs.readFileSync('.git/c098-pty-lifecycle-probe-02.exs','utf8');const a=probe.indexOf('  def until('),b=probe.indexOf('  def exit_callback',a);assert.ok(a>=0&&b>a);
probe=probe.slice(0,a)+String.raw`  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker) do
      text
    else
      receive do
        {:data, _, bytes} -> until(marker, deadline, text <> bytes)
        {:exit, index, code, signal} -> raise "premature/duplicate exit #{inspect({index, code, signal})}"
      after
        max(1, deadline - System.monotonic_time(:millisecond)) -> raise "PTY output deadline"
      end
    end
  end
`+probe.slice(b);
fs.writeFileSync('.git/c098-pty-lifecycle-probe-03.exs',probe,{flag:'wx'});
const out=path.resolve(base+'pty-lifecycle-parse-03');fs.mkdirSync(out);const script=out+'/parse.exs';fs.writeFileSync(script,'source = File.read!(System.fetch_env!("C098_PROBE_SOURCE"))\n{:__block__, _, [helper | _]} = Code.string_to_quoted!(source)\n[_] = Code.compile_quoted(helper)\nformatted = Code.format_string!(source) |> IO.iodata_to_binary()\nFile.write!(System.fetch_env!("C098_PROBE_SOURCE"), formatted <> <<10>>)\nCode.string_to_quoted!(File.read!(System.fetch_env!("C098_PROBE_SOURCE")))\nIO.puts("C098_PROBE_HELPER_COMPILED")\n',{flag:'wx'});
const release=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked/resources/runtime'),device=out+'/device';fs.mkdirSync(device);const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:device,APPDATA:device,LOCALAPPDATA:device,TEMP:out,TMP:out,PSModuleAnalysisCachePath:out+'/cache',ERL_CRASH_DUMP:out+'/crash.dump',C098_PROBE_SOURCE:path.resolve('.git/c098-pty-lifecycle-probe-03.exs')};
const args=['-noshell','-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',release+'/lib/elixir-1.20.1/ebin',release+'/lib/logger-1.20.1/ebin','-s','elixir','start_cli','-extra',script],start=Date.now(),r=spawnSync(release+'/erts-16.4/bin/erl.exe',args,{env,cwd:out,windowsHide:true,timeout:15000,maxBuffer:4e6});fs.writeFileSync(out+'/stdout.bin',r.stdout||Buffer.alloc(0));fs.writeFileSync(out+'/stderr.bin',r.stderr||Buffer.alloc(0));const result={status:r.status===0&&!r.error&&r.stdout.toString().includes('C098_PROBE_HELPER_COMPILED')?'passed':'failed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message||null,reason:'AST parsing did not catch ambiguous keyword if/receive macro; explicit nested blocks and helper semantic compilation before launch',nativeBuildChanged:false};fs.copyFileSync('.git/c098-pty-lifecycle-refine-03.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');assert.equal(result.status,'passed',r.stderr.toString());
let parent=fs.readFileSync('.git/c098-pty-lifecycle-native-02.mjs','utf8').replaceAll('pty-lifecycle-native-02','pty-lifecycle-native-03').replaceAll('pty-lifecycle-probe-source-02','pty-lifecycle-probe-source-03').replaceAll('c098-pty-lifecycle-probe-02.exs','c098-pty-lifecycle-probe-03.exs');parent=parent.replace("'.git/c098-pty-lifecycle-refine-02.mjs'","'.git/c098-pty-lifecycle-refine-02.mjs','.git/c098-pty-lifecycle-refine-03.mjs'");parent=parent.replace('no database/HTTP/provider/account/real-profile/library/sibling/candidate/installer change','no database/HTTP/provider/account/real-profile/library/sibling/accepted-runtime/installer change; private prototype selected');fs.writeFileSync('.git/c098-pty-lifecycle-native-03.mjs',parent,{flag:'wx'});
const cycle=JSON.parse(fs.readFileSync('docs/cycle.json'));cycle.evidence.push(base+'pty-lifecycle-native-02/result.json',base+'pty-lifecycle-parse-03/result.json');cycle.truthReview+=' Native02 fixture semantic compile fails8146ms before NIF behavior; AST parse alone was insufficient. Explicit nested receive/if helper now semantic-compiles before03 launch. Both failures and native inputs remain exact.';fs.writeFileSync('docs/cycle.json',JSON.stringify(cycle,null,2)+'\n');
console.log(JSON.stringify(result));
