# Evidence and remaining proof

Baseline at the 2026-09-21 roadmap reset. Implementation evidence is separate from the pending journey gates in [ACCEPTANCE.md](ACCEPTANCE.md). [Original concept validation](archive/2026-09-21-validation.md) is archived.

| Baseline | Evidence | Limits |
|---|---|---|
| Desktop shell and agent integration | App `npm test`: unit suites, 76 Electron checks, direct-edit, composer-history and side-chat UI checks passed during local-runtime delivery. | Some provider orchestration uses scripted clients; not a new live run of every provider. |
| Shared editor features | [EDITOR-PARITY.md](EDITOR-PARITY.md) records live comparisons and counts, including tables, media, IME, multi-block editing and large documents. Upstream branch `a5440345c`. | PR #19579 still open at reset; matrix contains partial/limited proof. No claim of all upstream gates passing. |
| Managed Windows local runtime | Barkdown `930fc2f`: `npm run test:local` passed actual private PostgreSQL/Barkpark startup, authenticated reads, crash recovery and restart. Expanded `local-barkpark-ui.live.mjs` passed editing through recovery, saved state after restart, Settings status, quit/window-close cleanup. | Built checkout/toolchain required. Injected worker-failure log detection is unit-tested; actual OS error 487 is not deterministically reproduced. No packaged install or multi-profile proof. |
| Repository and screenshots | Root `npm run verify` passed; status image manifest at `5c91d29`. | Concept/build checks are not production storage or sync tests. |

## Pending evidence

Separate goal-orchestration branch: clean source `043e472` passes root verification and the full desktop suite, including 46 goal tests, owned process-tree shutdown/recovery, and actual Electron worker streaming/profile switching with deterministic HTTP. [Authenticated three-Codex proof](goals/evidence/beefded/authenticated-codex.json) records clean source beefded, three concurrent native jobs and reviewed completion. [Electron images](goals/evidence/043e472/README.md), 31 reviewed deterministic frames and fresh live Paper evidence are distinct. C005's bounded scheduler is proven; crash-dialog recovery and natural-language coordinator planning/review remain unfinished. [Handoff](goals/HANDOFF.md) records exact validation and limitations. P1–P5, merge and deployment are not claimed complete.

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

### Goal service checkpoint cde9794 (2026-09-22)

Root verify and full desktop suite passed.36 goal/provider/service tests include three actual API provider loops over deterministic transport, durable worker transcripts during profile switch/stale save, ordinary side-chat coordinator and recovered-attempt shutdown guard. New27-frame deterministic run23-10-09-960Z inspected and explicitly approved (21 unchanged, six labelled goal fixture frames). Separate isolated Paper capture completed with real Codex turn and clean private-runtime shutdown; five stills/all37 GIF frames inspected. Production goal IPC, native crash-reconciliation path and authenticated three-worker execution remain pending. See [goal handoff](goals/HANDOFF.md).
