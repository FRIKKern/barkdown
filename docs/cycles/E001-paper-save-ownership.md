# E001 — Keep Paper edits attached to the document that produced them

Editor lane, completed and validated 2026-09-22 on `codex/editor-upgrades-12h`, based on `b8e7bfb`. Implementation `0e2feca` and `228a008`; capture-settling correction `61d0753`, capture tripwire `e19edfa`. This independently bounded editor cycle does not replace the central P1 queue. The user authorized parallel editor work for the twelve-hour session; no merge or deployment.

## Outcome and acceptance

Keep unsaved Paper content through reload/navigation attempts; prevent late document loads, save acknowledgements and echoes from changing another document; retain honest save status while a subsequent batch is running. Prove rapid navigation, failed saves and out-of-order responses with focused host tests, then exercise real Paper/server Undo and navigation with a disposable runtime. Preserve the real canvas and PortableDoc protocol.

Scope: `app/renderer/src/tabs/paper.js`, focused tests, editor evidence and this handoff. No profile registry, adoption or central queue changes. Upstream canvas changes require a separate isolated Barkpark branch and its own instructions.

## Starting audit

- Read AGENTS, NEXT-AGENT, PLAN, ACCEPTANCE, DESIGN-DECISIONS, CYCLES, visual rules and editor matrix; ran `npm run plan` and `npm run cycle`. Central C001 remains planned P1 ownership work.
- PR19579 remains OPEN at `a5440345caa413087ac6488cac67f19fce58fa0f` (GitHub CLI inspection); existing failing Elixir/security checks remain release gates. No upstream integration is claimed.
- `load()` can finish against an obsolete path; reload remounts a dirty canvas; save responses read mutable `slug()` and `canvas`; a boolean `saving` can clear while an acknowledgement has synchronously dispatched another batch. These are audit findings, not yet reproduced or fixed.
- Root and app `npm ci` passed; app reports two high severity dependency advisories. No unlocked upgrade applied. `npx playwright install chromium` passed.

## Checkpoint

Uncommitted implementation now guards dirty reload/navigation/close and chat deletion, captures the mounted document/canvas during writes, ignores obsolete loads/echoes and counts chained writes. Root review identified the bundle-loading await boundary and title-write ownership; both are guarded. Explicit failed-save discard requires confirmation, reads the saved copy before changing the draft and refuses to replace intervening input. Enable-live no longer remounts the canvas.

`node app/tests/paper-host.test.mjs`: initial five tests all failed against the baseline; expanded eight-test suite passes after implementation. These controlled transport/canvas tests prove host orchestration only. The first real private-runtime test stopped at fixture publication (label-spine metadata too short); runtime stopped cleanly and its temporary data remains. Fixture metadata corrected, next run pending. No shared services/config were changed.

Further review fixed failed-read retention, kept retained title handlers usable after cancelled navigation, serialized title writes, preserved failed title drafts with Retry/Discard and cleared the dirty guard when accepting a server conflict version. The controlled suite is now 17/17 passing, including cold bundle resolution, title writes, late failure after destruction and intervening input during discard reads.

Real private-runtime run: `node app/tests/status-shots-isolated.mjs tests/paper-host.live.mjs` with explicit `BARKDOWN_TEST_BP_SOURCE=C:/Users/Frikk/Documents/GitHub/barkpark-editor` passed 4/4: delayed real write/reload/navigation/close, server Undo/redo, refusal/Retry, cancelable explicit discard. Keyboard and middle-click close were exercised. The runtime stopped cleanly. Narrow failed-save screenshot inspected: error and both recovery buttons remain visible and text wraps. Test results remain in ignored `app/test-results/paper-host`; final source-linked evidence will be captured after the implementation commit.

`npm run test:desktop` passed all existing units, 76 desktop checks and direct-edit/composer-history/side-chat suites. Subsequent source refinements pass the 17-test focused suite; the desktop suite will be rerun for final source. `npm run verify` reached the visual freshness tripwire and correctly failed pending fresh capture/review; no baseline was auto-approved.

