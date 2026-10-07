# Current handoff

[C097 Windows return](cycles/C097-windows-return.md) remains on codex/windows-return; P2/A2 is active. Published **5d830684** contains pending-launch repair f4d3ae5d and test-only670ddbba. Full Windows Desktop775.096s, root verification31 45.687s and reviewed capture22 pass. [PR75](https://github.com/FRIKKern/barkdown/pull/75) description updated/read back; it remains draft.

**Fresh hosted checks:** [Verify37651242281](cycles/evidence/C097/hosted-verify-21.json) passes on5d830684; Desktop37651242328 remains running. [Three unchanged coordinator recovery replays](cycles/evidence/C097/coordinator-replay-review.md) pass30.579s,32.889s,33.364s with30 reviewed images. The original failure remains unexplained; no speculative retry/timeout change. Preserve failure diagnostics if hosted recovery recurs, and do not repeat these passing replays without new evidence.

**Publication:** the replay evidence and refreshed handoff are being consolidated locally; do not push while Desktop37651242328 runs. No application/test edits. Next inspect that exact hosted run, retain its outcome/diagnostics, then publish the consolidated evidence. Do not confuse local evidence HEAD with the5d830684 source being tested remotely.

**Current repair:** [pending-launch shutdown](cycles/evidence/C097/quit-admission-repair.md). Session admission closes after renderer acceptance; ordinary pending tickets drain and late identities are cancelled. Legacy dispatch rechecks after authentication.21 focused tests pass;64 adjacent cases pass(one POSIX skip); actual Electron pending Send/quit/restart passes6.389s; renderer refusal still preserves services24.610s. Seven final native images inspected. No real provider or library claim.

**Hosted failure:**5dc31fb9 Desktop37643385099 failed waiting for the coordinator crash-recovery review form. The preceding image/log are retained; the same local journey passes33.792s. Cause unconfirmed. Harness now captures journal, receipts and UI on recurrence without changing timeout/assertions.

**Local checkpoint:** Full Windows Desktop passes775.096s at test-only670ddbba, including both coordinator journeys and pending Send/quit/restart. Five existing skips remain (two POSIX process groups;three provider-runner cases needing isolated Paper). Capture22 remains applicable to production f4d3ae5d. Root verification31 passes45.687s. Repair/evidence is published; inspect fresh hosted CI before dependent work. Hosted coordinator failure cause remains unconfirmed.

[PR75](https://github.com/FRIKKern/barkdown/pull/75) stays draft. Merge approval remains pending, including [possible Mac nightly publication](cycles/evidence/C097/release-gate-09.json). No merge/deployment or shared automation changes. Backend failure recovery, real-provider/goal continuity, forced death, installation, real-library acceptance, actual Mac transfer, media reconciliation and G2 credentials remain open. No Mac export is available.

Estimate unchanged:495/(495+156), about75%,30–90%,low confidence. [Inventory23](cycles/evidence/C097/repository-closeout-23.json): main plus one delivery branch;46 Barkdown worktrees(43 locked),14 sibling worktrees(7 locked). Cleanup owner cycle maintainer, next review after integration; preserve unique work and locked evidence. Sibling checkout and pinned runtime untouched. The24-hour run ends8 October04:25:45 UTC.
