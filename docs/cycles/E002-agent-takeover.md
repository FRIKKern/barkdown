# E002 — Present acknowledged agent edits without losing the person's next input

Planned editor-lane cycle, 2026-09-22. Root approved after E001 closes. Remain on `codex/editor-upgrades-12h`; no merge/deploy. This does not replace the profile delivery queue.

## Audited risk to reproduce

Paper host `refresh()` advances its revision before `canvas.applyServerBlocks()`. Actual Barkpark `applyServerBlocks()` queues external changes when `_isEditingNow()` is true, including a focused but otherwise idle editor. `hasPendingChanges()` excludes that queued external content. Consequently the host may believe a new revision is visible while Paper retains the old blocks. The presentation can target the old DOM and a human takeover may emit a change from the old baseline under the newer host revision. This is an evidence-based hypothesis, not a passing reproduction or proven data-loss claim yet.

## Bounded acceptance

1. With the real Paper canvas and a disposable server, leave a caret/selection in an idle focused paper, apply an agent edit, then take over by typing. Compare actual saved content to both the acknowledged agent change and the human addition.
2. Ensure presentation never hides or animates a change the real editor has not accepted. Preserve unaffected selection and reading position; immediately yield to pointer, keyboard and composition input.
3. Exercise hidden panes and reduced motion without fabricated saves or extra operations. Record genuine motion/video and final server/revision evidence.
4. If editor internals require a new guarded application seam, create an isolated Barkpark worktree and follow its guide. Do not force an explicit conflict-discard API, copy editor source into Barkdown or alter the shared source checkout.

## Checkpoint and next action

E001 closed at `096e93e`. The initial real takeover harness is `app/tests/paper-agent-takeover.live.mjs` (uncommitted). Disposable runtime `b7ti00` reproduced actual data loss: agent revision 1→2 saved `Acknowledged agent sentence.`, then typing during selection presentation saved `Original target sentence. Human follows.` at revision 3. Both visible and actual server content lost the agent sentence. The runtime stopped normally; its slot was released. Before-fix screenshots/result remain in `app/test-results/paper-agent-takeover` pending evidence archival. This is diagnosis, not final visual approval.

An isolated upstream worktree was created at `C:/Users/Frikk/.codex/worktrees/barkpark-agent-takeover`, branch `codex/agent-takeover-12h`, baseline `a5440345caa413087ac6488cac67f19fce58fa0f`. No upstream source changed. Locked editor `npm ci` passed (audit reports three moderate and one high issue; no dependency upgrades). The unchanged upstream cross-source debounce test passed. The unchanged `__save_ack_mounted.test.mjs` failed at line 721: `keep: the remote sibling survives`, actual child count 1 instead of 2. This is a baseline failure, not evidence against an E002 fix; retain it in validation reporting.

The initial guarded upstream `applyServerBlocksIfIdle()` and host acceptance patch are uncommitted. The new mounted acceptance test passes; host tests pass 22/22. An existing whole-paragraph replacement moved a caret to the next paragraph; the patch now uses a minimal inline transaction for same-type textblocks and tests the caret remains at the changed paragraph's end. Full upstream tests are running. No live passing E002 result yet.

### Explicit runtime dependency

Root approved importing the exact isolated-build launcher files and their tests from next-cycle commit `34b17ce`: `runtime-build.js`, `file-lease.js`, `local-barkpark-source.js`, `local-barkpark-boot.exs`, `local-barkpark-launch.ps1`, and the runtime-build/file-lease/local lifecycle tests. Registry/pool/profile UI changes are outside this editor lane. Imported runtime-build, lease, and lifecycle suites pass. C007's dual-runtime proof passed at that commit; E002 must still prove its own compiled editor asset is served from its own copied build. Current C007 status capture owns the shared source window.

Next: finish tests, build the isolated upstream bundle, prepare a private copied runtime with exact asset hashes, then run expanded takeover/IME/hidden/reduced-motion/server assertions. `resolveConflictWithServerBlocks()` remains an explicit discard seam and is not used for presentation.
