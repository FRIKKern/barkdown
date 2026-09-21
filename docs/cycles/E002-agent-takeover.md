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

The copied a544 server build alone could not serve from the relocated source: runtime `pfoYbJ` hit Phoenix stale-config failures for config/dev.exs and config/config.exs. Do not alter timestamps or manifests to bypass this. Root authorized the documented local compile in the isolated worktree. `mix compile --no-deps-check` with the Scoop Elixir/Erlang toolchain rebuilt 921 files successfully, with baseline warnings. The freshly generated editor bundle was copied into the own worktree's served `_build/dev/lib/barkpark/priv/static/assets` and both hashes compared.

After that actual rebuild, `RaybdW` started and stopped normally, served exactly the new generated bundle (SHA1 `4c7b4292234b343f54ae7431d93e0d16b5841536`), and the first test failed waiting for the selection animation; video showed the acknowledged content already applied with its caret retained. This is not a passing takeover test. The next run `EBQjpf` adds explicit normal-motion media and phase/geometry failure diagnostics. Both runs use the owned source/cache; no shared source mutation. The earlier failed-cache runtime remains in its bounded startup retries until its final cleanup completes.

Current checks: 23/23 controlled Paper host tests; full Barkdown test suite passed, including 76 desktop checks, direct-edit UI, history and side-chat parity. Upstream full npm test reaches the same pre-existing save-ack line 721 failure; new mounted takeover, cross-source debounce, rejected acknowledgement, node-view flush, and IME tests pass. The new seam distinguishes already completed own receipts from genuine in-flight writes and requires host revision fencing; the host test proves its existing saving guard waits for an outstanding own echo before external acceptance.

Upstream PR19579 was rechecked at a544: OPEN/BLOCKED with 13 failing check contexts. Its own body already documents the Windows save-ack and press-watchdog baselines. The task guide requires a claimed task before work; root forbids shared task-database mutation in this lane. Preserve that boundary, do not invent task fulfillment; publish a branch-only upstream checkpoint if tracker requirements remain unsatisfied.

Next: complete expanded live takeover/IME/hidden/reduced-motion/server assertions, exact-source commits, full-motion visual review and evidence commits. `resolveConflictWithServerBlocks()` remains an explicit discard seam and is not used for presentation.

## First exact-source proof and review finding

Pushed Barkdown `afc9c79` and upstream `bb3bd299d` (`codex/agent-takeover-12h`). Runtime `7XtbS6` passed all 8 real takeover cases, including real Chromium IME, pointer, beforeinput, hidden/reduced motion and offscreen reading. Clean source evidence: `docs/visual/agent-takeover/runs/2026-09-21T23-24-10-177Z/manifest.json`; actual fetched bundle SHA1 `4c7b4292234b343f54ae7431d93e0d16b5841536`, private build fingerprint `89ee64ee883625f816f413292c013834b4e92160dae24ba1ccc142ba7d86698e`. Runtime stopped normally. Failed old-cache `pfoYbJ` also exhausted its budget and stopped cleanly.

Motion inspection found a roughly 44px first-receipt layout shift after presentation. This run is retained but **not visually approved**. Root directed fixing it inside E002. The pending correction moves Paper’s receipt into its existing metadata line, gives that useful line stable height, keeps Undo reachable with an ellipsized summary, and updates the visible saved revision after accepted external content. Added live geometry assertions cover visible paragraph positions before/during/after first receipt and offscreen first-receipt insertion. Corrective code is currently uncommitted; controlled host 23/23 and direct-edit UI tests pass. Final live verification and recapture are pending.

The deterministic `2026-09-21T23-23-17-409Z` run at afc9c79 was actually reviewed (all 21 PNG and 21 decoded GIF frames), compared with no pixel/geometry/environment changes and explicitly approved for that source. Its approval is invalidated by the pending correction as intended. The afc9c79 live status capture used real Codex after Claude’s weekly limit and stopped (`RxmvsO`); retain its manifest as historical when replacing it with final evidence.