Root serializes runtime use because the built Barkpark source has a shared build directory: editor currently owns no running runtime and awaits next-cycle's release. No shared services/config were changed. Next: commit this tested implementation, capture deterministic tours while waiting for source-runtime slot, then fresh live status and Paper recovery evidence, actual review, full verification and evidence commit. Limits: this is navigation/session loss prevention, not crash recovery or profile isolation; native app shutdown/crash durability is P3. The legacy separate title endpoint still uses the CLI contract, not a newly invented revision guarantee.

## Final-source validation checkpoint

Latest checkpoint: settled recovery recapture completed 4/4 and owned temporary runtime `barkdown-shots-runtime-1ULuHy` stopped normally; source slot released to root. Capture source is `e19edfa` (runtime implementation remains `228a008`). Final deterministic tour `2026-09-21T22-41-46-408Z` is clean and explicitly approved, with 21 unchanged frames. No editor-owned runtime remains running.

- Root review caught a stale reload even after an intervening human change had completely saved. `228a008` snapshots input activity and revision, rejecting that older read. [Nineteen controlled tests](E001-host-results.json) now pass, including fully saved body and title cases.
- Final runtime source passed `npm run test:desktop`: units, all 76 Electron checks, direct-edit, composer-history and side-chat tests. Full `npm run verify` passed after explicit visual approval, including concept/handoff regression checks.
- [Deterministic comparison](../visual/runs/2026-09-21T22-34-11-177Z/comparison.json): 21 frames, no changed pixels above tolerance, geometry or environment changes. All five area contact sheets inspected and explicitly approved by Codex editor agent. Broad source-dirty flag reflects the app README link only; source fingerprints bind actual inputs.
- [Live status provenance](../images/status/history/E001-228a008.json): clean app runtime source at `228a008`, clean Barkpark `a5440345c`, version `0.2.26.3877`, isolated private server, real Codex turn after Claude weekly limit, five stills and 37-frame editing GIF. All stills and all GIF frames inspected.
- [Paper recovery gallery](../visual/paper-save/README.md): all four real-server journeys passed. Root inspection caught the discard modal health still during its 140ms entrance animation. `61d0753` now awaits actual finite animation completion instead of masking animations. The prior gallery remains preserved; settled recapture is queued behind other agents' source-runtime windows. This is the only remaining evidence task before E001 closeout.
- Owned runtime `v4x8fW` stopped normally. No editor-owned runtime is running. Raw unhashed status outputs and the abandoned pre-correction deterministic candidate were moved to ignored `test-results/E001-*`; approved history and hashed captures remain intact.

Settled [recovery manifest](../visual/paper-save/runs/2026-09-21T22-43-32-426Z/manifest.json) records clean source. [Named visual review](../visual/paper-save/runs/2026-09-21T22-43-32-426Z/review.json) binds all artifacts; nine stills and every action-GIF frame inspected. Confirmation text/buttons are now crisp after actual transition completion, with intended backdrop blur intact. Previous evidence remains preserved.

Truth review: reviewed root README/gallery, app guide, PLAN/plan.json, NEXT-AGENT, ACCEPTANCE, editor matrix, visual area READMEs and coverage. Updated editor row 8 narrowly for text Undo/redo, app guide and gallery; no P1–P5 stage completion or upstream merge claim. The central queue/handoff belongs to the coordinating agent during this parallel session; C002 merge wording in the inherited baseline is superseded by main `b8e7bfb`, and root owns its coordination update. This editor lane did not overwrite profile work.

Next exact action: [E002](E002-agent-takeover.md), approved by root: reproduce real Paper focused-idle agent refresh and takeover against queued external blocks before changing its presentation contract. Commit/push evidence, then start that reproduction. No merge/deploy; no shared-service or CLI mutation.
