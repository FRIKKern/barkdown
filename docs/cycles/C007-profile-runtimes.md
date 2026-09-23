# C007 — Profile runtime descriptors and leases

Status: active, bounded P1/A1 runtime integration. Branch `codex/cycle-next-12h`, starting at validated C003 `482f4cc`. Parallel C006 owns desktop ownership/session wiring; this lane owns additive runtime pool and scoped source bootstrap fixes. Central queue remains coordinated separately.

## Goal and acceptance

- Bind each profile to its own persistent runtime descriptor, data/media roots, credentials and distinct HTTP/Postgres ports. No ambient CLI endpoint or same-slug fallback.
- A foreground selection and a captured run each hold a lease. Selecting B starts B before releasing the foreground lease for A; an outstanding A run keeps A alive until provider cleanup releases it exactly once.
- Prove startup deduplication, failed startup/stop recovery, request rejection during shutdown, and only-owned shutdown. Registry selection survives restart; runtime descriptors cannot silently rebind data or ports.
- Run two disposable real Barkpark/Postgres runtimes concurrently, create the same slug with different content/media, edit/read independently, restart one and verify the other remains alive. Preserve source checkout and all real user libraries.
- Audit the observed shared Mix build-directory locking. Concurrent profiles must actually work; permanently serializing runtime lifetimes is not an acceptable workaround.
- Close with relevant unit/desktop/live tests, root verification, committed-source deterministic and live captures, actual image review, evidence commit and resumable handoff.

## Scope and safety boundaries

No real legacy database adoption, portability claim, shared server shutdown, sibling checkout edits, profile switcher/UI work, deployment or merge. Production credential decryption stays behind the trusted integration callback; tests use generated fixture secrets only. Existing DB adoption remains pending. Root grants the shared built-source live window after editor, current-cycle and goals lanes; design/unit work can proceed meanwhile.

## Proposed contract

`createProfileRuntimePool({registry, readSecrets, createRuntime?, allocatePorts?})`. `readSecrets` receives the registry's bound profile store and returns unlocked private-runtime credentials. `acquire(profileId,{source,ownerId})` yields a captured direct connection and idempotent awaited release. `select(profileId,{source})` owns one foreground lease. Selection never rewrites a running lease's endpoint or store. C004/C006's awaited `onFinish` provider finalizer releases run leases after transport cleanup, including cancellation; dispatch failure before registration is caller cleanup.

Descriptor version 1 stores profile UUID, source checkout and distinct ports. Data directory derives only from the bound profile store. Persisted descriptors are validated and immutable while leases exist. Failure to claim a port or data root surfaces explicitly; no service is killed or substituted.

## Checkpoint / next exact action

Read active instructions and C003/C001 contracts; ran plan/cycle and inspected source launcher/bootstrap. C003 tree is clean and dependencies remain installed from locked installs. Existing source bootstrap runs `mix run --no-compile`, then `ecto.create`/`ecto.migrate` without explicit no-compile flags; audit installed task source before changing it. No C007 services or tests have run yet. Next: implement pool lifecycle fixtures and descriptor validation, inspect Ecto/Mix task options, then obtain live window for concurrent-runtime proof.

## First implementation checkpoint

Added runtime pool, 11 passing injected-runtime lifecycle/descriptor scenarios, and a not-yet-run dual real-runtime fixture (`npm --prefix app run test:profiles`). No bootstrap or sibling source changes yet. Pool uses registry-wide descriptor allocation lease, bound credential callback, immutable per-lease connection with `writes:false` default, distinct persisted ports and profile-derived data roots. Active run leases outlive foreground selection. Source/port rebinding and colliding descriptors fail explicitly.

Selection has an explicit commit boundary: B startup or registry publication failure rejects while A remains authoritative. Once B is committed, failed A cleanup returns B with `cleanupWarning`, retaining failed A for a later shutdown retry; it never ambiguously rejects an already-published switch. Same-profile write-policy changes replace only the foreground permission lease, leaving captured run connections immutable. Cancellation release is deferred to C004/C006's awaited provider `onFinish` cleanup hook.

Installed Ecto task sources accept `--no-compile`; installed Mix `compile.all` acquires the shared build lock even on a no-compile load. A flag alone therefore does not establish concurrent safety. The pending fixture will first exercise current bootstrap, preserving logs if the lock or other real endpoint boundary fails. The root has queued this lane after the editor's current dedicated source capture. No real runtime owned by C007 yet; no dual-runtime or media isolation pass claimed.

## Live failures and corrections checkpoint

- First real dual fixture `barkdown-dual-profile-lFsfEU` started both private runtimes concurrently with distinct ports/roots/tokens, then exposed an existing direct-media adapter bug: `/media/upload` returns `{url, assetDocId}`, while Barkdown only read v1/CLI shapes. The narrow adapter fix accepts the audited relative URL against the captured server; fixture tests also preserve wrapped/absolute CDN shapes. Both runtimes stopped. The first report's source-dirty probe used app-relative paths incorrectly; its clean flag is not trusted. The probe is corrected before subsequent proof.
- Second fixture `barkdown-dual-profile-0rAfB7` reproduced a real Windows Mix shared-build failure: hard-link creation for `mix_lock_user0/.../lock_0` returned permission denied. A failed startup and B readiness were recorded; both stopped. The shared source slot was released while correcting this offline.
- The source driver now copies verified built artifacts into its own data-root cache and supplies private `MIX_BUILD_PATH`. Source payload hashes determine the cache identity; modified payload fails reuse, source changes during copy prevent publication, and only private `.mix` metadata may vary. No shared source edit, recompilation or concurrency-lock disabling. Bootstrap/launcher explicitly use no-compile/no-deps-check. Four snapshot fixture scenarios pass; dual live retry remains pending.
- Root review identified a stale-owner race in registry/descriptor/source-driver lease recovery. Shared `file-lease.js` now serializes stale recovery with a separate exclusive gate and verifies ownership on release. Four lease scenarios pass, including two-process paused stale-reader competition and retry after failed unlink. A dead recovery gate fails closed for inspection instead of guessing.
- Runtime pool has 13 passing injected lifecycle cases. New `selectWithoutRuntime(profileId)` commits B without starting a service, releases only A foreground ownership and retains A run leases; returns cleanup warning after committed selection. New acquisitions recheck current runtime readiness after watchdog recovery.

No C007 runtime currently remains. Next: commit corrected source, run full desktop regression, obtain next source window and rerun dual private runtime/media/restart proof. Do not call C007 done from unit success.
