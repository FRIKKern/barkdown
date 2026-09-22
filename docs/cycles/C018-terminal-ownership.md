# C018 — Terminal ownership

Active bounded Windows slice from integration87b965e, branch codex/terminal-ownership-12h. C008 remains coordinator-owned. No real user data or shared source runtime is used for initial process tests.

## Audited boundary

Existing terminal sessions use bare tab IDs, kill only the immediate shell, and remove map entries on late exits without checking identity. Profile rebind calls stopAll after authority has already changed. Terminal headings read the current chat folder even when a shell still runs in its previous cwd. Commands use pipes rather than a PTY; this milestone keeps that limitation.

## Bounded acceptance

1. Reproduce shell child/grandchild survival on stop or abrupt host exit using owned disposable PID/marker fixtures; safely clean only those recorded fixture processes.
2. Capture profile/chat/tab and opaque session identity for start/input/stop/output; collisions and stale acknowledgements cannot touch another session. Freeze actual cwd.
3. Preserve current switch-stop semantics: verified descendant drain before authority commits, or retain original authority with actionable failure. No indefinite transition; no automatic command replay. Background terminals are a separate future decision.
4. Native Windows Job containment below provider protocol stops descendants on normal close/quit and abrupt main death. Real Electron A/B same-tab and crash assertions precede completion.
5. Source commit then actual motion/visual/live regression evidence, image inspection/approval, root verify and evidence commit. No whole P1 or non-Windows containment claim.

## Implementation plan

Reuse audited goal-process native Job launcher only as low-level containment; terminal-worker implements a separate small input/output pipe protocol and never invokes providers. Gate profile selection with pre-transition cleanup and bounded failure. Await terminal drain in quit. Preserve unverified session ownership and block replacement if shutdown is uncertain. New shell launch alone does not replay commands.

Next: baseline process reproduction, then narrow backend/IPC/renderer changes and focused tests. Root API capture owns shared UI now; C015 follows; wait for explicit UI release before Electron input tests.

## Process checkpoint

Baseline actual PowerShell fixture CohCRA confirmed three descendant PIDs survive stopping the immediate shell; all recorded fixture PIDs were then cleaned and confirmed stopped. Native replacement checks pass for real A/B same-tab process trees, foreign session rejection, abrupt host exit with no continued marker writes, and uncertain-drain retry. Profile gate pre-transition failure preserves A and remains retryable. Source is uncommitted; actual Electron fixture awaits shared UI slot. Dependencies installed: root0 vulnerabilities, app2 existinghigh; no upgrades.

Fresh terminal tabs keep automatic shell creation. Restored tabs consult a durable owner/session ledger and native receipt: verified stopped shells remain stopped until explicit input/Start, uncertain shutdown blocks commands. Running same-process sessions may reattach without replay.

## Failure recovery refinement

Coordinator review found pre-host launch rejection could leave an unrecoverable in-memory reservation. The low-level launcher now labels only errors before its explicit native spawn boundary as positively not dispatched. Terminal journals record that classification and permit retry; generic errors remain uncertain. Drain retries native verification even after a rejected launch promise. Late launch after timeout immediately stops the helper without sending a shell start. Tests cover these races, shutdown admission and fresh/restored renderer behavior; existing native worker/recovery and profile IPC checks pass. Unknown/missing proof stays blocked rather than becoming a successful timeout.

Tab close awaits verified shutdown and remains open on failure. Quit stops terminal admission, awaits drains and reports an actionable keep-open error if ownership remains unresolved. Existing pipe-shell/launch-folder semantics remain (not a PTY or live cwd tracker).

## Ownership integration audit

Legacy terminal receipts now live under userData/terminal-runtime/legacy, outside the strict barkdown shell-adoption inventory. Managed terminal receipts and ledger live under the captured profile root. This avoids widening C003/C010 adoption to unclassified process files. Legacy library bytes are not moved or edited by this control-state setup. Missing/corrupt receipts refuse restart; no operator override or cross-machine process portability is claimed.

