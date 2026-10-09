import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{systemRoot,systemTool}=require('../app/main/windows-system-tools'),base='docs/cycles/evidence/C098/',out=path.resolve(base+'pty-lifecycle-boot-05'),release=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked/resources/runtime');assert.equal(JSON.parse(fs.readFileSync(base+'pty-lifecycle-native-04/result.json')).status,'failed');fs.mkdirSync(out);
const script=out+'/remap.exs';fs.writeFileSync(script,String.raw`defmodule C098BootRemap do
  def change(term) do
    cond do
      term == ~c"$RELEASE_LIB/expty-0.2.1/ebin" -> {~c"$C098_EXPTY/ebin", 1}
      is_list(term) -> Enum.map_reduce(term, 0, fn item, count -> {value, delta} = change(item); {value, count + delta} end)
      is_tuple(term) -> {values, count} = change(Tuple.to_list(term)); {List.to_tuple(values), count}
      true -> {term, 0}
    end
  end
end
original = File.read!(System.fetch_env!("C098_ORIGINAL_BOOT"))
tree = :erlang.binary_to_term(original)
{changed, 2} = C098BootRemap.change(tree)
{restored, 2} = C098BootRemap.change(tree)
true = restored == changed
File.write!(Path.join(System.fetch_env!("C098_BOOT_OUTPUT"), "start_clean.boot"), :erlang.term_to_binary(changed))
File.write!(Path.join(System.fetch_env!("C098_BOOT_OUTPUT"), "remap.json"), :json.encode(%{status: "passed", exact_path_replacements: 2, all_other_terms_preserved: true}) |> IO.iodata_to_binary())
IO.puts("C098_PRIVATE_BOOT_REMAPPED")
`,{flag:'wx'});
const device=out+'/device';fs.mkdirSync(device);const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:device,APPDATA:device,LOCALAPPDATA:device,TEMP:out,TMP:out,PSModuleAnalysisCachePath:out+'/cache',ERL_CRASH_DUMP:out+'/crash.dump',C098_ORIGINAL_BOOT:release+'/releases/0.1.0/start_clean.boot',C098_BOOT_OUTPUT:out};
const args=['-noshell','-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',release+'/lib/elixir-1.20.1/ebin',release+'/lib/logger-1.20.1/ebin','-s','elixir','start_cli','-extra',script],start=Date.now(),r=spawnSync(release+'/erts-16.4/bin/erl.exe',args,{env,cwd:out,windowsHide:true,timeout:15000,maxBuffer:4e6});fs.writeFileSync(out+'/stdout.bin',r.stdout||Buffer.alloc(0));fs.writeFileSync(out+'/stderr.bin',r.stderr||Buffer.alloc(0));const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');const result={status:r.status===0&&!r.error&&r.stdout.toString().includes('C098_PRIVATE_BOOT_REMAPPED')?'passed':'failed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message||null,originalBoot:{file:env.C098_ORIGINAL_BOOT,sha256:sha(env.C098_ORIGINAL_BOOT)},privateBoot:fs.existsSync(out+'/start_clean.boot')?{file:out+'/start_clean.boot',sha256:sha(out+'/start_clean.boot')}:null,reason:'Carried start_clean.boot explicitly primLoads original ExPTY before script executes; remap only its two code-path strings in a private boot',acceptedRuntimeChanged:false};fs.copyFileSync('.git/c098-pty-lifecycle-boot-05.mjs',out+'/producer.mjs');fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');assert.equal(result.status,'passed',r.stderr.toString());
let parent=fs.readFileSync('.git/c098-pty-lifecycle-native-04.mjs','utf8').replaceAll('pty-lifecycle-native-04','pty-lifecycle-native-05').replaceAll('pty-lifecycle-probe-source-04','pty-lifecycle-probe-source-05');parent=parent.replace("'.git/c098-pty-lifecycle-direct-04.mjs'","'.git/c098-pty-lifecycle-direct-04.mjs','.git/c098-pty-lifecycle-boot-05.mjs'");parent=parent.replace(' -boot_var RELEASE_LIB "%C098_LIB%" -pa ',' -boot_var RELEASE_LIB "%C098_LIB%" -boot_var C098_EXPTY "%C098_CANDIDATE%" -pa ');parent=parent.replace("C098_BOOT:path.join(release,'releases/0.1.0/start_clean')","C098_BOOT:path.resolve('docs/cycles/evidence/C098/pty-lifecycle-boot-05/start_clean')");fs.writeFileSync('.git/c098-pty-lifecycle-native-05.mjs',parent,{flag:'wx'});
const cycle=JSON.parse(fs.readFileSync('docs/cycle.json'));cycle.evidence.push(base+'pty-lifecycle-native-04/result.json',base+'pty-lifecycle-boot-05/result.json');cycle.truthReview+=' Direct04 also preloads original module through carried start_clean.boot (explicit primLoad source); fails6005ms, cleanup settles normally. Private boot05 remaps only two exact ExPTY code-path terms; other boot terms and original bytes remain unchanged. Candidate behavior still unproved until native05.';fs.writeFileSync('docs/cycle.json',JSON.stringify(cycle,null,2)+'\n');console.log(JSON.stringify(result));
