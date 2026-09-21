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

No implementation yet. E001 settled evidence recapture has priority. Next: reproduce the focused-idle case with assertions before choosing the contract. Inspect Barkpark's existing `_applyExternalContent()` mapping/history behavior and public acknowledgement seams in the isolated worktree. The shared built-source capture window is coordinated by root; no source runtime is owned by this planned cycle.
