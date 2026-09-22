# Evidence and remaining proof

Baseline at the 2026-09-21 roadmap reset. Implementation evidence is separate from the pending journey gates in [ACCEPTANCE.md](ACCEPTANCE.md). [Original concept validation](archive/2026-09-21-validation.md) is archived.

| Baseline | Evidence | Limits |
|---|---|---|
| Desktop shell and agent integration | App `npm test`: unit suites, 76 Electron checks, direct-edit, composer-history and side-chat UI checks passed during local-runtime delivery. | Some provider orchestration uses scripted clients; not a new live run of every provider. |
| Shared editor features | [EDITOR-PARITY.md](EDITOR-PARITY.md) records live comparisons and counts, including tables, media, IME, multi-block editing and large documents. Upstream branch `a5440345c`. | PR #19579 still open at reset; matrix contains partial/limited proof. No claim of all upstream gates passing. |
| Managed Windows local runtime | Barkdown `930fc2f`: `npm run test:local` passed actual private PostgreSQL/Barkpark startup, authenticated reads, crash recovery and restart. Expanded `local-barkpark-ui.live.mjs` passed editing through recovery, saved state after restart, Settings status, quit/window-close cleanup. | Built checkout/toolchain required. Injected worker-failure log detection is unit-tested; actual OS error 487 is not deterministically reproduced. No packaged install or multi-profile proof. |
| Repository and screenshots | Root `npm run verify` passed; status image manifest at `5c91d29`. | Concept/build checks are not production storage or sync tests. |

## Last fully validated combined checkpoint

Source e380385: full desktop64608 and root verify86276 passed. Forty fixture frames plus GIFs reviewed; actual Codex/Paper status5397 passed with private runtime stopped. See [C008 exact scope and limits](cycles/C008-integration.md). No main release. Newer C016/E007/C021 original lane evidence is now imported; those original passes do not validate the combined candidate.

## Current candidate and release gates

Combined source16a3b60 integrates C016 reading-position restoration with newer queued-edit refresh; all31 host checks pass. C023, C024 and C025 sources and original lane evidence are integrated; full combined desktop, actual native consumption, fixture/live captures and root verification remain pending. The missing-folder API search correction and strengthened fixture assertions pass the complete agent suite. [C008](cycles/C008-integration.md) owns subsequent source/evidence imports.

[Read-only release audit](cycles/evidence/release-gates-2026-09-22.json): upstream PR19579 is still open/blocked at a544, with failing checks. The successful parity job skipped its actual rows; BARKDOWN_READ_TOKEN is absent. G1/G2 remain uncleared. No secret, branch or workflow configuration was changed.

## Combined integration checkpoint — 22 September

These are branch-specific results, not a main release or completion of P1–P5.

| Source / scope | Verified evidence | Remaining limits |
|---|---|---|
| Combined `82cc622` | Full `npm run test:desktop`44785 passed, including actual Electron credential crash/decrypt, malformed-key refusal, profile ownership, startup drafts, adoption and owned goal recovery.37 deterministic states reviewed and approved. | Ordinary chat crash recovery and full two-runtime UI isolation remain active work. |
| Combined `abbbcee` / upstream `8530a9e23` | [Real rich Paper saves and motion review](visual/rich-takeover/runs/2026-09-22T00-28-46-068Z/README.md): five cases plus actual MCP structured read, ten stills and sampled continuous video. Private runtime stopped. | Adapter operations without a model turn. Advanced table authoring/export and API-provider remote tool parity remain open. |
| Original `54464ef` / upstream `a5440345c` | [Adopt, edit, restart and roll back](visual/adoption/runs/2026-09-22T00-21-07-265Z/README.md), including drafts/attachment/media and unchanged original content. C010 closed at645c525. | Disposable same-machine library, synthetic plain credential codec; not portability or real-user migration. |
| Original `87ca623` | [Workspace-loss recovery](visual/workspace-recovery/README.md) refuses missing/corrupt authority and preserves visible drafts instead of seeding empty data. | Explicit manual recovery; no automatic reconstruction. |

Combined root `npm run verify` session20871 now passes after a fresh live status capture at `8cabf36`/`a5440345c`: actual Codex turn, five reviewed stills and all 37 GIF frames. The private runtime stopped normally. Original lane verification is not a substitute. See [C008](cycles/C008-integration.md) for exact sessions and subsequent results.

## Pending evidence

P1–P5 are pending in [plan.json](plan.json). Existing implementation is the starting point; resetting the roadmap neither invalidates passing tests nor grants the new stages a pass. G1/G2 remain separate release gates.

## Commands

```sh
npm run plan
npm run verify
cd app
npm run build
npm test
npm run test:local
npm run test:parity
```

Run only relevant live suites with their actual prerequisites. `test:local` uses isolated temporary Windows clusters and a built checkout (see [runtime setup](LOCAL-BARKPARK.md)); `test:parity` uses a deliberately selected Barkpark/CLI target. Never silently switch or stop a shared service to make a test run. New installations use locked dependencies (`npm ci`) and Playwright Chromium. App source changes retain the commit → `npm run shots` → evidence commit workflow.

