# Evidence and remaining proof

## C039 / P1 acceptance — source27ea120

[Completion audit](cycles/C039-completion-audit.md) maps all four task requirements and A1 exits to evidence. Final frozen-source desktop37384 and root49277 pass. [Log hashes](visual/provider-login/27ea120/validation.json), [login recovery gallery](visual/provider-login/README.md) and [live Paper review](images/status/review-C039-recovery.json) retain source boundaries. Deterministic candidate09-42-11 is explicitly approved. All102 retained combined-native hashes verify. P1 is accepted; P2–P5 and separate release gates remain open. Migration preparation is complete, actual migration/rehearsal is not. No merge/deployment. Earlier entries retain historical states.


## Main merge checkpoint — 23 September

PR #30 merged as `3903288`. Final candidate `5325300` passes all 20 Linux editor groups (run 35806239614), both repository CI checks and Windows visual candidate. Root verify passes locally. [C040](cycles/C040-linux-parity.md) retains original failures, fixture repairs, final report and reviewed evidence. This closes the integration merge gate; C039 provider authentication and remaining P1–P5 acceptance stay open. No deployment.

## Earlier integration evidence (superseded status; retained provenance)

The reviewed integration checkpoint is recorded through `42432cb`. Full combined desktop passed at `1b01bf2`; the eight dedicated native journeys passed at `3ce6b21` and `41500dc` with independent media review. E012 consumption and C030 strict native parity (13/13) are retained separately with their original provenance. Old/current server fallback replays passed at `13cba57`.

Final capture source `3e8a2aa` has approved deterministic evidence (40 stills/40 motion frames) and independently approved live Paper/Codex evidence (five stills/all 37 GIF frames). Capture-only changes pass 18 lifecycle/history checks. Root `npm run verify` and the subsequent handoff `npm run check` passed. [C008](cycles/C008-integration.md) records the exact runs and limits. Publication is pending GitHub connectivity; no merge or deployment is claimed. Device authentication, portability and release acceptance remain incomplete.

## Historical ledger (the checkpoint above supersedes older pending combined-gate statements)

Baseline at the 2026-09-21 roadmap reset. Implementation evidence is separate from the pending journey gates in [ACCEPTANCE.md](ACCEPTANCE.md). [Original concept validation](archive/2026-09-21-validation.md) is archived.

| Baseline | Evidence | Limits |
|---|---|---|
| Desktop shell and agent integration | App `npm test`: unit suites, 76 Electron checks, direct-edit, composer-history and side-chat UI checks passed during local-runtime delivery. | Some provider orchestration uses scripted clients; not a new live run of every provider. |
| Shared editor features | [EDITOR-PARITY.md](EDITOR-PARITY.md) records live comparisons and counts, including tables, media, IME, multi-block editing and large documents. Upstream branch `a5440345c`. | PR #19579 still open at reset; matrix contains partial/limited proof. No claim of all upstream gates passing. |
| Managed Windows local runtime | Barkdown `930fc2f`: `npm run test:local` passed actual private PostgreSQL/Barkpark startup, authenticated reads, crash recovery and restart. Expanded `local-barkpark-ui.live.mjs` passed editing through recovery, saved state after restart, Settings status, quit/window-close cleanup. | Built checkout/toolchain required. Injected worker-failure log detection is unit-tested; actual OS error 487 is not deterministically reproduced. No packaged install or multi-profile proof. |
| Repository and screenshots | Root `npm run verify` passed; status image manifest at `5c91d29`. | Concept/build checks are not production storage or sync tests. |

## Last fully validated combined checkpoint

Historical fallback d8acb82 (visual-tooling source e380385): full desktop64608 and root verify86276 passed. Forty fixture frames plus GIFs reviewed; actual Codex/Paper status5397 passed with private runtime stopped. See [C008 exact scope and limits](cycles/C008-integration.md). No main release. Newer C016/E007/C021 original lane evidence is now imported; those original passes do not validate the combined candidate.

## Current candidate and release gates

