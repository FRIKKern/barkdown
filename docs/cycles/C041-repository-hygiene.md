# C041 — Repository hygiene

Bounded scope: reconcile Barkdown delivery branches, replace contradictory active handoff text, and require repository hygiene at every cycle closeout. This changes no application behavior.

## Current checkpoint

Cleanup is implemented on codex/repository-hygiene, based on the accepted C039 checkpoint f65c0c6. Main remains 9c623d5. Six merged local branches and four corresponding remote branches were retired after ancestry checks. Checkout files remain intact. Forty historical lane tips were pushed as archive/2026-09-23/codex/* tags and checked against their original full SHAs before atomic remote branch retirement. Local and remote branches now contain only the named retained lanes (the hygiene branch is the publication lane). See the [recovery inventory](../archive/2026-09-23-branches.json). All 46 checkout directories remain intact; 42 are detached historical checkouts, not active work. Physical checkout retirement remains a separate recoverable-cleanup action because historical harnesses reference their paths.

Keep main, finish-profile-isolation (accepted checkpoint awaiting integration), repository-hygiene (this work), editor-block-identity and packaging38-12h. The last two exceed the three-delivery-branch budget temporarily: the coordinator owns review of their untracked visual evidence at the next cleanup checkpoint; do not remove those files.

Barkpark already has [cleanup PR #19963](https://github.com/FRIKKern/barkpark/pull/19963), and [editor PR #19579](https://github.com/FRIKKern/barkpark/pull/19579) remains open. Preserve its contributor work, dirty main checkout and consumed bf23f773 runtime. This cycle does not certify the entire Barkpark repository clean.

The completed goal-orchestration/audit Codex task was archived after reading its final handoff. Its committed branch tip remains in the recovery inventory. Other contributors’ tasks were not changed.

## Verification

Root npm run verify passed (session 48605): generated outputs, local links, roadmap/cycle checks, current visual hashes and browser concept/handoff checks. Final npm run check also passed after the handoff, A1 and validation ledgers were reconciled. No app, dependency or capture behavior changes: existing accepted C039 visual evidence remains applicable; do not restamp it. The old contradictory handoff is archived, not an active queue.

## Next action

The bounded branch/documentation cleanup is complete; publication is recorded by its Git commit. Review the two retained evidence directories before their eventual retirement. P2 migration remains the next product slice.
