# C040 — Linux parity merge gate

The user authorized main merge. PR #30 fresh run 35803626475 passed 17/20 groups; row14 nested task text acquired the last two seed characters, find started at match two, and gaps failed while obtaining an unstarted video. Existing behavior assertions remain required.

Find uses Home after a center click into a wrapping paragraph, which moves to a visual line start rather than the document beginning. Row14 sets selection then refocuses; replace this with explicit target-end selection and assert the caret before typing. Parity CI installs npm packages but not the Playwright video executable. Ensure recording failures still produce the original structured report.

Source changes and validation pending. C039 provider authentication is preserved separately on codex/finish-profile-isolation; resume after this merge gate. No deployment or shared-service changes.

## Source and local verification

`e32482f` repairs explicit caret preconditions, installs the required CI video executable, and retains video-finalization failures in structured output. Assertions were not loosened. Isolated actual-server rerun passed row14 4/4, gaps 13/13, find 6/6. Original Linux failures and repaired local report are retained under `docs/cycles/evidence/C040-pr30`.

Reviewed 13 native stills and 53 video samples at 2fps in `docs/visual/editor-gap-assertions/runs/2026-09-23T01-02-46-560Z`; named review binds artifact hashes. Row14/find stills separately inspected. Fresh live status has a successful Codex turn, five reviewed stills and all 37 GIF frames reviewed. Deterministic 01-06-12 run approved: 37 stills/eight GIFs identical to prior baseline; three differing side-chat stills reviewed; all 40 frames retain geometry and stay within tolerance. Both private runtimes stopped. Root verify and full Linux CI pending.

Root npm run verify passed with the new approved evidence. The intermediate e32482f CI concept failure was the expected stale visual fingerprint before the required source-then-evidence sequence; local fresh check:visual now passes. Hold the evidence push until the running full parity job completes so its result is preserved rather than canceled.

Second Linux run 35804567947 passed 18/20: row14 and find fixed; video now records. Multiblock visual Shift+ArrowDown did not span paragraphs; gap URL selection and warning shorthand setup failed (11/13). Replaced the spanning fixture setup with its existing exact range helper, added selected-label and empty-block preconditions, and retained nested diagnostics/video in CI artifacts. Behavior and server assertions remain unchanged.

At 71d0d37, isolated native multiblock passed 11/11 and gaps passed 13/13. Latest native proof: docs/visual/editor-gap-assertions/runs/2026-09-23T01-14-07-857Z (13 stills and 56 video samples reviewed at 2fps). Deterministic run 2026-09-23T01-15-19-599Z explicitly approved after reviewing four changed stills and all four changed GIF frames; 36 stills/seven GIFs match prior reviewed bytes. Root npm run verify passed. Live status source e32482f remains valid: app/main, app/renderer, app/shared and dependency inputs are unchanged by the subsequent fixture repairs. Linux full-suite result remains pending. All isolated local test services stopped.

Third Linux run 35805353848 passed 19/20; all prior failures now pass. Emoji 3/4 failed because its initial caret targeted the heading (retained screenshot shows the inserted emoji in the heading). Replaced click-derived selection with explicit paragraph DOM endpoint and a focus/range/parent assertion before typing. Actual Enter insertion/server assertions remain intact.

Final source repair 3364143 passes emoji 4/4 locally; reviewed repaired-emoji.png shows insertion in the intended paragraph. Final deterministic capture 01-24-15 was explicitly inspected and approved; evidence through 5325300 passes root npm run verify. Final full CI run 35806239614 is pending. Repository truth review covered README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, architecture and decisions; next-cycle docs correct stale foundation/consumption descriptions without changing app behavior.

## Completed merge checkpoint

Final Linux run [35806239614](https://github.com/FRIKKern/barkdown/actions/runs/35806239614) passes all 20 groups at 5325300; final structured report is retained in evidence/C040-pr30/final-linux-parity.json. Both repository checks and Windows visual candidate pass. PR #30 merged on 2026-09-23 as 39032881951266ec764163d823e6e795d95da7e1. No deployment. C040 is archived as complete; C039 resumes for provider authentication. Root verify passed on final candidate and the documentation continuation; post-closeout check must pass before commit. No owned services remain.
