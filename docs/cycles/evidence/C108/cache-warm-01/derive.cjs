const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process');const source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',out=__dirname+'/C108-cache-warm490',hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(out));assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim(),'');
const file='api/lib/barkpark/media/blobstore/s3.ex',original=fs.readFileSync(source+'/'+file,'utf8');assert.equal(hash(original),'18d7e7fbc2391113912eed7cab27e4cff97b03683a987ee872a5d596de4a2515');const old=`  defp warm_cache(relative_path, source_path) do
    full_path = Media.file_path(relative_path)

    with :ok <- File.mkdir_p(Path.dirname(full_path)) do
      File.cp(source_path, full_path)
    end
  end`;
assert.equal(original.split(old).length,2);const effect=`    with :ok <- File.mkdir_p(Path.dirname(full_path)) do
      result = File.cp(source_path, full_path)
      if result == :ok do
        # PRIVATE TEST ONLY: bytes exist, caller has not inserted its media row.
        hook = Application.get_env(:barkpark, :cache_warm_test_hook)
        if is_function(hook, 2), do: hook.(relative_path, full_path)
      end
      result
    end`;
const plain='  defp warm_cache(relative_path, source_path) do\n    full_path = Media.file_path(relative_path)\n\n'+effect+'\n  end',guarded='  defp warm_cache(relative_path, source_path) do\n    full_path = Media.file_path(relative_path)\n\n    Barkpark.Media.Storage.LocalWrite.run(relative_path, fn ->\n'+effect.split('\n').map(l=>'  '+l).join('\n')+'\n    end)\n  end';
fs.mkdirSync(out);fs.copyFileSync(source+'/LICENSE',out+'/SOURCE-LICENSE.txt');fs.writeFileSync(out+'/source-original.exs',original);for(const [name,block] of [['original-barrier.exs',plain],['candidate-barrier.exs',guarded]])fs.writeFileSync(out+'/'+name,'# PRIVATE TEST ONLY: derived from Barkpark '+file+' at fce63d25. Apache-2.0 LICENSE retained; source/release unchanged.\n'+original.replace(old,block));
fs.writeFileSync(out+'/derivation.json',JSON.stringify({at:new Date().toISOString(),status:'Prepared only; not compiled or executed',source:'fce63d25ee134d11d9138ab369c3146e75b90f19',file,sourceSha256:hash(original),files:fs.readdirSync(out).sort().map(file=>({file,sha256:hash(fs.readFileSync(out+'/'+file))})),originalVariant:'Only hook after successful File.cp, before warm_cache/put_file returns to actual Media.upload row insertion.',candidateVariant:'Same hook plus unchanged LocalWrite.run around both mkdir and File.cp; existing best-effort caller semantics otherwise unchanged.',requiredNext:'Fresh claim/live preflight; compile and bind private modules, boot owned synthetic full backend, prove real Media.upload resolves intended scope and reaches barrier after real loopback PUT/HEAD. Kill only its owned worker; inspect actual admission/rows/native bytes and restart. First failure retained.',limits:'No execution proof or production repair. Same module name only inside later owned private VM; do not copy into source/release. No real account/library, recovery/purge, source freeze expansion, merge/deployment or stage acceptance.'},null,2)+'\n');console.log({prepared:'490',variants:2,compiled:false,sourceUnchanged:true});
