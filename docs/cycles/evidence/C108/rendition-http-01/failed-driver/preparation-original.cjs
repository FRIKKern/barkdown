const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),dir='.git/C108-rendition-http1093',source='../barkpark-windows-media-settlement';assert(!fs.existsSync(dir));fs.mkdirSync(dir);for(const f of['host.cjs','boot.exs','native-trace.exs'])fs.writeFileSync(dir+'/'+f,fs.readFileSync('.git/C108-rendition-held1062/'+f,'utf8').replaceAll('C108-rendition-held1062','C108-rendition-http1093'));
let s=fs.readFileSync('.git/C108-rendition-held1062/fixture.exs','utf8'),a=s.indexOf('    await.("render-go")');assert(a>0);s=s.slice(0,a);s=s.replace('[[workspace, project, dataset]]','[[workspace, project, dataset, ws_slug, project_slug]]').replace('SELECT w.id::text,p.id::text,d.slug FROM','SELECT w.id::text,p.id::text,d.slug,w.slug,p.slug FROM');s=s.replace('asset_revision: asset.rev, cold: true,','asset_revision: asset.rev, asset_id: asset.id, scope: %{workspace_slug: ws_slug, project_slug: project_slug, dataset: dataset}, cold: true,');const mark='    write.("caller-ready",';assert(s.includes(mark));s=s.replace(mark,`    originals = for mod <- [BarkparkWeb.Router, BarkparkWeb.MediaController, Barkpark.Content.Errors, Barkpark.Media.Delivery, Barkpark.Media.Storage.Access, BarkparkWeb.ScopeHelpers] do
      {:module, ^mod} = Code.ensure_loaded(mod)
      {^mod, binary, file_path} = :code.get_object_code(mod)
      {:ok, {^mod, md5}} = :beam_lib.md5(binary)
      ^md5 = mod.module_info(:md5)
      %{module: inspect(mod), file: List.to_string(file_path), beam_sha256: Base.encode16(:crypto.hash(:sha256, binary), case: :lower), loaded_md5: Base.encode16(md5, case: :lower)}
    end
    write.("original-http-bindings", originals)
`+mark);s+=`    await.("http-positive-reviewed")
    true = File.regular?(destination)
    bytes = File.read!(destination)
    <<255, 216, _::binary>> = bytes
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    write.("http-positive-checked", %{status: "actual_http_positive_checked", admission: state.(), output_sha256: Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)})
    await.("trace-go")
    held = state.()
    :held = held.phase
    0 = held.pending
    0 = held.writers
    tracer = Barkdown.PrivateNativeInvocationTrace.arm()
    Process.put(:c108_owned_trace, tracer)
    write.("trace-ready", %{status: "armed_after_held0", beam_os_pid: System.pid(), admission: held})
    await.("trace-finish")
    drained = Process.delete(:c108_owned_trace) |> Barkdown.PrivateNativeInvocationTrace.finish()
    0 = drained.count
    [] = drained.events
    true = drained.pattern_disabled and drained.delivered and drained.processed_ack
    write.("invocation-trace", drained)
    await.("http-reviewed")
    ^held = state.()
    ^bytes = File.read!(destination)
    false = File.exists?(Media.file_path(Path.join(["_renditions", file.id, "preview.jpg"])))
    [] = Path.wildcard(Path.join(Path.dirname(destination), ".tmp-*"))
    true = Repo.get!(MediaFile, file.id) == row
    true = Assets.find_by_media_file_id(file.id, dataset, MediaFile.scope_opts(file)) == asset
    ^payload = File.read!(source)
    %{status: "actual_http_rendition_contract_observed", relative: rel, destination: destination, source: source, cached_exact: true, row_unchanged: true, asset_unchanged: true, no_partial: true}
  after
    if tracer = Process.delete(:c108_owned_trace), do: write.("invocation-trace-on-error", Barkdown.PrivateNativeInvocationTrace.finish(tracer))
    if is_nil(original_config), do: Application.delete_env(:barkpark, backend), else: Application.put_env(:barkpark, backend, original_config)
  end
  true = Application.get_env(:barkpark, backend) == original_config
  write.("caller-result", Map.put(value, :config_restored, true))
  await.("fixture-reviewed")
  write.("result", %{status: "actual_http_rendition_contract_completed", elapsedMs: System.monotonic_time(:millisecond) - started})
rescue
  e -> write.("result", %{status: "failed", error: Exception.format(:error, e, __STACKTRACE__), elapsedMs: System.monotonic_time(:millisecond) - started})
end
`;fs.writeFileSync(dir+'/fixture.exs',s);
const owners=['api/lib/barkpark_web/controllers/media_controller.ex','api/lib/barkpark_web/router.ex','api/lib/barkpark/content/errors.ex','api/lib/barkpark/media/delivery.ex','api/lib/barkpark/media/storage/access.ex','api/lib/barkpark_web/scope_helpers.ex'].map(file=>({file,sha256:sha(source+'/'+file)}));const p={at:new Date().toISOString(),status:'fixture_boot_prepared_only_producer_missing',prepared:dir,reference:'.git/C108-renderer-preflight-release1012/result.json',sourceOwners:owners,fixtureSha256:sha(dir+'/fixture.exs'),bootSha256:sha(dir+'/boot.exs'),hostSha256:sha(dir+'/host.cjs'),traceSha256:sha(dir+'/native-trace.exs'),route:'/w/:workspace_slug/p/:project_slug/media/renditions/:id/:preset',staticTrace:'Stock MediaController serve_rendition_file maps write_admission tuple through Errors to503, unknown_preset400; generic storage_unavailable/imagemagick_not_found falls through404. Source trace only; actual new-candidate HTTP NOT executed.',next:'Finish1081/root40/publication/exact hosted first. Complete new bounded Node HTTP producer from existing full-runtime runner, no controller replacement. FIRST actual admin-Bearer scoped cold thumb GET200/genuine320JPEG/native original+derived/whole row/doc/config before hold. Then actual hold/awaitHeld/trusted held0 before trace-go, real held cached thumb200 exact/cold preview503 write_admission_admission_closed/unknown preset400. Drain meta open_port0 then full identities/records/state exact/natural caller DOWN normal/trusted held0/owned shutdown; no reopen/recover/cleanup. Retain first failure and stock controller/router/errors/delivery/access/scope helper carried-beam bindings. Review six source owners and tests before behavior. No actual request or generic404 mapping proof yet.',limits:'Producer and entry preflight/readiness still missing; do not execute boot alone. No fake rendering/HTTP helper that repairs state/controller repair/source adoption/real data. General storage404 policy/identity/full census/independent adoption remain.'};fs.writeFileSync('.git/C108-rendition-http-next1093.json',JSON.stringify(p,null,2)+'\n',{flag:'wx'});
let c=fs.readFileSync('.git/preflight-fixture1014.cjs','utf8').replaceAll('C108-rendition-preflight-fixture1014','C108-rendition-http-fixture1094').replaceAll('C108-rendition-preflight1013','C108-rendition-http1093');fs.writeFileSync('.git/rendition-http-fixture1094.cjs',c,{flag:'wx'});let b=fs.readFileSync('.git/preflight-boot-parse1015.cjs','utf8').replaceAll('C108-rendition-preflight-boot1015','C108-rendition-http-boot1095').replaceAll('C108-rendition-preflight1013','C108-rendition-http1093');fs.writeFileSync('.git/rendition-http-boot1095.cjs',b,{flag:'wx'});console.log({prepared:dir,producerMissing:true,actualHttpExecuted:false});
