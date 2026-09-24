# C048 — Quotes and nested lists

Accepted bounded native migration checkpoint, starting from C047 abfedf2 on codex/p2-migration. [Results and hashes](evidence/C048/results.json) bind the proof. P2 remains active; legacy data stays authoritative. No real-library migration, merge or deployment.

## Changes and proof

Barkdown cbea3f9 maps genuine one-paragraph quotes and recursive mixed lists without flattening children or losing checked state. The hand-authored corpus has 32 cases: 21 representation-preserved, two lossy, two unresolved and seven refused. Multi-paragraph items/quotes, custom numbering, unmapped metadata, inline CR, internal references/media and quote inline breaks remain refused. Nested Markdown export retains structured fallback.

Native tests exposed an upstream task-list boundary omission and missing checklist source attributes. Barkpark 30c007e43 corrects them and preserves task/list metadata through typing, toggle, breaks, join and exact Undo. Full editor tests, build, document budgets and anchors pass (two anchor warnings). Draft PR #20020 remains stacked on codex/canvas-block-identity.

All 31 migration unit checks, interrupted staging, full desktop command and root verification pass. Final native source d92898f passes all 21 cases, deep child editing, paragraph/heading/list Shift+Enter, acknowledged save, exact Undo, reload and Electron restart; source, backups and workspace remain exact. The isolated table row passes 6/6 after its reader endpoint was bound to the same environment-selected private server as writes.

## Visual evidence

[Migration gallery](../visual/migration/README.md): 31 actual stills, 96 source-video samples, all 96 decoded GIF frames and eight restart samples inspected. Full list-break text and narrow nested hierarchy are visible and geometrically checked. Five standard live stills and all 37 GIF frames after a real Claude turn were inspected at source 5e0e580 / upstream 30c007. Deterministic candidate 2026-09-24T00-18-02-364Z has no above-tolerance pixel, geometry or environment changes; three side-chat stills and four changed GIF frames were inspected, while 37 stills and seven GIFs are byte-identical to reviewed C047 media. Explicit immutable approval: docs/visual/reviews/approval-1e288e06025a5439cd4508e65145332a59ecf2885af161667947f92caccff528.json.

## Retained failures and integration limits

Original native failures (task-list guard and multiline locator) and the first successful run’s visual framing limits remain in append-only evidence. No product assertion was weakened. Doc budget overflows were corrected by shortening prose. The original isolated table reader failure is retained; no write went to that other reader endpoint.

C047 final Linux parity 35934541002 timed out clicking Align left; earlier parity passed. The new diagnostic runner retains full errors and hit geometry. New full Linux parity 35937387264 is in progress at this checkpoint; local 6/6 does not erase that earlier failure. Upstream style-mirror/design-token checks and workflow ledger remain red; named style/check inputs match the stacked base by hash. G1/G2 remain release gates, never waived.

## Repository truth and continuation

README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, migration contract and code-area visual health reviewed. Root README’s stale nine-case/line-break refusal claim is corrected. App guide correctly retains the separate legacy store and unmerged fallback baseline; no change needed. [Inventory](evidence/C048/repository-inventory.json): Barkdown main plus one delivery branch; Barkpark main plus three. Historical detached worktrees remain locked/recoverable; the user’s active app checkout is untouched. No dead delivery branch was added. Evidence volume remains retained by policy; a future reviewed archive strategy, not deletion, is the cleanup action.

All owned local test runtimes are stopped. Commit and push this accepted evidence, then archive the cycle JSON and start the bounded internal-reference migration slice. Keep Linux table diagnostics visible. The six-hour goal continues through at least 2026-09-24 04:17:20 UTC. Guerrilla leases renewed at approximately 00:10 UTC: inline-break epoch 7, create-only epoch 13 and nested checklist epoch 2. Stamp reviewed native criteria after publishing evidence; do not close unmerged tasks.

Published at 731d959. [Committed log hashes](evidence/C048/committed-log-hashes.json) supplement four capture-file hashes normalized from CRLF to LF by Git. Native upstream task criteria were stamped against this published evidence. C049 continues references; fresh Linux CI is 35938173825 (the prior intermediate run was superseded).