Imported candidate `d20aa09` consumes upstream `54579debe6ad4579c1a48586805498602867d983` via E011 `22ef23b`, C033 `f19a6ef` and C032 source/fixture `4c1709a`/`b585640`. [E011 import](visual/fallback-consumption/IMPORT.md) preserves 755 original blobs and verifies all 53 review hashes, including actual fallback against old/new private servers. [C032](visual/folder-preflight/README.md) retains original native refusals/restart proof, six stills, four videos and two derived GIFs; 64 indexed hashes verified. C033 has 15 controlled context-race checks, not native race proof. [C023 original final gates](goals/evidence/3e9c0a9/README.md) passed and are imported; they are no longer pending lane work. Earlier C016/C024/C025/C026/E009 source-bound evidence remains valid within its recorded scope. Full combined desktop, dedicated native acceptance, fixture/live review and root verification remain pending. [C008 validation order](cycles/C008-integration.md#remaining-combined-validation-order) separates these gates.

Electron 38 remains consumed; coordinator reports real-app webview crashes on 43/44, including 43 with GPU disabled, while minimal 38/43 shells pass. No cause, fix or upstream attribution is established. C035 packaging is imported as d20aa09 with original89a0fd2 packaged terminal proof; Electron38 locks unchanged. E012 upstream f7fb remains unconsumed. C034 original7e07099 authenticated Codex/local-document revision and native shutdown proof passes; other providers and remote Paper remain unproven. Device CLI login and environment credentials remain an unanswered shared-device policy boundary.

[Read-only release audit](cycles/evidence/release-gates-2026-09-22.json): the recorded 22 September audit found upstream PR19579 open/blocked at a544, with failing checks. The successful parity job skipped its actual rows; BARKDOWN_READ_TOKEN is absent. G1/G2 remain uncleared. No secret, branch or workflow configuration was changed.

## Combined integration checkpoint — 22 September

These are branch-specific results, not a main release or completion of P1–P5.

| Source / scope | Verified evidence | Remaining limits |
|---|---|---|
| Combined `82cc622` | Full `npm run test:desktop`44785 passed, including actual Electron credential crash/decrypt, malformed-key refusal, profile ownership, startup drafts, adoption and owned goal recovery.37 deterministic states reviewed and approved. | Ordinary chat crash recovery and full two-runtime UI isolation remain active work. |
| Combined `abbbcee` / upstream `8530a9e23` | [Real rich Paper saves and motion review](visual/rich-takeover/runs/2026-09-22T00-28-46-068Z/README.md): five cases plus actual MCP structured read, ten stills and sampled continuous video. Private runtime stopped. | Adapter operations without a model turn. Advanced table authoring/export and API-provider remote tool parity remain open. |
| Original `54464ef` / upstream `a5440345c` | [Adopt, edit, restart and roll back](visual/adoption/runs/2026-09-22T00-21-07-265Z/README.md), including drafts/attachment/media and unchanged original content. C010 closed at645c525. | Disposable same-machine library, synthetic plain credential codec; not portability or real-user migration. |
| Original `87ca623` | [Workspace-loss recovery](visual/workspace-recovery/README.md) refuses missing/corrupt authority and preserves visible drafts instead of seeding empty data. | Explicit manual recovery; no automatic reconstruction. |

At this historical checkpoint, combined root `npm run verify` session20871 passed after a fresh live status capture at `8cabf36`/`a5440345c`: actual Codex turn, five reviewed stills and all 37 GIF frames. The private runtime stopped normally. Original lane verification is not a substitute. See [C008](cycles/C008-integration.md) for exact sessions and subsequent results.

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

## C038 callout refinement — 23 September

Source `ae8024f` on `codex/paper-polish`: build and 31 Paper host checks pass; isolated real-server callout gallery 4/4 passes. [Reviewed gallery](visual/callouts/README.md) covers seven tones, editable titles, body saves, folding/reload and 760px wrapping. Fresh status stills and 37 GIF frames are reviewed in `images/status/review-C038.json`; a real Codex turn succeeded after Claude quota refusal. Deterministic 00-42-44 capture approved after image inspection; all 40 frames within tolerance with unchanged geometry. Root `npm run verify` passed; no P1/full-desktop/release-completion claim.

## C039 planning checkpoint — 23 September

The actual API credential-boundary audit rerun at f00b489 reproduced device-environment fallback for an empty profile, without using A's profile key. Synthetic inputs and a controlled client made no network requests. C039 now names exact ordinary/goal implementation boundaries and acceptance tests; no authentication behavior has changed. Root npm run verify passed for the documentation checkpoint.

## C040 Linux merge gate — 23 September

PR30 fresh parity failed 17/20 at f00b489. Source e32482f corrects fixture caret preconditions and installs Playwright video runtime in CI; no product behavior changed and original assertions remain. Isolated local repaired groups pass row14 4/4, gaps 13/13 and find 6/6. Native stills/video, fresh status and deterministic captures reviewed; see [C040](cycles/C040-linux-parity.md). Full Linux CI and root verify remain pending at this checkpoint.

## C039 device-authentication decision — 23 September

The user chose computer authentication by default without asking. Existing actual API adapter audit rerun with synthetic keys at 5325300: owned A key used; empty B device environment used; B did not borrow A key. No network. Runtime and visual inputs unchanged. This settles policy, not all P1 or goal-provider acceptance; see C039 for remaining proof.

## C039 login-assistance checkpoint — 23 September

Implementation `1c94f8d` adds owned sign-in/status processes, shared main/side/goal assistance, pre-reservation checks and captured API/CLI environment credentials. Full desktop passed (86916); focused authentication/goals tests passed 50 with one POSIX-native skip, and the later four-role preflight case passed in the 12-test goal-provider suite. Six A/B × API/Claude/Codex checks use the production child protocol and native Windows Jobs with controlled SDKs. Native Electron login proof covers retained main/side text and image, cancel, successful status, explicit exactly-once retry, Settings recheck, dark and 390px layouts. [Gallery, source boundaries and logs](visual/provider-login/README.md).

Final deterministic capture `2026-09-23T09-06-36-021Z` was explicitly approved after reviewing all 40 stills and 40 decoded GIF frames. Only Assistant Settings differs visibly from the prior approved baseline. Isolated live Paper at `e2a4723` passed: real Codex turn after Claude weekly-limit refusal, five inspected stills/all 37 GIF frames, owned runtime stopped, real CLI configuration unchanged. Root `npm run verify` passed (89844). The earlier dirty-evidence capture refusal and approval fingerprint refusal are retained in C039; neither was waived. C039/P1 remain active pending initial keyring-only selection and expired-session draft acceptance, then full A1 reconciliation. POSIX/package execution is not established by Windows evidence. No merge, deployment or real-library migration.
