# C007 — Profile runtime descriptors and leases

Status: done for the bounded backend runtime proof; P1/A1 remains pending. Branch `codex/cycle-next-12h`, starting at validated C003 `482f4cc`. Parallel C006 owns desktop ownership/session wiring; this lane owns additive runtime pool and scoped source bootstrap fixes. Central queue remains coordinated separately.

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

## Final source and evidence checkpoint

Source commits: `15c0273` (pool/descriptors), `24e1bc3` (private build and lease recovery), `34b17ce` (asynchronous build preparation and valid upstream label fixtures). Stable API differs from the initial sketch: injected port callback is `allocate`; `writes` defaults false; `selectWithoutRuntime` supports profiles that need no private server. Credential callbacks receive `{profileId,storeDir,readJson,writeJson}`.

Third live attempt `iJH8on` proved simultaneous private-build startup and the corrected upload envelope, then failed the upstream `label_spine` publication validator. The fixture now registers its synthetic tag and provides valid descriptions/rationales. Both services stopped; no product validation was bypassed. Fourth attempt `SpZMnG` passed all six scenarios on clean34b17ce and clean Barkpark a5440345c, including same-name media bytes, cross-token refusal, revision-checked A edit after selecting B, A-only restart and fresh-pool restoration of B. [Report](C007-runtime-evidence.json) records no cleanup errors. Raw logs and synthetic data remain in the named temporary directories; fixture secrets are never committed.

`npm run test:desktop` passed on24e1bc3, including76 Electron assertions, direct-edit UI,100-entry history and side-chat restart parity. The subsequent async build change passed all4 snapshot tests and the real dual-runtime proof. File-lease4, profile-registry24, profile-runtime13 and media envelope cases passed. Root independently reviewed pool/lease boundaries and ran the earlier unit checks.

Source34b17ce deterministic [capture/compare](../visual/runs/2026-09-21T23-01-10-158Z/README.md) has21 frames and five action GIFs with zero pixel or geometry differences. Named agent review inspected all intermediate frames, narrow geometry, menus, themes and controls before approval. Live `shots:isolated` used fixture `wRtNqh`, actual server0.2.26.3877 and real Codex after Claude weekly-limit refusal. All five stills and37 GIF frames were inspected; [immutable manifest](../images/status/history/C007-34b17ce.json) has clean source/server provenance. The GIF intentionally replaces selected table-cell text while typing the sample score; it is presentation evidence, not the isolation assertion. The private capture runtime stopped normally and source slot was released.

Repository truth reviewed: storage contract, local runtime guide, app README, next-agent handoff, validation ledger and visual health. Central plan/cycle remains coordinator-owned; P1/A1 is not complete. Next exact action: integrate this stable API with C006 captured profile authority and provider finalization, then prove profile switching end-to-end. Existing managed database adoption requires an offline cold-copy/owned-runtime strategy; shell staging still refuses it. No source services remain; no real-user data migration, merge or deployment occurred.

Final root `npm run verify` passed: generated outputs, syntax/types/links, cycle/visual freshness, concept and handoff checks. `git diff --check` passed. Source34b17ce → reviewed captures → evidence commit sequence is complete.

Closeout note: the pre-stage tracked-file `git diff --check` passed. The staged check additionally saw the generator's trailing blank line in the newly added visual run README; this harmless generated whitespace is retained with immutable evidence. No source whitespace errors were reported.
