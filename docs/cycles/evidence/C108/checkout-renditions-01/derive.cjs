const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process');const source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',out=__dirname+'/C108-checkout-observers522',hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(out));assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim(),'');const cf='api/lib/barkpark/media/storage/checkout.ex',rf='api/lib/barkpark/media/renditions.ex',checkout=fs.readFileSync(source+'/'+cf,'utf8'),renditions=fs.readFileSync(source+'/'+rf,'utf8');assert.equal(hash(checkout),'3e84809edeaccf54e9175f516c9d561f311210c121d65cad0a255e45d7acfd6f');assert.equal(hash(renditions),'6bfdd39f9ec0994f2f56e0396034b6dca1c35147dc5d3be7afb0495bbd4b1834');
const old='        if actor == nil, do: Barkpark.Media.Renditions.delete_for_file(file.id)';assert.equal(checkout.split(old).length,2);const cb=`        if actor == nil do
          # PRIVATE TEST OBSERVER: Content returned, cache deletion has not started.
          hook = Application.get_env(:barkpark, :checkout_release_test_hook)
          if is_function(hook, 3), do: hook.(doc, file, updated)
          Barkpark.Media.Renditions.delete_for_file(file.id)
        end`;
const original=`  def delete_for_file(media_file_id) when is_binary(media_file_id) do
    dir = Path.join(renditions_root(), media_file_id)
    File.rm_rf(dir)
    :ok
  end`;assert.equal(renditions.split(original).length,2);const observed=`  def delete_for_file(media_file_id) when is_binary(media_file_id) do
    dir = Path.join(renditions_root(), media_file_id)
    result = File.rm_rf(dir)
    # PRIVATE TEST OBSERVER: preserve the existing unconditional :ok return.
    hook = Application.get_env(:barkpark, :rendition_delete_result_test_hook)
    if is_function(hook, 3), do: hook.(media_file_id, dir, result)
    :ok
  end`;
fs.mkdirSync(out);fs.copyFileSync(source+'/LICENSE',out+'/SOURCE-LICENSE.txt');fs.writeFileSync(out+'/checkout-observed.exs','# PRIVATE OBSERVER ONLY; Apache-2.0 LICENSE retained. No source/release patch.\n'+checkout.replace(old,cb));fs.writeFileSync(out+'/renditions-observed.exs','# PRIVATE OBSERVER ONLY; Apache-2.0 LICENSE retained. No error-policy or admission repair.\n'+renditions.replace(original,observed));fs.writeFileSync(out+'/derivation.json',JSON.stringify({at:new Date().toISOString(),status:'Prepared only, NOT compiled or executed',source:'fce63d25ee134d11d9138ab369c3146e75b90f19',originals:[{file:cf,sha256:hash(checkout)},{file:rf,sha256:hash(renditions)}],files:fs.readdirSync(out).sort().map(file=>({file,sha256:hash(fs.readFileSync(out+'/'+file))})),changes:['Checkout observer after successful Content.upsert, before actual cache delete, only for release actor==nil','Renditions observer of actual File.rm_rf result; unconditional :ok unchanged'],limits:'Only private copies for a future owned full-runtime fixture. No production repair/adoption, source change, real data, cleanup permission or acceptance.'},null,2)+'\n');console.log({prepared:'522',observers:2,compiled:false,executed:false});
