const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const prior='.git/C108-guard-compose1344/checkout-candidate.exs',before=fs.readFileSync(prior,'utf8'),start=before.indexOf('          case write_checkout(doc, file, dataset, nil, nil) do'),end=before.indexOf('\n        rescue',start);assert(start>=0&&end>start);const removed=before.slice(start,end);assert(removed.includes('error -> {error, :uncertain}'));assert(!before.includes('release_under_database_boundary'));
const replacement=`          case release_under_database_boundary(doc, file, dataset) do
            {:ok, _updated} = ok -> {ok, :settled}
            {:error, {:schema_validation_failed, _, _}} = error -> {error, :settled}
            error -> {error, :uncertain}
          end`;
const helper=`  # PRIVATE preparation only. The existing durable intent remains outstanding
  # until the outer Content transaction and deferred delivery complete. The
  # pending-address lock precedes Content and remains through cache invalidation.
  # Filesystem effects cannot be rolled back by PostgreSQL; no atomicity claim.
  defp release_under_database_boundary(doc, file, dataset) do
    key = case file.object_key do
      value when is_binary(value) and byte_size(value) > 0 -> value
      _ -> file.path
    end
    Barkpark.Content.Broadcast.write_atomically(fn ->
      Barkpark.Media.Storage.LocalWrite.run(key, fn ->
        case write_checkout(doc, file, dataset, nil, nil) do
          {:ok, updated} ->
            case invalidate_cache(doc, file, updated) do
              :ok -> {:ok, updated}
              error -> error
            end
          error -> error
        end
      end)
    end)
  end

`;
let candidate=before.slice(0,start)+replacement+before.slice(end);const anchor='  defp intent_checkout(nil), do: {:error, :unconfigured}';assert.equal(candidate.split(anchor).length,2);candidate=candidate.replace(anchor,helper+anchor);assert.equal(candidate.replace(helper,'').replace(replacement,removed),before);
const out='.git/C108-guard-boundary1434';assert(!fs.existsSync(out));fs.mkdirSync(out);fs.writeFileSync(out+'/checkout-candidate.exs',candidate,{flag:'wx'});fs.copyFileSync('.git/C108-guard-compose1344/SOURCE-LICENSE.txt',out+'/SOURCE-LICENSE.txt');
const plan={at:new Date().toISOString(),status:'private_candidate_prepared_not_compiled_not_executed',supersedes:'.git/C108-release-boundary-design1431.json',designRevision:'Use existing durable intent outside Broadcast.write_atomically, with LocalWrite transaction nested inside its callback. Outer durable intent remains outstanding until outer Content commit/deferred flush, even if inner physical ticket checks in. Queue ownership belongs to Broadcast.write_atomically, which commits success and rolls back errors. A with_deferred_queue envelope alone cannot decide whether generic LocalWrite error committed or rolled back Content, so the earlier proposed nesting is superseded before implementation/runtime.',source:{file:out+'/checkout-candidate.exs',sha256:sha(candidate),prior,priorSha256:sha(before)},change:{removed,added:replacement,helper,reversibleExact:true},sourceOwners:JSON.parse(fs.readFileSync('.git/C108-release-boundary-design1431.json')).owners,scope:'Only private managed Checkout release body changes. Ordinary branch, authorization, public routes, Renditions/Magick/MediaController production candidate bytes remain unchanged. No sourcePR23205/app/pin/installer adoption.',first:'After PR81 exact hosted join, compile FOUR actual modules using NEW release context1435 reference, then one genuine full-runtime cold HTTP320JPEG/native original+derived/row/private doc positive, checkout200, admin undo200/cache absence/new linked revision/native original+row exact/open0. Observe actual Content queue ownership and after-commit dispatch for this owned scope before broader claims.',followup:['Actual pending SQL before admin undo should now refuse before Content/release/delete hook, unchanged whole checked-out document/revision/cache/original/row/operation; admission may conservatively retain existing durable intent. Measure, never force counters.','Nested LocalWrite error/Repo rollback semantics and controlled schema refusal may retain outer physical uncertainty even without Content mutation; unaccepted and requires separate proof before adoption.','Actual prepare SQL race/closing hold/locked partial effect/schema/ordinary/owner-loss/restart/notifications require new-source regressions; prior1345 proofs do not establish changed Checkout.'],prohibitions:'No atomicity/native completion/full census/reconciliation/recovery permission/policy acceptance, real library/S3/cleanup/merge/deploy/reviewer spawn. No passing compiler/probe replay. First failure retained.'};fs.writeFileSync('.git/C108-guard-boundary-next1434.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
let ex=fs.readFileSync('.git/guard-compose-compile1345.exs','utf8');assert(ex.includes('.git/C108-guard-compose1344/checkout-candidate.exs'));ex=ex.replace('.git/C108-guard-compose1344/checkout-candidate.exs','.git/C108-guard-boundary1434/checkout-candidate.exs');fs.writeFileSync('.git/guard-boundary-compile1435.exs',ex,{flag:'wx'});
let compiler=fs.readFileSync('.git/guard-compose-release1345.cjs','utf8');for(const[a,b]of[['C108-guard-compose-release1345','C108-guard-boundary-release1435'],['guard-compose-compile1345.exs','guard-boundary-compile1435.exs']]){assert(compiler.includes(a));compiler=compiler.split(a).join(b);}fs.writeFileSync('.git/guard-boundary-release1435.cjs',compiler,{flag:'wx'});console.log({prepared:true,sourceSha256:plan.source.sha256,reversibleExact:true,compiled:false,executed:false});
