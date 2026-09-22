# Candidate: terminal work-tab ownership

Read-only audit after C014 source 9135723. Not an active implementation cycle, and no terminal behavior has been changed or new failure reproduced. C014 covers managed provider jobs, not terminal shells.

## Observed source boundaries

- main.js calls terminal.stopAll during profile rebind; selecting B stops all existing A terminal sessions. Terminal output is tagged with the captured profile, but input/stop resolve only a bare tab id.
- terminal.js spawns a shell directly and child.kill only stops the immediate child; there is no owned descendant Job receipt or abrupt-main-exit proof.
- start replaces an existing id; the previous child exit handler unconditionally deletes sessions[id]. Audit an old exit racing a new same-id session before claiming safe replacement.

## Proposed bounded proof

Use only disposable folders and uniquely named child markers. Start a parent shell plus descendant; capture profile A/tab identity and working folder. Select B with the same tab id, verify B cannot send input/stop A, and demonstrate the intended switch policy without silently abandoning child work. Restart/normal close/abrupt main exit must account for the entire owned process tree and preserve transcript/status honestly. Old-session exit must not remove a new same-id session. Unknown external processes must never be killed.

Decide whether terminal sessions persist in the background or require explicit stop before switching, and define the durable restart/recovery contract before implementation. Reuse owned Windows Job primitives only after adapting interactive stdin/stdout and per-tab lifetime; an ordinary one-turn provider adapter is not automatically the correct terminal authority. No public API, portability or non-Windows containment claim follows from this audit.
