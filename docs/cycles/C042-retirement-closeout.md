# C042 — Retirement closeout

## Delivered

All 80 previously untracked synthetic test-evidence files are committed under remote archive tags. Original bytes match archived blobs 80/80. These are historical captures, not newly approved application evidence. [File hashes and recovery refs](../archive/2026-09-23-untracked-evidence.json) retain their provenance. Both exception branches are retired.

Moved 42 idle Barkdown checkouts and seven owned Barkpark checkouts (six superseded editor lanes and the completed snapshot correction) into C:/Users/Frikk/.codex/retired-worktrees/2026-09-23/. These are preserved directories, not disk-space reclamation. Git registrations are locked for recovery. [Checkout inventory](../archive/2026-09-23-checkout-retirement.json) records old/new paths, original commits and archive tags. Restore a checkout with git worktree unlock <retired-path>, then git worktree move <retired-path> <original-path>. Historical recorded commands keep their original paths; map them through this inventory before rerunning.

Barkdown retains main, finish-profile-isolation and repository-hygiene pending integration. Barkpark local branches now retain main, barkdown/editor-quality (open PR #19579), and canvas-block-identity (consumed runtime). Six older owned branches have verified remote archive tags; other contributors' remote branches were not retired.

Archived the completed Codex task “Get project up to date” after verifying its final handoff. The previous goal-orchestration task was already archived in C041.

## Necessary live exception

The detached barkdown-integration-12h checkout is still used by the running Electron app and terminal worker. Do not move it or stop the user's app as cleanup. Once the app is closed normally, confirm no process references that checkout, then retire it with the same recoverable move. The active hygiene checkout and both repository main checkouts remain. Barkpark's consumed block-identity runtime and open editor PR checkout remain in place.

## Barkpark cleanup review

[PR #19963](https://github.com/FRIKKern/barkpark/pull/19963) already owns dead-file cleanup. Its required Cloud, Console, Elixir and active-task checks pass; GitHub reports mergeable. Reviewed its removal list and retained changes: deprecated client metadata, SDK routing card, dependency comments and a deletion-aware classifier with mutation coverage. This is a bounded review, not an independent rerun of Barkpark's full test suite. The advisory Doc budgets + anchors check exposed a real stale packages/client/ span in the SDK Paper snapshot. Reproduced the failure at 351dc09d9, corrected only that sentence, and verified the 50-snapshot gate plus 22/22 self-tests without baseline changes. Pushed df52dab0a as a fast-forward correction to the existing PR; its CI is rerunning. No duplicate PR was created. Barkpark's main checkout and unrelated untracked files are unchanged. Keep its task task-bd889ed86ea06704 as the existing cleanup owner.

## Validation and integration

Root npm run verify passed (session 92922), including generated output/link checks, roadmap/cycle checks, visual evidence integrity and browser concept/handoff checks. All 48 moved checkouts retain their exact source heads and clean tracked state. [Barkdown PR #31](https://github.com/FRIKKern/barkdown/pull/31) owns integration; fresh CI is required on the final head. No application, dependency or capture behavior changed in this cycle; C039's accepted images remain applicable. No deployment is authorized by this cleanup.

## Next action

The bounded cleanup work is delivered. Check PR #31 for main integration and PR #19963 for the upstream cleanup check results. Retire finish-profile-isolation after integration. Keep the single running-app checkout exception visible until normal app shutdown. P2 migration is the next product cycle.
