# C076 preparation checkpoints

This is unfinished development on `codex/profile-preparation`, not a merge-ready or complete preparation gate.

## Ordinary drain — ac203346

[Recorded checks](ordinary-drain-validation/result.json) bind the passing build,45 focused checks and full desktop suite to clean source ac203346. The [focused log](ordinary-drain-validation/ordinary-drain.log) includes17 admission/drain cases, real Windows worker/process regressions and existing profile/provider/goal integration. Measured durations: build0.723s, focused9.346s, desktop532.560s. The full desktop pass includes its recorded platform-specific skips; it does not substitute for hosted or visual gates.

The new native test starts two actual owned process trees through the production profile service and Windows worker adapter. Draining A stops its root, child and grandchild, verifies a complete zero-process receipt, retains the final transcript, and leaves B alive and still writing its disposable marker. A restarted service revalidates A's receipt; B is then stopped through its normal owned run controls. No provider SDK, external account or real library is used. Deferred-adapter cases independently hold startup, dispatch return and lease release open, exercise missing receipts across retry/restart, and retain foreign/failed completion and interrupted effects.

`drainOrdinary` is an internal partial barrier. It rechecks retained ordinary reservations, so old turns without an owned receipt require an explicit reconciliation policy; no missing receipt is silently treated as shutdown. Runtime cleanup faults are retained in the current service; whole-profile restart reconciliation, goal/journal drain, dirty Paper drafts and authority selection are still unfinished. There is no renderer preparation control or completed migration acknowledgment. Current-source native UI/live/standard capture and root verification remain required before merge.

## Explicit recovery correction —3cceb3d7

Extending two failure cases to perform an explicit shutdown/effects review exposed a stale in-process ticket: later drain still rejected the superseded observer. [Both failing checks](ordinary-recovery-failing.log) were run against ac203346 with the new test assertions. The correction waits for the matching dispatch/completion to settle and removes the ticket only after the effects review is persisted. Separate runtime-release failures remain blocked. [19 passing targeted checks](ordinary-recovery-corrected.log) ran on the changes subsequently committed as3cceb3d7, including the new native A/B process case and ordinary recovery regressions.

[Native recovery](ordinary-recovery-native/manifest.json), run after that implementation commit, passes actual Electron abrupt death, no replay, retained main/side drafts and attachment, explicit shutdown/effects review and a fresh turn. All three jobs are verified stopped. [Native log](ordinary-recovery-native.log). Five stills were actually inspected: [interrupted](ordinary-recovery-native/interrupted.png), [verified](ordinary-recovery-native/verified.png), [fresh turn](ordinary-recovery-native/new-turn.png), [side chat](ordinary-recovery-native/side-interrupted.png), [narrow review](ordinary-recovery-native/side-verified-narrow.png). The existing harness's light theme is retained here for recovery compatibility review; the final preparation gallery must use the default dark theme. Text, draft, review field and controls are readable in the inspected wide and1000x800 images. Full-motion originals remain in the manifest's disposable capture directory, unreviewed; these stills do not approve motion/GIF or standard/live baselines. Final-source full desktop/root and formal visual approval remain pending. No owned test service remains.

## Earlier launch closure and UI smoke

Initial runtime49bfdda7 passes the full desktop suite. The post-authentication race fix at33cf7214 passes69 focused tests; a4859299 changes only the native harness assertion. The following visuals are historical smoke evidence, not approval of ac203346.

| Evidence | Result and scope |
|---|---|
| [Build](build.log), [desktop](desktop.log) | Passed on initial runtime49bfdda7 before the race fix |
| [Final focused tests](launch-final.log) |69 passed, including9 launch-admission cases and ordinary/goal wrapper-resolution races |
| [Native smoke](native-smoke-passed/manifest.json), [log](native-smoke-corrected.log) |Actual Electron send refusal, exact unsent draft preservation, durable closure and restart pass on a4859299; no provider call or complete migration preparation claim |
| [Initial authentication gap](auth-gap.json), [failing regressions](auth-gap-failing.log) |One ordinary and three goal dispatches slipped through after wrapper resolution; fixed by checking in each caller before reservation |
| [Initial native smoke](native-smoke-initial/manifest.json), [log](native-smoke.log) |Harness incorrectly expected no visible failed pair; existing composer intentionally displays it. Corrected assertions verify the failed pair, no durable reservation and the exact saved draft |
| [Initial focused log](launch-focused.log) |A missing closing brace prevented two test files loading; corrected before67-case integration and final69-case passes |

Three native dark screenshots were actually inspected: [wide refusal](native-smoke-passed/01-refused-draft.png), [narrow refusal](native-smoke-passed/02-narrow-refusal.png), [restart](native-smoke-passed/03-restarted-refusal.png). Draft, error and send control remain readable/reachable at1400x900 and820x900. The raw technical error-code prefix is visible; polish it before presenting a completed preparation flow. This is smoke evidence, not a formal video/GIF gallery or standard visual approval. It preserves a composer draft, not a dirty Paper canvas or active IME.

The admission record closes new launch paths across restart. It does not cancel already-dispatched work, prove descendant teardown, retain Paper drafts, reconcile an abort, reopen the profile or select an engine. Existing transcript writes remain admitted intentionally. Continue C076's full contract; do not enable migration from this record alone.

The four-hour run ended2026-09-25 13:44:56 UTC. No owned test service remains. Preserve the source branches, recovery worktrees and stashes. Main8ab9aae8 is unchanged and its post-merge checks passed; this checkpoint has no PR and is not merged. Runtime/visual acceptance must finish before requesting integration.
