const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root='C:/Users/Frikk/Documents/GitHub/barkdown',source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',out=__dirname+'/C108-checkout-candidate565',owners=JSON.parse(fs.readFileSync(__dirname+'/C108-checkout-next521.json')).sourceOwners;assert(!fs.existsSync(out));for(const f of owners)assert.equal(sha(fs.readFileSync(source+'/'+f.file)),f.sha256);fs.mkdirSync(out);fs.copyFileSync(__dirname+'/C108-checkout-observers522/SOURCE-LICENSE.txt',out+'/SOURCE-LICENSE.txt');
let checkout=fs.readFileSync(__dirname+'/C108-checkout-observers522/checkout-observed.exs','utf8').replaceAll('\r\n','\n');const old='      patch_checkout(doc, file, dataset, nil, nil)';assert.equal(checkout.split(old).length,2);checkout=checkout.replace(old,'      Barkpark.ManagedRuntime.WriteAdmission.Door.admit(fn ->\n        patch_checkout(doc, file, dataset, nil, nil)\n      end)');
const start=checkout.indexOf('        if actor == nil do\n'),end=checkout.indexOf('\n\n      error ->',start);assert(start>=0&&end>start);const original=checkout.slice(start,end);assert(original.includes('checkout_release_test_hook')&&original.endsWith('        {:ok, updated}'));
checkout=checkout.slice(0,start)+`        cache_result = if actor == nil do
          hook = Application.get_env(:barkpark, :checkout_release_test_hook)
          if is_function(hook, 3), do: hook.(doc, file, updated)
          if Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?() do
            # Private candidate: original address comes from the loaded MediaFile.
            key = case file.object_key do
              value when is_binary(value) and byte_size(value) > 0 -> value
              _ -> file.path
            end
            Barkpark.Media.Renditions.delete_for_file(file.id, key)
          else
            Barkpark.Media.Renditions.delete_for_file(file.id)
          end
        else
          :ok
        end
        case cache_result do
          :ok -> {:ok, updated}
          error -> error
        end`+checkout.slice(end);
checkout='# PRIVATE CANDIDATE ONLY; Apache-2.0 LICENSE retained; no production adoption.\n# Known remaining gap: owner death after Content but before physical upgrade.\n'+checkout;
let renditions=fs.readFileSync(__dirname+'/C108-checkout-observers522/renditions-observed.exs','utf8').replaceAll('\r\n','\n');const anchor='  # Reachability: `dest` is `Media.file_path/1`';assert.equal(renditions.split(anchor).length,2);
renditions=renditions.replace(anchor,`  # PRIVATE candidate arity: only the loaded Checkout caller supplies this key.
  # Original arity and other/deferred callers remain unchanged and unproven.
  def delete_for_file(media_file_id, original_key)
      when is_binary(media_file_id) and is_binary(original_key) do
    Barkpark.Media.Storage.LocalWrite.run(original_key, fn ->
      dir = Path.join(renditions_root(), media_file_id)
      hook = Application.get_env(:barkpark, :rendition_delete_before_test_hook)
      if is_function(hook, 3), do: hook.(media_file_id, dir, original_key)
      result = File.rm_rf(dir)
      observed = Application.get_env(:barkpark, :rendition_delete_result_test_hook)
      if is_function(observed, 3), do: observed.(media_file_id, dir, result)
      case result do
        {:ok, _removed} ->
          # A narrow path postcondition, not native exclusion or identity proof.
          case File.lstat(dir) do
            {:error, :enoent} -> :ok
            _ -> {:error, :storage_unavailable}
          end
        _ -> {:error, :storage_unavailable}
      end
    end)
  end

`+anchor);
renditions='# PRIVATE CANDIDATE ONLY; Apache-2.0 LICENSE retained; no production adoption.\n'+renditions;fs.writeFileSync(out+'/checkout-candidate.exs',checkout);fs.writeFileSync(out+'/renditions-candidate.exs',renditions);
const plan={at:new Date().toISOString(),status:'Private implementation only; NOT compiled/executed',source:'fce63d25ee134d11d9138ab369c3146e75b90f19',originals:owners,files:fs.readdirSync(out).map(file=>({file,sha256:sha(fs.readFileSync(out+'/'+file))})),changes:['Authorization/read ordering preserved; logical Door before release Content transition','Ordinary path uses unchanged original delete_for_file/1 and return shape','Managed caller carries loaded original key into private arity2/current LocalWrite DB/address/physical guard','Actual rm_rf error/residual postcondition returns storage_unavailable; LocalWrite retains uncertain physical ticket','Original helper/deferred callers unchanged; hooks observe only private owned fixture'],remaining:['Owner death after committed Content before LocalWrite physical upgrade is still a known semantic window. This private candidate is incomplete and cannot establish full action settlement.','Directory lstat absence is not native identity/exclusion; aliases/native children/late writes unproven.','Generic HTTP privilege/refusal, pending-delete race around document transition, error/partial acknowledgement/restart policy and candidate ordinary matrix not proven.','Conservative no-op/controlled-failure recovery policy remains unaccepted; no automatic recovery or cleanup.'],next:'Separate compile/bind only, then first full-runtime scoped success plus held refusal/closing drain/locked partial return. Do not broaden sourcePR23205 or claim adoption/atomicity.'};fs.writeFileSync(out+'/derivation.json',JSON.stringify(plan,null,2));console.log({privateImplemented:true,compiled:false,executed:false,knownPrePhysicalOwnerLossGap:true});
