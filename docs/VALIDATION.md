# Evidence and remaining proof

Baseline at the 2026-09-21 roadmap reset. Implementation evidence is separate from the pending journey gates in [ACCEPTANCE.md](ACCEPTANCE.md). [Original concept validation](archive/2026-09-21-validation.md) is archived.

| Baseline | Evidence | Limits |
|---|---|---|
| Desktop shell and agent integration | App `npm test`: unit suites, 76 Electron checks, direct-edit, composer-history and side-chat UI checks passed during local-runtime delivery. | Some provider orchestration uses scripted clients; not a new live run of every provider. |
| Shared editor features | [EDITOR-PARITY.md](EDITOR-PARITY.md) records live comparisons and counts, including tables, media, IME, multi-block editing and large documents. Upstream branch `a5440345c`. | PR #19579 still open at reset; matrix contains partial/limited proof. No claim of all upstream gates passing. |
| Managed Windows local runtime | Barkdown `930fc2f`: `npm run test:local` passed actual private PostgreSQL/Barkpark startup, authenticated reads, crash recovery and restart. Expanded `local-barkpark-ui.live.mjs` passed editing through recovery, saved state after restart, Settings status, quit/window-close cleanup. | Built checkout/toolchain required. Injected worker-failure log detection is unit-tested; actual OS error 487 is not deterministically reproduced. No packaged install or multi-profile proof. |
| Repository and screenshots | Root `npm run verify` passed; status image manifest at `5c91d29`. | Concept/build checks are not production storage or sync tests. |

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

## C006 — opt-in profile workspace integration

Clean source `168e31b` integrates main-owned UUID/generation IPC, durable transcripts, runtime leases, profile Settings and goal service. Full app suite passed unit checks plus 76 desktop checks and dedicated direct-edit/history/side-chat/profile/goal UI suites. Actual Electron process restart preserves selected B, drafts, side-parent/tabs and persistent website cookies/storage; deterministic three-worker transport proves late A persistence while B is selected. Dedicated actual Paper HTTP save guard passed at clean `b58a4e4`.

[Cycle handoff](cycles/C006-profile-workspace-service.md), [live profile evidence](visual/profiles/live-README.md), [31-frame comparison](visual/runs/2026-09-21T23-29-02-248Z/comparison.json) and [live status source manifest](images/status/history/C006-168e31b.json) preserve provenance. All frames explicitly inspected/approved; existing deterministic frames unchanged. Live status ran Codex; Claude quota prevented its turn. All owned runtimes stopped. P1 remains pending: opt-in empty profiles are not default adoption, and deterministic worker transport is not live three-provider proof.
