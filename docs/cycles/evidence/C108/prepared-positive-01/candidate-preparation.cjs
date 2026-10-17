const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),replace=(s,a,b)=>{assert(s.includes(a),a);return s.split(a).join(b);},source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',out='.git/C108-controlled-boundary1511';assert(!fs.existsSync(out));
const original=fs.readFileSync(source+'/api/lib/barkpark/media/storage/local_write.ex','utf8'),anchor='  defp checkout(nil), do: {:error, :unconfigured}';assert.equal(original.split(anchor).length,2);
const addition=`  # PRIVATE prepared boundary: the enclosing durable intent remains outstanding
  # through the outer Content transaction. A known preparation refusal never
  # enters the local-effect callback; a later error still retains uncertainty.
  # The existing run/2 remains unchanged. This API requires an outer transaction.
  def prepare_then_run(key, prepare, effect)
      when is_binary(key) and is_function(prepare, 0) and is_function(effect, 1) do
    if Door.enabled?() and Repo.in_transaction?() do
      server = Door.server()
      case checkout(server) do
        {:ok, ticket} ->
          marker = {__MODULE__, make_ref()}
          Process.put(marker, false)
          try do
            result = Repo.transaction(fn ->
              Repo.query!("LOCK TABLE public.media_files IN SHARE ROW EXCLUSIVE MODE")
              refuse_pending(key)
              case prepare.() do
                {:ok, value} ->
                  Process.put(marker, true)
                  effect.(value)
                {:error, _} = error -> error
                _ -> Repo.rollback(:invalid_prepared_local_write)
              end
            end, timeout: 60_000)
            case result do
              {:ok, value} -> finish(server, ticket, value, Process.get(marker))
              {:error, _} -> finish(server, ticket, @storage_error, Process.get(marker))
            end
          rescue
            _error in [Postgrex.Error, DBConnection.ConnectionError, DBConnection.OwnershipError] ->
              finish(server, ticket, @storage_error, Process.get(marker))
          catch
            kind, reason ->
              retain_or_settle(server, ticket, Process.get(marker))
              :erlang.raise(kind, reason, __STACKTRACE__)
          after
            Process.delete(marker)
          end
        _ -> @storage_error
      end
    else
      @storage_error
    end
  end

`;
const local=replace(original,anchor,addition+anchor);assert.equal(local.replace(addition,''),original);
const checkoutOriginal=fs.readFileSync('.git/C108-guard-boundary1434/checkout-candidate.exs','utf8'),old=`      Barkpark.Media.Storage.LocalWrite.run(key, fn ->
        case write_checkout(doc, file, dataset, nil, nil) do
          {:ok, updated} ->
            case invalidate_cache(doc, file, updated) do
              :ok -> {:ok, updated}
              error -> error
            end
          error -> error
        end
      end)`,fresh=`      Barkpark.Media.Storage.LocalWrite.prepare_then_run(key,
        fn -> write_checkout(doc, file, dataset, nil, nil) end,
        fn updated ->
          case invalidate_cache(doc, file, updated) do
            :ok -> {:ok, updated}
            error -> error
          end
        end)
` .trimEnd();const checkout=replace(checkoutOriginal,old,fresh);assert.equal(checkout.replace(fresh,old),checkoutOriginal);
const files=[['local-write-candidate.exs',local],['local-write-original.ex',original],['checkout-candidate.exs',checkout],['checkout-original.exs',checkoutOriginal],['SOURCE-LICENSE.txt',fs.readFileSync('.git/C108-guard-boundary1434/SOURCE-LICENSE.txt')]];
const plan={at:new Date().toISOString(),status:'private_source_implemented_not_compiled_or_executed',source,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),scope:'Small private prepared LocalWrite boundary after measured managed schema recovery retention1478 and ordinary comparison. No production source/PR23205 modification/adoption.',modules:['Barkpark.Media.ImageBackend.Magick','Barkpark.Media.Storage.LocalWrite','Barkpark.Media.Renditions','Barkpark.Media.Storage.Checkout','BarkparkWeb.MediaController'],changes:['Original LocalWrite run/2 and entire original source byte-exact after removing only additive prepare_then_run/3','New managed+outer-transaction-only API obtains the same pending-delete lock/check, then performs actual Content write preparation before local-effect marker; only successful preparation enters cache invalidation','Caller keeps existing durable outer intent through enclosing Broadcast transaction/queue/commit/rollback; exact schema failure can settle inner pre-effect ticket and outer intent after rollback','All other outer errors remain uncertain; later cache error/owner loss keeps durable intent; no blanket error or native-completion acceptance'],proofOrder:['Actual carried release compile FIVE full source/loadedMD5/binary bindings, unchanged three full bindings equal1435; exports prepare_then_run3 plus run2','FIRST fresh full-runtime managed real upload/private asset/cold HTTP200/320JPEG/checkout200/admin undo200, native original/whole media row/cache invalidation/revision notifications/open0/owned stop','Then fresh enforced-schema HTTP422/whole document SAME revision/cache/native original/media row exact/no release-delete hooks/natural owner and fixture DOWN/open0 must be actually observed','Then actual pending SQL precedence and held/ordinary/error/owner-loss/SQL-race regressions for changed composition, no inherited acceptance'],limits:['Implementation/compile are not actual runtime equality or behavior','Preparation executes actual Content code under outer transaction, not a pure-function guarantee; plugin/remote/fullwriter/native census unresolved','Filesystem effects cannot be rolled back by PostgreSQL; physical obligation/uncertainty are not proof of native completion or reconciliation','Do not recover/reopen/clear prior journals or alter real library/S3/source/app/pin/installer/host policy; no independent-review/adoption permission'],runtimeExecuted:false,files:files.map(([file,bytes])=>({file,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)}))};
fs.mkdirSync(out);for(const[file,bytes]of files)fs.writeFileSync(out+'/'+file,bytes,{flag:'wx'});fs.writeFileSync('.git/C108-controlled-boundary-next1511.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
let compile=fs.readFileSync('.git/guard-boundary-compile1435.exs','utf8');compile=replace(compile,'Path.join(root, ".git/C108-guard-compose1344/renditions-candidate.exs")','Path.join(root, ".git/C108-controlled-boundary1511/local-write-candidate.exs"), Path.join(root, ".git/C108-guard-compose1344/renditions-candidate.exs")');compile=replace(compile,'.git/C108-guard-boundary1434/checkout-candidate.exs','.git/C108-controlled-boundary1511/checkout-candidate.exs');compile=replace(compile,'Four private modules','Five private modules');fs.writeFileSync('.git/controlled-boundary-compile1512.exs',compile,{flag:'wx'});let helper=fs.readFileSync('.git/guard-boundary-release1435.cjs','utf8');helper=replace(helper,'C108-guard-boundary-release1435','C108-controlled-boundary-release1512');helper=replace(helper,'guard-boundary-compile1435.exs','controlled-boundary-compile1512.exs');fs.writeFileSync('.git/controlled-boundary-release1512.cjs',helper,{flag:'wx'});console.log({implemented:true,originalRun2ByteExact:true,reversibleCallerDiff:true,runtimeExecuted:false});
