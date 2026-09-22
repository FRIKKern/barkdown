# C020: coordinator interruption audit

Start from verified source61ee/evidence2ea6707. Parent explicitly requested further pause/resume/cancel/deadline and interrupted review/summary proof. C015 remains immutable; no behavior defect is assumed. No Electron or shared runtime permission in this window. Headless Node/native checks may proceed.

## Outcome

Prove that worker completion and coordinator output racing a person stop or deadline cannot accept superseded work or overwrite human drafts. Kill the real headless host during review and summary, reopen without replay, verify owned process shutdown and explicitly reconcile/retry. Preserve exact old attempts and evidence.

## Plan

Audit existing transactions and tests, add bounded deterministic race probes, then native SDK/Windows-job host-death fixtures. Reproduce a concrete failure before runtime changes. Keep test claims distinct from Electron UI or authenticated execution. Any app/test source change requires frozen source and fresh visual/live gates before cycle completion.

## Checkpoint

Read C015 handoff, plan/acceptance and controller/scheduler contracts. Stop marks running attempts interrupted before cancellation; settle preserves that state, and controller advances only active goals. Existing proof covers planning death and person acceptance racing late review, but lacks native death during review/summary and explicit stop races across all roles. No behavior changes yet. No owned process. Next: gated headless fixtures and assertions.

Nine added stop-race probes pass in coordinator suite43147 (19 total): pause/cancel/deadline during worker/review/summary. Late output remains interrupted, no automatic acceptance or follow-up, draft retained; existing runtime unchanged. Native host-death test96885 is running through default owned Windows jobs and deterministic local SDK HTTP, holding review/summary responses. C015 copied archive record retained in place. Source changes are tests/fixtures/package script union only, uncommitted. No Electron/shared runtime.

First native run96885: summary host death/reconcile/retry passed in J8YS2y. Review recovery correctly reached explicit retry, but synthetic HTTP fixture rejected the retry prompt because its whole-tail JSON parser included the newly appended prior-review note. Production coordinator parser is unchanged; fixed only controlled fixture delimiter handling. Retained failed profile/journal and test output. Cleanup completed; no Electron/shared runtime. Summary fixture now additionally waits for actual persisted partial text before killing the host. Rerun pending.

Native rerun17500 passes both roles: review myU6jk and summary AFa21p. Actual headless Node host killed after persisted partial output; default verifier proves Windows job shutdown; explicit reconciliation/retry completes nine total SDK requests with each worker attempted once. Twelve coordinator messages and human draft retained; all transcript attempts driver-finished. Full68-goal suite46948 running. Test source only; no production edits or owned Electron/Barkpark runtime.

Combined goal suite46948 passes68/68, including fresh native review9Fqxd7 and summary2THzHp. No runtime behavior gap reproduced. Ready to freeze test source; final full desktop, deterministic capture/approval, live freshness and root gates require the parent UI/source queue. No owned process remains.
