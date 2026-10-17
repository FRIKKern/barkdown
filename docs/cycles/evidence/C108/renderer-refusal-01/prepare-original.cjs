const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');const root=__dirname+'/..',source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',prep=__dirname+'/C108-renderer-refusal746',file='api/lib/barkpark/media/image_backend/magick.ex',original=fs.readFileSync(source+'/'+file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(prep));fs.mkdirSync(prep);const old=`  defp magick_bin do
    Keyword.get(config(), :bin) ||
      System.find_executable("magick") ||
      System.find_executable("convert")
  end`.replace(/\n/g,'\r\n');assert(original.includes(old));let candidate=original.replace(old,`  defp magick_bin do
    candidate =
      Keyword.get(config(), :bin) ||
        System.find_executable("magick") ||
        System.find_executable("convert")

    # PRIVATE bounded candidate: Windows' built-in convert is a filesystem
    # utility, not ImageMagick. Refuse that known path before System.cmd.
    # Other explicit/legacy choices retain existing behavior; this is not
    # executable identity validation or an alias/symlink security boundary.
    if known_windows_system_convert?(candidate), do: nil, else: candidate
  end

  defp known_windows_system_convert?(candidate) when is_binary(candidate) do
    case :os.type() do
      {:win32, _} ->
        system_root = System.get_env("SystemRoot") || System.get_env("WINDIR")
        if is_binary(system_root) and Path.type(system_root) == :absolute do
          expected = Path.join([system_root, "System32", "convert.exe"])
          String.downcase(Path.expand(candidate)) == String.downcase(Path.expand(expected))
        else
          false
        end

      _ ->
        false
    end
  end

  defp known_windows_system_convert?(_), do: false`.replace(/\n/g,'\r\n'));candidate='# PRIVATE CANDIDATE ONLY; Apache-2.0 source/license retained. No production adoption.\r\n'+candidate;fs.writeFileSync(prep+'/magick-candidate.exs',candidate);fs.writeFileSync(prep+'/magick-original.exs',original);fs.copyFileSync(source+'/LICENSE',prep+'/SOURCE-LICENSE.txt');fs.writeFileSync(prep+'/derivation.json',JSON.stringify({at:new Date().toISOString(),source:'fce63d25ee134d11d9138ab369c3146e75b90f19',file,originalSha256:sha(original),candidateSha256:sha(candidate),change:'Only final known Windows SystemRoot/System32/convert.exe path rejection in resolver; nil returns existing imagemagick_not_found branch. Not executable identity/alias security or general validation.',otherOrdinaryChoices:'Unchanged by source trace only; valid dedicated/legacy renderer and POSIX contract tests not executed',status:'Prepared/unexecuted; frozen source/release/app/pin unchanged'},null,2)+'\n');const plan={at:new Date().toISOString(),task:'task-0571ac0327eced87',status:'Private candidate prepared; actual behavior unexecuted',dependency:'Publish renderer resolution732/root23/exact hosted join first',outcome:'Actual full-runtime known-System32 resolver refusal/no-native-render contract in a private Magick module only.',steps:['Compile one exact private module with loaded MD5/source/binary binding separately; compile exact fixture body without executing it.','Fresh owned full-runtime boot compiles private Magick before app start; actual stock ImageBackend selects it, isolated system PATH remains unchanged. Bind four stock owner beams and actual private Magick loaded binary.','Actual availablefalse on default fallback; actual render returns imagemagick_not_found before native branch and creates no output. Repeat only explicit known System32 path variants (case/separator normalization), restore owned config, no host PATH/policy change.','Trusted open0/media snapshot/runtime6193/three renderer owners/five baseline owners/205originals/pin exact; stop owned backend/PG and retain first failure/data. No real renderer/safe binary/alias security/ordinary dedicated legacy compatibility claim.'],budget:'15minute bounded compile/one owned lifecycle or first retained failure; no duplicate after timeout',limits:'Private bounded known-path refusal only; no frozen source adoption, real ImageMagick native-child/alias security/full writer/identity/policy acceptance, real library/S3, host install/policy, reviewer spawn, recovery/cleanup/purge, merge/deployment.'};fs.writeFileSync(__dirname+'/C108-renderer-refusal-next745.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});for(const name of ['boot.exs','host.cjs']){let s=fs.readFileSync(__dirname+'/C108-rendition-preflight730/'+name,'utf8').replaceAll('C108-rendition-preflight730','C108-renderer-refusal746');if(name==='boot.exs'){const anchor='# Stock modules only; read-only fixture after full application start.';assert(s.includes(anchor));s=s.replace(anchor,`# Private known-system-path refusal candidate, before full application start.
bindings = for {mod, binary} <- Code.compile_file("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-refusal746/magick-candidate.exs") do
  {:ok, {^mod, md5}} = :beam_lib.md5(binary)
  ^md5 = mod.module_info(:md5)
  %{module: inspect(mod), source: "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-refusal746/magick-candidate.exs", source_sha256: Base.encode16(:crypto.hash(:sha256, File.read!("C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-renderer-refusal746/magick-candidate.exs")), case: :lower), binary_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
end
File.write!(Path.join(System.fetch_env!("C108_CHECKOUT_OUTPUT"), "candidate-bindings.json"), JSON.encode!(bindings))`);}fs.writeFileSync(prep+'/'+name,s);}fs.copyFileSync(__dirname+'/C108-rendition-preflight730/read-exe-metadata.ps1',prep+'/read-exe-metadata.ps1');console.log({prepared:746,sourceSha256:sha(original),candidateSha256:sha(candidate),executed:false});
