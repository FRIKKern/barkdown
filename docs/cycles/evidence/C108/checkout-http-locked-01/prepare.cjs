const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');const prep=__dirname+'/C108-checkout-http-locked714';assert(!fs.existsSync(prep));fs.mkdirSync(prep);const plan={at:new Date().toISOString(),task:'task-0571ac0327eced87',status:'Prepared only; not compiled or executed',dependency:'Finish actual HTTP696 root21/publication/exact hosted join first; no native replay.',outcome:'Actual HTTP admin release on one native locked cache child returns existing503 storage_unavailable while changed Content/cache residuals and request-owner DOWN retain pending1/recovery.',steps:['One new synthetic owned full runtime, same exact private599 modules/original7HTTPowners. Real scoped upload/assets and holder bearer checkout200 before any lock.','Native original/cache before-state, owned Read-share lock on z-locked.bin, real admin HTTPundo. Observe exact returned503 and actual rm_rf error/residuals without assuming sibling deletion order.','Private existing intent hook registers an independent monitor on actual HTTP caller before permitting Content/effects, records monitored owner identity and exact DOWN. No test kill/hold/recover/reopen. Require observed owner DOWN and trusted pending1/recovery/writers0/dead1, changed doc/cleared holder, native original/all residual children/media row exact.','Stop only owned lock/backend/PG, retain original/cache/DB/journal/first failure and actual beam bindings. No recovery to continue.'],budget:'15minute bounded prepare/compile/one owned runtime or first retained failure. Never restart live check after observation timeout.',limits:'Synthetic scoped bearer only; no full backend/VM/powerloss, account/share/crossworkspace privileges, full writer/native/pending/identity acceptance, production repair/adoption, real library/S3, reviewer spawn, source/app/pin/installer/host policy change, recovery/cleanup/purge, merge/deployment.'};fs.writeFileSync(__dirname+'/C108-checkout-http-locked-next713.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});for(const f of ['checkout-candidate.exs','renditions-candidate.exs','SOURCE-LICENSE.txt','derivation.json','boot.exs','host.cjs']){const data=fs.readFileSync(__dirname+'/C108-checkout-http694/'+f);fs.writeFileSync(prep+'/'+f,['boot.exs','host.cjs'].includes(f)?data.toString().replaceAll('C108-checkout-http694','C108-checkout-http-locked714'):data);}fs.copyFileSync(__dirname+'/C108-checkout-caller670/lock.ps1',prep+'/lock.ps1');let s=fs.readFileSync(__dirname+'/C108-checkout-http694/fixture.exs','utf8').replace('Private HTTP fixture;','Private locked-cache HTTP fixture;').replace('["a-first.bin", "z-second.bin"]','["a-unlocked.bin", "z-locked.bin"]');const anchor='  write.("setup-ready",';assert(s.includes(anchor));s=s.replace(anchor,`  Application.put_env(:barkpark, :checkout_intent_test_hook, fn doc, current ->
    if current.id == file.id do
      owner = self()
      ready = make_ref()
      observer = spawn(fn ->
        monitor = Process.monitor(owner)
        send(owner, {ready, :monitor_ready})
        receive do
          {:DOWN, ^monitor, :process, ^owner, reason} ->
            write.("owner-down", %{owner: inspect(owner), reason: inspect(reason), alive: Process.alive?(owner), observer: inspect(self()), no_test_kill: true})
        after
          30_000 -> write.("owner-down-timeout", %{owner: inspect(owner)})
        end
      end)
      receive do
        {^ready, :monitor_ready} -> :ok
      after
        5_000 -> raise("Actual HTTP caller monitor did not register")
      end
      status = Barkpark.ManagedRuntime.WriteAdmission.status(Barkpark.ManagedRuntime.WriteAdmission.Door.server())
      write.("intent-owner", %{owner: inspect(owner), observer: inspect(observer), alive: Process.alive?(owner), before_revision: doc.rev, monitor_registered: true, state: Map.take(status, [:phase, :generation, :pending, :writers, :dead_writers])})
    end
  end)
`+anchor);fs.writeFileSync(prep+'/fixture.exs',s);let compiler=fs.readFileSync(__dirname+'/media-checkout-http-compile695.cjs','utf8').replaceAll('C108-checkout-http-compile695','C108-checkout-http-locked-compile715').replaceAll('C108-checkout-http694/fixture.exs','C108-checkout-http-locked714/fixture.exs');fs.writeFileSync(__dirname+'/media-checkout-http-locked-compile715.cjs',compiler,{flag:'wx'});fs.writeFileSync(prep+'/preparation.json',JSON.stringify({at:new Date().toISOString(),status:'Prepared only; not compiled/executed',plan:'.git/C108-checkout-http-locked-next713.json',files:fs.readdirSync(prep).map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(prep+'/'+file)).digest('hex')}))},null,2)+'\n');console.log({prepared:714,compileNotRun:715,behaviorNotRun:true});
