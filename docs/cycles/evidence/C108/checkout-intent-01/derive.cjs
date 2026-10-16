const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',plan=JSON.parse(fs.readFileSync(__dirname+'/C108-checkout-intent-next598.json')),out=__dirname+'/C108-checkout-intent599';assert(!fs.existsSync(out));for(const f of plan.sourceFiles)assert.equal(sha(fs.readFileSync(source+'/'+f.file)),f.sha256);fs.mkdirSync(out);for(const f of ['renditions-candidate.exs','SOURCE-LICENSE.txt'])fs.copyFileSync(__dirname+'/C108-checkout-candidate565/'+f,out+'/'+f);
let s=fs.readFileSync(__dirname+'/C108-checkout-candidate565/checkout-candidate.exs','utf8').replaceAll('\r\n','\n');const old='      Barkpark.ManagedRuntime.WriteAdmission.Door.admit(fn ->\n        patch_checkout(doc, file, dataset, nil, nil)\n      end)';assert.equal(s.split(old).length,2);s=s.replace(old,`      if Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?() do
        release_with_intent(doc, file, dataset)
      else
        patch_checkout(doc, file, dataset, nil, nil)
      end`);
const a=s.indexOf('  defp patch_checkout(');assert(a>0);s=s.slice(0,a)+`  # PRIVATE composite intent: declare before Content may commit. The coordinator's
  # existing pending journal plus effect flag retains owner loss while open.
  # This flag declares an obligation; it does not claim that filesystem I/O began.
  defp release_with_intent(doc, file, dataset) do
    server = Barkpark.ManagedRuntime.WriteAdmission.Door.server()
    case intent_checkout(server) do
      {:ok, ticket} ->
        try do
          hook = Application.get_env(:barkpark, :checkout_intent_test_hook)
          if is_function(hook, 2), do: hook.(doc, file)
          case write_checkout(doc, file, dataset, nil, nil) do
            {:ok, updated} ->
              case invalidate_cache(doc, file, updated) do
                :ok -> {{:ok, updated}, :settled}
                error -> {error, :uncertain}
              end
            # Source Writer checks this schema refusal before before_save/DB write.
            # This narrow policy still requires actual scoped no-commit proof.
            {:error, {:schema_validation_failed, _, _}} = error -> {error, :settled}
            error -> {error, :uncertain}
          end
        rescue
          exception ->
            retain_intent(server, ticket)
            reraise exception, __STACKTRACE__
        catch
          kind, value ->
            retain_intent(server, ticket)
            :erlang.raise(kind, value, __STACKTRACE__)
        else
          {result, outcome} -> finish_intent(server, ticket, result, outcome)
        end
      {:error, reason} -> {:error, {:write_admission, reason}}
    end
  end

  defp intent_checkout(nil), do: {:error, :unconfigured}
  defp intent_checkout(server) do
    Barkpark.ManagedRuntime.WriteAdmission.checkout_effect(server)
  catch
    :exit, _ -> {:error, :unavailable}
  end

  defp finish_intent(server, ticket, result, :uncertain) do
    case retain_intent(server, ticket) do
      :ok -> result
      _ -> {:error, :storage_unavailable}
    end
  end
  defp finish_intent(server, ticket, result, :settled) do
    case intent_call(fn -> Barkpark.ManagedRuntime.WriteAdmission.checkin(server, ticket) end) do
      :ok -> result
      _ ->
        retain_intent(server, ticket)
        {:error, :storage_unavailable}
    end
  end
  defp retain_intent(server, ticket),
    do: intent_call(fn -> Barkpark.ManagedRuntime.WriteAdmission.uncertain(server, ticket) end)
  defp intent_call(fun) do
    fun.()
  catch
    :exit, _ -> {:error, :unavailable}
  end

  defp patch_checkout(doc, file, dataset, actor, at) do
    case write_checkout(doc, file, dataset, actor, at) do
      {:ok, updated} ->
        cache_result = if actor == nil, do: invalidate_cache(doc, file, updated), else: :ok
        case cache_result do
          :ok -> {:ok, updated}
          error -> error
        end
      error -> error
    end
  end

  defp write_checkout(doc, file, dataset, actor, at) do
    content =
      (doc.content || %{})
      |> Map.put("checkedOutBy", actor)
      |> Map.put("checkedOutAt", at)
    attrs = %{"doc_id" => doc.doc_id, "title" => doc.title, "status" => doc.status, "content" => content}
    Content.upsert_document(@asset_type, attrs, dataset, [source: :api] ++ MediaFile.scope_opts(file))
  end

  defp invalidate_cache(doc, file, updated) do
    hook = Application.get_env(:barkpark, :checkout_release_test_hook)
    if is_function(hook, 3), do: hook.(doc, file, updated)
    if Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?() do
      key = case file.object_key do
        value when is_binary(value) and byte_size(value) > 0 -> value
        _ -> file.path
      end
      Barkpark.Media.Renditions.delete_for_file(file.id, key)
    else
      Barkpark.Media.Renditions.delete_for_file(file.id)
    end
  end
end
`;
s=s.replace('# Known remaining gap: owner death after Content but before physical upgrade.','# New private intent candidate only; owner-loss/restart/error/ordinary behavior NOT proved.');fs.writeFileSync(out+'/checkout-candidate.exs',s);
fs.writeFileSync(out+'/derivation.json',JSON.stringify({at:new Date().toISOString(),status:'Private implementation only; NOT compiled/executed',basis:'.git/C108-checkout-intent-next598.json',source:plan.sourceFiles,files:fs.readdirSync(out).map(file=>({file,sha256:sha(fs.readFileSync(out+'/'+file))})),changes:plan.implementation,limits:plan.limits,unacceptedPolicy:'Only schema_validation_failed returned error settles before commit based on source ordering. All other returned errors retain conservatively; actual controlled no-commit and ordinary proof required. No blanket error policy accepted.',next:plan.proofSequence},null,2));
let compile=fs.readFileSync(__dirname+'/media-checkout-candidate-compile566-derived.cjs','utf8').replaceAll('C108-checkout-candidate-compile566','C108-checkout-intent-compile600').replaceAll('media-checkout-candidate-compile566.exs','media-checkout-intent-compile600.exs').replaceAll('C108-checkout-candidate565','C108-checkout-intent599');fs.writeFileSync(__dirname+'/media-checkout-intent-compile600.cjs',compile,{flag:'wx'});fs.writeFileSync(__dirname+'/media-checkout-intent-compile600.exs',fs.readFileSync(__dirname+'/media-checkout-candidate-compile566.exs','utf8').replace('Known pre-physical owner-loss semantic gap remains.','New composite intent candidate is unproved; owner-loss/restart/controlled-error/ordinary policy requires actual evidence.'),{flag:'wx'});console.log({privateCandidate:599,compiled:false,executed:false});
