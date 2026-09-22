# C021 — Native process preflight before rollback

Isolated branch codex/rollback-native-preflight-12h from integration b083c60. C008 remains coordinator-owned. C018 source/evidence closed on its original branch at25cb99e; no original evidence is replaced.

## Audit and bounded contract

Coordinator audit e13b0ac retained a real three-process tree in a shell-only adopted profile. Native verification was false; rollback advanced to rolling-back then Windows rename returned EPERM with all PIDs alive. No successful retirement or data loss was demonstrated. Owned stop verified all PIDs absent. C021 must refuse before that phase write, not treat OS rename denial as a process contract.

Read every registered profile, including those without a local database. The native goal-processes directory owns ordinary-chat, goal and terminal launch/receipt pairs. workspace ownership attempts are reserved before provider dispatch; terminal-sessions retains a session reservation before launch and a narrowly positive not-dispatched classification on pre-spawn failure. Unknown/missing/corrupt/foreign ownership is not a stopped process. Native verification is read-only and must not create missing directories or overwrite evidence. Existing authority lease and database cold checks remain required; no unknown process is stopped.

## Acceptance

- Actual Windows worker/child/grandchild rejects rollback while active, leaving journal bytes, authority and source intact.
- Explicit owned stop and abrupt host/supervisor death can establish native proof, then rollback retains edited authority and originals.
- Launch-only, receipt-only, corrupt/foreign/symlink evidence and uncertain terminal/workspace reservations refuse without phase change. Positive terminal not-dispatched permits only its exact identity when no contradictory receipt exists.
- Lease loss or evidence change during asynchronous verification refuses publication.
- Existing adoption/recovery/native tests remain gates. Implementation commit precedes final visual/live evidence and root verify; no Electron until named coordinator grant.

Dependencies: npm ci root0 vulnerabilities, app2 existing high; Chromium installed. No upgrades. Implementation pending.

## Implementation checkpoint

Additive profile-native-preflight.js reads bound store ownership without creating missing directories, validates every process launch/receipt identity and terminal owner filename, checks unfinished workspace reservations, and rechecks source hashes/directory inventories plus authority ownership after asynchronous native verification. Completed workspace attempts retain existing driverFinished proof; every remaining native record is still independently verified. Goals without a workspace reservation cannot have reached adapter dispatch under the existing goal-service contract. Terminal not-dispatched exemption applies only to its exact identity with no contradictory receipt; ambiguous launches refuse.

Rollback checks every registered profile before the rolling-back phase write, including profiles without local runtimes. Registry bytes and all preflight inventories must remain unchanged through cold database checks. Existing leases/database guards are preserved. No automatic stop or recovery-record mutation is performed by preflight.

Tests: 19 focused native/terminal/preflight checks passed; complete legacy-authority-adoption suite passed including16 actual process exits, retained ftTogI. Actual native normal-stop sbOfob and supervisor-crash LxZZZL each proved live three-process refusal before phase change in a second no-runtime profile, followed by verified retained rollback and unchanged originals. All owned jobs stopped. Earlier equivalent XZCrlI/4za3j6 proof retained. Source still uncommitted; new actual Electron refusal/retry fixture is syntax-checked but awaits coordinator UI grant. A test insertion helper failed its marker lookup without changing source; corrected with explicit append, not a product-test failure.

Final focused five groups passed at current source, including matching never-dispatched launch versus uncertain launch-only and workspace identity collision. Actual roots RUhWcc and Kw7d66 retained; all owned jobs stopped. Source diff/cycle checks pass. Implementation is ready for source checkpoint; actual Electron and visual/live evidence remain pending.

Source checkpoint cb2a3ef pushed; comparator correction e380385 imported as c8dd3c1 and its named-step regression tests passed. Native proof manifests now record exact Git source and app dirty status rather than a working-source label. A rare older terminal launch-only reservation whose latest tab ledger was subsequently replaced remains conservatively blocked: without retained positive classification the helper cannot infer never-dispatched. No automatic evidence deletion or override is provided. Coordinator notified; no producer behavior broadened. UI fixture remains queued.

Source-bound final Node proof at clean054e5f1 passed all5groups, retained gmPA8n/uytex3 with all processes stopped. Reports copied under docs/cycles/evidence/C021-native; app build passed. Waiting named UI grant for actual rollback refusal/retry; no owned processes remain. Product source unchanged after cb2a3ef.