## Stage evidence ledger

Append a record when a slice lands: stage/scenario, exact source commits, command and outcome, artifact links, and limitations. Link the record from `plan.json` when completing a stage. Mark failures and partial proof explicitly; keep historical results with their tested baseline.

## Cycle workflow setup — 2026-09-21

On baseline `7b6445e`, added the cycle protocol, structured current record, checkpoint handoff, plan output and verification gate. `npm run verify` passed; `npm run check` passed again after final text/encoding corrections. Cycle checks reject missing completion evidence/reviews, missing blocker reasons, unknown stages and handoff paths outside the repository. `npm run cycle` prints planned C001. No profile implementation is claimed.

Truth review: README/app guide still describe the existing prototype; roadmap and acceptance remain pending; NEXT-AGENT now points to the cycle checkpoint. Existing runtime/editor limitations remain in force. Screenshot review: no app source or UI behavior changed, so the existing captures and provenance remain applicable; the freshness check passed. No live providers, storage migration or runtime tests were rerun for this workflow-only change. C001 is planned, not complete.

## Visual health workflow — 2026-09-21

Harness baseline `e15d08c`: two isolated Electron captures, each with 21 action frames and five GIFs. The first set was visually inspected (contact sheets, full-size Settings/side-chat details and the letterboxed narrow GIF frame); all GIF frame counts/dimensions checked. The second comparison found no pixel differences above tolerance and no geometry changes, in the same environment. [Named approvals and current galleries](visual/README.md) retain both reports and their source/artifact hashes.

`npm run verify` passed. `npm run check` passed after evidence approval. Comparator tests cover exact matches, low color noise, localized removal, resizing and checkout line endings. A deliberate untracked source-file probe caused the visual freshness check to fail; the probe was removed and the original source preserved. A deliberately invalid artifact hash was rejected without modifying the stored image. Prior live Paper captures remain unchanged; `status-shots` now retains older hashed media and manifest history. CI checkout now fetches full history so the old ancestry gate can work on PRs.

Fixture tours do not prove live providers, server saves, data migration, sync or recovery. Dedicated motion tours for those boundaries remain explicit coverage gaps. CI creates candidate reports; it never grants visual approval. Review attestations are engineering records, not tamper-proof authorization.

Desktop regression on the same app baseline: `npm run test:desktop` passed all unit suites, 76 Electron checks, direct-edit UI, 100-entry composer-history/restart checks and side-chat controls/ownership/restart checks. No new real provider or private server run was required for capture tooling. Generated text hashes now normalize line endings, fixing the CRLF-versus-LF manifest discrepancy found in the isolated checkout.

CI candidate review found an unauthenticated startup toast covering the composer on the Windows runner (run 35657480031). The agent inspected the actual before/after/diff images; control geometry was unchanged. Capture now waits for notices to expire naturally and records OS release/architecture/font context. This fixes fixture timing, not app behavior; small cross-machine icon raster differences remain reviewable. The previous candidate was not promoted automatically.

## 2026-09-21 — C002 working-folder context (initial blocked checkpoint)

Shared provider dispatch now refreshes the captured chat folder on every turn and instructs agents to answer location questions directly. Conversation-context and agent suites, syntax and cycle checks pass. No live model latency measured. npm ci failed on registry EACCES; root dependencies are incomplete and npm run verify fails on missing cheerio. Chromium install and Git writes are denied. Commit, screenshot and push gates remain pending; see [C002 handoff](cycles/C002-folder-context.md).

## C002 completed validation — 2026-09-21

Branch `codex/fast-folder-context`, implementation `c66744b` plus regression correction `3e2ed6f`. Root dependencies and Chromium restored; app missing files repaired from a lockfile-identical isolated install without stopping the existing app. Targeted conversation/agent suites passed. A new test first reproduced unwanted offline navigation from injected guidance, then passed after separating original messages; image-only turns and resumed folder changes/clearing are covered.

`npm run test:desktop` passed all unit suites, 76 Electron checks, direct-edit UI, composer-history/restart and side-chat ownership/restart cases. `npm run verify` passed. The [live Paper capture](images/status/history/C002-3e2ed6f.json) used private Barkpark `a5440345c` with clean app/source trees and a real Codex turn; the private runtime stopped normally. Five stills and 37 GIF frames were inspected. The [deterministic comparison](visual/runs/2026-09-21T21-48-36-561Z/comparison.json) has no differences above tolerance or geometry changes across 21 frames; named review and current hashes pass.

No focused live folder-question latency/compliance benchmark, profile implementation, merge or deployment is claimed. The [C002 handoff](cycles/C002-folder-context.md) preserves the initial failures, recovery steps and final evidence; C001 remains planned.

## C001 ownership design — 2026-09-22

