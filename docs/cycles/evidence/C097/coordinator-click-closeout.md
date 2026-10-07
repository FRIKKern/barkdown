# C097 — Windows return

Status: active; P2/A2 unaccepted. Owner: Codex Windows return. Phase: integrating.

## Current outcome

Implementation 39c06b94 gives the initial Plan and start click and first fixture stream one shared 90-second budget. The click is never retried; journal/request checks require exactly one goal, plan task, attempt and initial request. Production helper, scheduler, UI and deadlines are unchanged. Budget: 45-minute ceiling from 21:45 UTC; stop after scoped proof, visual/root gates and coherent publication. Healthy Node 22.13.1/npm 11.5.2/Electron 44.5.1 and locked dependencies reused; native runs serialized.

Hosted Desktop 37688437806 failed on 30c290d5 at the old 30-second click acknowledgement; one goal/attempt already existed. Its helper-to-child creation interval was 32.521s. The cause remains unknown. Earlier full Desktop 37683909282 and Verify 37683909132 passed at f190e831; that app source was unchanged in the later failure. Latest Verify 37688437529 passed. Both outcomes are retained, with no whole-stage acceptance claim.

## Evidence and review

[Exact repair review](coordinator-click-review.md) links retained hosted and controlled evidence. A synthetic 35-second renderer input stall fails the original harness in 48.609s. The first corrected full replay fails in 79.180s after the click/stream succeeded because Goals had closed; this remains unexplained. An instrumented follow-up records one intended click and passes the full eight-turn journey in 61.335s, with 35.958s acknowledgement and 36.280s first stream. No helper reopens the view to make it pass. A swallowed-submission control fails as expected in 102.776s: click acknowledged in 32ms, zero requests/journal at the 90-second deadline.

Ordinary actual Electron coordinator (24.541s) and crash/restart/review/retry (29.306s) pass. All 22 resumed Desktop commands pass in 221.400s aggregate; terminal (85.963s) verifies four owned receipts stopped. This is segmented local validation, not a new full-chain run. Five existing full-chain skips remain: two POSIX, three private-Paper prerequisites. Fifty native images inspected, including failures, recovery, terminal and 11 Original history frames. Desktop-wide terminal media stays local.

[Capture29](capture-29/result.json) from clean 39c06b94 passes: Paper 106.976s, standard 27.568s, compare 7.862s. All 44 standard stills/differences/motion, five Paper stills and 37 GIF frames inspected in 16 sheets; Settings, 390px Goals and Paper29/36 enlarged. Only the temporary Settings command path differs; geometry unchanged. [Explicit approval](review-coordinator-click.json). Dark stills remain available; light fixtures retain theme/contrast and original-failure comparisons. The real private Paper editor uses a labeled sample transcript. Existing root notebook demo remains applicable. Retention24 completed recoverably; do not rerun. Root45 passed in 45.712s ([receipt](verify-45/result.json)).

## Integration and next action

Publish this verified checkpoint once, including the release-guide correction 5c15b369 and this implementation/evidence. Update PR75 via REST and read back its exact head/body/draft status. Record new run IDs/results in `.git/pr75-coordinator-ack-publication.json`; avoid evidence-only pushes that restart CI. No native process remains. Earlier shutdown-acknowledgement repair 9a74a3af and ownership repair 92292586 remain in [prior evidence](coordinator-ack-review.md).

The [Windows packaging audit](windows-packaging-readiness.json) corrects stale platform/updater guidance and names runtime/driver/installer prerequisites. Root44 passed in 44.369s for that preparation. No packaging implementation, release script, signing, feed or real-profile action occurred; P5 dependency order remains intact.

Repository truth review covers README, active plan, acceptance, architecture, app guide, validation and handoff. The roadmap was regenerated and inspected at full dimensions. Source/doc whitespace checks exclude unchanged executed diagnostic copies and raw logs. Efficiency lesson: a native click can dispatch work before acknowledgement; use one bounded action/result budget and assert identity/counts instead of retrying. No token measurement is available; merged timestamp unavailable.

## Limits and hygiene

No merge or deployment authorization, including Mac nightly pickup. Real-library A2, actual Mac transfer, real-provider Windows continuity, installation, media/writer reconciliation, backend-drain recovery and G2 remain open. No Mac export is available; provider blockers were not retried. Native latency and the synthetic dismissal remain unresolved. Estimate reviewed unchanged: 495/(495+156), about 75%, range 30–90%, low confidence. This harness repair adds no migration scope.

[Inventory29](repository-closeout-29.json) and bounded [task inventory](related-task-inventory-29.json) retain main plus one lane, 46 Barkdown worktrees (43 locked), 14 sibling worktrees (7 locked). Runtime 944a57a1 is clean; sibling 68412eff and five untracked files unchanged. Cleanup owner: cycle maintainer; review after integration, preserve unique/locked work. An accidental duplicate copy of older local history captures was moved recoverably to `.git/recovery/C097-duplicate-history-copy`; only this checkpoint's 11 history frames were retained in evidence. Deadline: 8 October 04:25:45 UTC.

Root45 passed at22:06:40 UTC. The ready implementation was committed at22:00:07 UTC; merge readiness still depends on integration review and authorization. Subsequent status is kept in the publication receipt to avoid restarting expensive CI for wording alone.
