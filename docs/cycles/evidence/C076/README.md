# C076 launch-admission checkpoint

This is unfinished development on `codex/profile-preparation`, not a merge-ready or complete preparation gate. Initial runtime49bfdda7 passes the full desktop suite. The post-authentication race fix at33cf7214 passes69 focused tests; a4859299 changes only the native harness assertion. Fresh full desktop/root and standard/live visual approval on the final source are still required.

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