Audited merged baseline b8e7bfb; [inventory and contract](PROFILE-OWNERSHIP.md) covers actual storage/cache/session/credential/run boundaries, safe adoption and named A1 fixtures. Root npm ci, app npm ci and Playwright installation passed; npm run verify passed. This is documentation-only proof. Existing C002 visual approval remains current; narrow workspace image inspected and capture coverage reviewed. No profile storage, switching, adoption or background-run isolation is claimed. C002 is now merged through PR #29; earlier no-merge claims describe its historical push checkpoint. P1 remains pending. See [C001 handoff](cycles/C001-profile-ownership.md).

## C004 captured run ownership — 2026-09-22

Source 0086867 on codex/cycle-current-12h adds immutable run/MCP context and bound local adapters, exact created-document activity, authoritative event ownership and awaited finalization. Eleven [ownership test groups](../app/tests/run-ownership.test.mjs) pass with real stdio MCP and scripted SDK/API seams. Final npm run test:desktop passes existing units, 76 Electron checks and direct-edit/history/side-chat suites. Root npm run verify passes.

[Live Paper evidence](images/status/history/C004-0086867.json) used an isolated private runtime on Barkpark a5440345c with clean source trees and a real Codex turn; five stills and 37 GIF frames reviewed, private runtime stopped. [Deterministic comparison](visual/runs/2026-09-21T22-32-06-713Z/comparison.json) has 21 frames with no above-tolerance pixel or geometry changes; explicit review recorded. [Lifecycle contract and limits](RUN-OWNERSHIP.md): no switching UI, durable scheduler, full profile credential isolation or OS process-stop guarantee. Roots are trusted input pending resolver/ancestor hardening. P1 remains pending; see [C004 handoff](cycles/C004-captured-run-ownership.md).

## C008 combined integration — active

The isolated `codex/integration-12h` candidate includes C003/C004/C006/C007, goal-service/UI and E001. Full desktop validation on4c88a49 passed37 goal tests,76 shell checks, chat/editor regressions, trusted workspace/runtime suites and profile/goal Electron journeys. These include a real app process restart; model transport is deterministic. C009 cold-adoption and E002 host imports subsequently passed focused adoption/runtime/Paper tests. Their original lane live reports are distinct from combined evidence.

See [C008 handoff](cycles/C008-integration.md) for exact sources, failures, corrections and pending work. Combined screenshots/root verification are not yet current. The real improved E002 canvas requires upstreambb3bd299d; pinned a544 uses the safe explicit-reload fallback. Native goal crash recovery and full shell/runtime adoption authority are still separate unfinished slices. No P1 completion, merge, deployment or actual-library migration is claimed.


Combined source `5a3a502` full desktop session13618 passed, including46 goal tests and the actual default-owned SDK worker Electron journey. Fresh deterministic31-frame run2026-09-21T23-55-40-140Z was inspected and approved; all31 comparisons show zero above-tolerance pixel/geometry changes. Live status session95727/private poMoAd passed with actual Codex turn after Claude weekly limit;5 stills and37 GIF frames inspected. Runtime stopped and postmaster.pid absent; CLI unchanged. The empty reloadable_apps fix prevents application compilation by the audited Phoenix source path, but missing Mix listener warnings persist; one passing run does not establish the prior intermittent health failure eliminated.

Combined E002 motion review is complete:8 stills,92 full-video samples at1fps and70 samples at10fps covering target/select/write and first receipt. No first-receipt displacement observed; see agent-takeover/runs/2026-09-21T23-40-28-032Z review and GIF. E003 separately reproduced rich-selection collapse and Markdown table conversion loss; its active lane is fixing these, so full editor completeness is not claimed. C010 adoption/boot and C011 native goal crash UI remain active and not imported yet. Natural-language goal planning remains incomplete.


## E007/E008 original lane proof imported

[HTML paste evidence](visual/html-table-paste/README.md) retains exact fdf6b9e/d8fda9690 live server/history/reload/200% recovery, original failures and reviewed motion. The global status/visual approval remains unchanged; archived E007-fdf6b9e status manifest and its review preserve actual attribution. [E008](cycles/E008-fixture-events.md) records upstream d24c7a094 full-suite success with test-only scheduling repair and unchanged runtime assets. These are original lane passes; combined candidate validation is pending and d8acb82 remains the verified fallback.

E009 imports original1a9faf3 evidence for Barkdown25cb114 and connected upstream3495, including native run38052 and archived status66890. No live test was rerun during import, no fallback/pin changed, and no combined approval inferred. [Native review](visual/rich-clipboard/runs/2026-09-22T04-50-27-798Z/review.json).

## C029 missing-folder native observation

Source69acbce, disposable GGgmox: selected B process restart retained draft and missing folder; project file stayed explicitly unavailable instead of substituting A. Actual installed Claude/Codex dispatches failed and retained exact errors and user text; both owned Jobs stopped/activeProcesses0. All three stills inspected; [original evidence](visual/missing-folder/69acbce/README.md). Ten controlled SDK-routing cases separately pass. No native model response, real ACL denial or final combined gate claim.
