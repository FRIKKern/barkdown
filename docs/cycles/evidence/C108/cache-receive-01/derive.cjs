const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim(),'');
const file='api/lib/barkpark/media/blobstore/s3.ex';const original=fs.readFileSync(source+'/'+file,'utf8');
let code=original.replace('defmodule Barkpark.Media.Blobstore.S3 do','defmodule Barkpark.Media.Blobstore.S3.ReceiveCandidate do');assert.notEqual(code,original);
const old='      download(relative_path, full_path)';assert.equal(code.split(old).length,2);code=code.replace(old,'      Barkpark.ManagedRuntime.WriteAdmission.Door.admit(fn -> download(relative_path, full_path) end)');
const start=code.indexOf('  defp download(relative_path, full_path) do');const end=code.indexOf('\n  # The `into:` streaming collector',start);assert(start>0&&end>start);
const replacement=`  defp download(relative_path, full_path) do
    url = Presign.url("GET", key_for(relative_path), presign_config(), expires_in: presign_ttl())
    tmp_path = full_path <> ".part-#{System.unique_integer([:positive])}"

    # TEST-ONLY CANDIDATE: receive before local mutation. Ordinary admission
    # spans network; actual LocalWrite upgrades and locks only local effects.
    with {:ok, %Req.Response{status: 200} = response} <-
           req(:get, url, into: download_collector()),
         :ok <- refuse_over_cap(response) do
      Barkpark.Media.Storage.LocalWrite.run(relative_path, fn ->
        # Explicit fixture barrier after the actual pending-address check/lock.
        hook = Application.get_env(:barkpark, :cache_receive_test_hook)
        if is_function(hook, 0), do: hook.()
        with :ok <- File.mkdir_p(Path.dirname(full_path)),
             :ok <- File.write(tmp_path, response.body),
             :ok <- File.rename(tmp_path, full_path) do
          {:ok, full_path}
        else
          other ->
            _ = File.rm(tmp_path)
            Logger.warning("ReceiveCandidate local cache failure: #{inspect(other)}")
            {:error, :storage_unavailable}
        end
      end)
    else
      {:ok, %Req.Response{status: 404}} -> {:error, :not_found}
      _ -> {:error, :storage_unavailable}
    end
  end
`;
code=code.slice(0,start)+replacement+code.slice(end);
code='# Derived test-only candidate from Barkpark '+file+' at fce63d25. Apache-2.0; source LICENSE retained alongside the evidence. No source patch/adoption.\n'+code;
fs.writeFileSync(__dirname+'/media-cache-receive434.exs',code,{flag:'wx'});
fs.copyFileSync(source+'/LICENSE',__dirname+'/C108-cache-source-LICENSE434.txt');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
fs.writeFileSync(__dirname+'/C108-cache-derivation434.json',JSON.stringify({at:new Date().toISOString(),source:'fce63d25ee134d11d9138ab369c3146e75b90f19',file,sourceSha256:hash(original),derivedSha256:hash(code),module:'Barkpark.Media.Blobstore.S3.ReceiveCandidate',changes:['New module name only; original module remains loaded unchanged','Door.admit around cache miss','Move mkdir after bounded object receive','Actual LocalWrite.run around local mkdir/write/rename/cleanup','Explicit test-only barrier after actual LocalWrite lock/address check'],limits:'Private compiled candidate; no source/runtime patch. Does not establish HTTP adoption, pending-delete race, identity/child/complete caller coverage or production error policy.'},null,2)+'\n',{flag:'wx'});
console.log({derived:'434',sourceUnchanged:true,bytes:Buffer.byteLength(code)});
