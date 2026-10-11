import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{systemRoot,systemTool}=require('../app/main/windows-system-tools');
const base='docs/cycles/evidence/C098/',out=path.resolve(base+'pty-lifecycle-boot-review-01'),release=path.resolve('app/release/C098 Packaged Chø 03/win-unpacked/resources/runtime'),original=release+'/releases/0.1.0/start_clean.boot',candidate=path.resolve(base+'pty-lifecycle-boot-05/start_clean.boot'),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
fs.mkdirSync(out);const before=[original,candidate].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync(out+'/compare.exs',String.raw`defmodule C098BootCompare do
  def differences(a, b, path) when a === b, do: []
  def differences(a, b, path) when is_tuple(a) and is_tuple(b) and tuple_size(a) == tuple_size(b) do
    Enum.flat_map(0..(tuple_size(a)-1), fn index -> differences(elem(a,index),elem(b,index),path ++ [index]) end)
  end
  def differences(a, b, path) when is_list(a) and is_list(b) do
    if a == ~c"$RELEASE_LIB/expty-0.2.1/ebin" and b == ~c"$C098_EXPTY/ebin" do
      [%{path: path, original: List.to_string(a), candidate: List.to_string(b)}]
    else
      true = length(a) == length(b)
      Enum.zip(a,b) |> Enum.with_index() |> Enum.flat_map(fn {{left,right},index} -> differences(left,right,path ++ [index]) end)
    end
  end
  def differences(a, b, path), do: raise("unapproved boot difference #{inspect({path,a,b})}")
end
original = :erlang.binary_to_term(File.read!(System.fetch_env!("C098_ORIGINAL_BOOT")))
candidate = :erlang.binary_to_term(File.read!(System.fetch_env!("C098_PRIVATE_BOOT")))
differences = C098BootCompare.differences(original, candidate, [])
2 = length(differences)
File.write!(Path.join(System.fetch_env!("C098_COMPARE_OUT"),"comparison.json"),:json.encode(%{status: "passed", differences: differences, all_other_terms_equal: true}) |> IO.iodata_to_binary())
IO.puts("C098_BOOT_INDEPENDENT_COMPARISON")
`,{flag:'wx'});
fs.mkdirSync(out+'/device');const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),USERPROFILE:out+'/device',APPDATA:out+'/device',LOCALAPPDATA:out+'/device',TEMP:out,TMP:out,ERL_CRASH_DUMP:out+'/crash.dump',C098_ORIGINAL_BOOT:original,C098_PRIVATE_BOOT:candidate,C098_COMPARE_OUT:out};
const args=['-noshell','-boot',release+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',release+'/lib','-pa',release+'/lib/elixir-1.20.1/ebin',release+'/lib/logger-1.20.1/ebin','-s','elixir','start_cli','-extra',out+'/compare.exs'],start=Date.now(),r=spawnSync(release+'/erts-16.4/bin/erl.exe',args,{env,cwd:out,windowsHide:true,timeout:15000,maxBuffer:4e6});
fs.writeFileSync(out+'/stdout.bin',r.stdout||Buffer.alloc(0));fs.writeFileSync(out+'/stderr.bin',r.stderr||Buffer.alloc(0));fs.copyFileSync('.git/c098-pty-lifecycle-boot-review-01.mjs',out+'/producer.mjs');for(const f of before)assert.equal(sha(f.file),f.sha256);
const result={status:r.status===0&&!r.error&&r.stdout.toString().includes('C098_BOOT_INDEPENDENT_COMPARISON')?'passed':'failed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,error:r.error?.message||null,inputs:before,reason:'Independent structural comparison of decoded original/private terms; original remap receipt compared the transform with itself, which was insufficient evidence',acceptedRuntimeChanged:false};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');assert.equal(result.status,'passed',r.stderr.toString());console.log(JSON.stringify(result));
