# Evidence and remaining proof

## E001 — Paper save ownership, 2026-09-22

Runtime fixes `0e2feca` / `228a008` retain Paper drafts during reload/navigation/close and fence late loads, saves and echoes; failed titles remain recoverable. Capture fixes `61d0753` / `e19edfa` wait actual animation completion and include the recovery harness in visual tripwires. [Handoff](cycles/E001-paper-save-ownership.md) and [recovery health page](visual/paper-save/README.md) record scope and provenance.

- Root/app locked installs and Chromium install passed; no unlocked dependency upgrades.
- `npm run test:desktop` passed: 19 controlled Paper-host races, existing units, 76 desktop checks, direct-edit, composer-history and side-chat suites. [Host results](cycles/E001-host-results.json).
- `npm --prefix app run test:paper-host:isolated` passed four real private-server journeys: retained delayed save/navigation/close, server text Undo/redo, refusal/Retry and cancelable discard. [Clean-source manifest and named image review](visual/paper-save/runs/2026-09-21T22-43-32-426Z/review.json).
- `npm run verify` passed after final visual capture/comparison/inspection/explicit approval. Twenty-one fixture action frames showed no geometry, environment or above-tolerance pixel changes. Five live Paper stills, a 37-frame editing GIF and the dedicated nine-still recovery journey were reviewed; earlier evidence is retained.
- Private runtimes stopped normally; shared services and CLI settings were untouched. Real status showcase used Codex after Claude reported its weekly limit. Profile isolation, native crash/quit durability, specialized block Undo and upstream PR19579 merge remain unproved by this slice.

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

## E002 editor takeover � 2026-09-22

Barkdown663a12a / Barkparkbb3bd299d: 8/8 private-server live cases, host23/23 and direct-edit UI passed. Actual server content, IME, selection/scroll and first-receipt geometry covered. [Named motion review and provenance](visual/agent-takeover/runs/2026-09-21T23-35-14-407Z/README.md). Deterministic21-frame comparison unchanged and explicitly reviewed; current status media real Codex. Upstream full test/save-ack:721 and posttest/press-watchdog:284 remain known failures; no all-green upstream or merge-readiness claim. [Handoff](cycles/E002-agent-takeover.md).
`npm run verify` passed with final current visual approval and exact-source status freshness. `git diff --check` passed.


## E003 rich-content takeover - 2026-09-22

Source9424b97/upstream8530a9e23 preserves human selections during formatting/link and neighboring list/table edits. [Reviewed live proof](visual/rich-takeover/runs/2026-09-22T00-15-10-579Z/review.json): five actual server scenarios, keyboard takeover and matching revisions; actual MCP structured read retains headerless/multiline table data. Mounted6/6, full app suite and final root verify pass. Deterministic21 stills/21 GIF frames, dedicated10 stills/115 GIF frames/112 video samples, and genuine Codex status5 stills/37 GIF frames reviewed. Both private runtimes stopped normally.

Unsupported lossy Markdown conversions fail before mutation; this is not complete advanced table support. Existing upstream save-ack and watchdog failures remain release gates. [Handoff and limitations](cycles/E003-rich-content-takeover.md).


## E004 structured table checkpoint

Revision-checked cell patches and exact structured reads preserve headerless/multiline/alignment metadata. Three real Paper MCP cases pass Undo, human save and reload; full app suite and focused upstream rich/header checks pass. See [E004 evidence](visual/structured-table/README.md). API parity is separate root E005 work; upstream full-suite baseline failures and default bundle pin remain explicit limits.


## E006 aligned Markdown paste

Upstream `9803bbe5e` preserves GFM center/right alignment, marks, links and literal pipes. Actual Paper paste, native Undo/redo, subsequent human edit and server reload passed at Barkdown harness `c22c0d3`. [Reviewed evidence](visual/markdown-paste/README.md). Upstream full-suite JSDOM save-ack baseline and default bundle integration remain open; no merge or deployment.
