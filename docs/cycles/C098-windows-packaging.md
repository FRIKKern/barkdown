# C098 — Windows packaging

[Resource review](evidence/C098/pty-resources-review.md); [baseline harness](evidence/C098/baseline-review.md); [guest availability](evidence/C098/guest-review.md).

PR75 is merged at7d7cb2bf. Owner order remains Windows installation (P5), then data safety (P2/P3). PR76 is draft; separate approval request c2d125ca is unanswered, do not repeat or merge. Authorized work ends9 October06:38:48UTC; old heartbeat paused. No Mac export.

Current checkpoint: carried ExPTY caller/resource review from4668cfa0. Native runs30274ms/32052ms prove three natural child exits, wrapper stops and normal owned-host cleanup. Final live BEAM retains401 handles/106 threads versus317/100 baseline. CPU samples vary; exhaustive allocation attribution and sustained spinning are unproven. Independent247ms review compares25 frozen source entries,32 unchanged owners and nine pinned read-only inputs. No native repair or Studio enablement. Budget ceiling estimated60minutes; stopping at reviewed evidence.

Root verification passes58110ms; applicability passes9112ms. All536app/6067source-package/32owners/EXE-ASAR/reviewed Windows8f45 bytes remain exact. Existing full Desktop821.003seconds/88commands/five skips and real Paper/reader/terminal proof keep their original source/time. Studio uses ExPTY dynamically; Barkdown's node-pty terminal is distinct. Read the resource review for source findings, source-copy and PID/counter receipts.

Next: Isolated Windows native teardown design/prototype in an owned source/build fixture: coordinate reader/writer cancellation/joins, process/pipe/pseudoconsole/wait/PID lifetime and one three-element exit callback; prove natural exit/kill/wrapper death/spawn failure and repeated resource return before runtime adoption. Preserve sibling/accepted package; installer waits for PR76 integration, then item2.

External gates: Hosted36 exact4668cfa0 Desktop37841496305/Verify37841496278 refused before steps for account billing; owner Billing & plans action, no retry/account changes. Earlier launcher06 timeout and upstream matrix remain unresolved. Hyper-V management denies this session; actual clean-machine proof needs a permitted disposable Windows environment. No feature/service/credential/account/guest operation or real profile/library mutation.

Acceptance: A2/A3/A5, complete notices/minimum/ABI/dynamic closure, ExPTY lifecycle, WinPTY/ARM64/fixed80columnTUI and real-library/Mac transfer remain open. Migration effort reviewed unchanged495/(495+156), about75%, scenarios46/156/980, low confidence. This P5 evidence adds no accepted migration scope.

Clutter: main plus one delivery lane;46worktrees/43locked are retained in the refreshed closeout inventory. Owner reviews unique/dirty/locked history at integration. Private/native failures and fresh fixture/test outputs retained; no destructive cleanup. Pinned944a sibling and five unrelated Barkpark untracked entries remain unchanged; Gitpark untouched. Indexed265rawfiles/464261bytes/32owners pass. Final staged evidence and private .git/c098-pty-resources-delivery-01.json retain publication readback.