Follow-up sent to coordinator: offline authority rollback currently proves cold local runtimes but should also explicitly verify all native goal/ordinary/terminal jobs before retiring profile roots after an abrupt main exit. Dead-parent ownership alone is not native process proof, even though EOF normally drains these jobs quickly. No adoption behavior changed in C018.

Unsent terminal command drafts are retained on their owning tab (without execution); actual UI fixture includes durable B-command-draft restart checks. Existing command history/output remains session-local. The heading reports captured launch cwd; shell-internal cd does not retarget the chat folder.

Actual fixture corrections: first zOcqCX could not mount terminal because its seeded chat omitted normal events metadata; no process was launched. Second AEMJXK passed all managed A/B/crash/draft checks and stopped all4 jobs, then its final legacy echo assertion incorrectly expected LF instead of PowerShell CRLF. The screenshot shows the actual command completed. Both failure artifacts remain in their temporary roots. Corrected fixture data/newline assertion; no product failure inferred. Final source-bound recapture follows.

Coordinator review identified an async submission race: a delayed shell launch/input acknowledgement could clear a newer human draft, and repeated Enter could dispatch twice. Added a single in-flight submission guard and compare-before-clear. The focused delayed-start/input renderer regression passes while preserving the newer draft and dispatching only the captured first intent. Real Electron fixture now additionally counts an explicit append command after rapid Enter and verifies the newer typed draft survives. Source correction awaits final actual recapture.

## Source-bound evidence checkpoint

Final source `db9b2ca` is pushed. Actual Electron session32711 exited0 at disposable IV2WeT (legacy8HScwM), with all4 native jobs verified stopped and nine descendant PIDs absent. Rapid Enter wrote exactly one line while preserving the newer draft. Seven stills, all17 video samples and all41 raw recovery frames (38 encoded GIF frames) were inspected. Deterministic run2026-09-22T01-53-12-281Z has37 reviewed frames, zero pixel/geometry differences and explicit approval. [Actual evidence](../visual/terminal-ownership/README.md).

Relevant verification: 15 terminal/native checks, existing owned-worker/recovery/profile-service/run-owner/IPC regressions, final delayed-submit renderer test and final actual Electron pass. Existing76 desktop checks plus profile UI passed at0bceb40 before the final narrow submit correction; that correction has focused renderer and actual Electron proof. No claim of a full final app-suite run. Final standard Paper status and root verify remain pending. UI was released with all owned processes stopped.

Coordinator independently reproduced the offline rollback follow-up at integrationf99a05f: a live owned three-process native tree was not explicitly preflighted; rollback advanced to rolling-back then Windows rename failed EPERM while all PIDs remained alive. No successful retirement or data loss was reproduced. Owned stop subsequently verified all PIDs absent. Root retained rollback-process-audit.{cjs,json} and disposable mMs7bO. Add explicit native ownership preflight in a subsequent bounded cycle; C018 does not change adoption.

Root verify attempted after visual approval: build passed, check stopped at expected standard-status freshness mismatch (db9b2ca vs8cabf36). No subsequent checks were executed. Coordinator has final status slot request; no UI/runtime remains owned while waiting.

Final standard isolated status session79527/EhzxkR exited0 at clean source db9b2ca and clean Barkpark a5440345c; runtime stopped/postmaster absent, user CLI unchanged. Manifest records real Codex turn after Claude weekly-limit fallback. All five stills and37 GIF frames inspected; hash-bound c018-review.json records approval. Shared UI/runtime released before root combined tests.

## Bounded closeout

Root npm run verify session33433 exited0: build, source/links/fresh status, active plan/cycle, visual hashes/review and all headless concept/handoff checks passed. C018 is complete as the bounded Windows terminal milestone. Source commits78af101,0bceb40,db9b2ca; evidence commit follows. No merge/deploy or real-library mutation. Next: C021 explicit native job preflight before offline authority rollback, preserving existing cold DB and lease guards.
