# Captured writer fence — implementation contract

Implemented in C075, merged through PR38 at c6961328 with hosted20/20 parity and reviewed visuals. This is a bounded P2 writer-admission boundary, not evidence that migration can activate. A2 still requires final source/target comparison, child termination, sealed selection and rollback.

## Admission and generations

Use one profile-store-owned durable generation, separate from foreground profile IPC generations and remote Paper revisions. A captured run carries the generation through API tools, the stdio MCP environment and the owned goal-worker start message. Reconstructing a child must validate that captured value rather than read and silently adopt the latest generation.

A short cross-process admission lease validates the generation and records an operation before work begins. Mutations keep their admission through asynchronous server acknowledgement and local receipt persistence. Nested service calls reuse the same admission; they must not release it early or admit a different owner. Finish under the same lease. Capturing an untouched store is read-only; its initial identity derives from the canonical root and inode. First admission commits identity and state. Partial, unreadable, changed-root or malformed committed state refuses mutation rather than resetting ownership. This is a cooperating-process safety boundary, not protection against arbitrary deletion/replacement of all ownership evidence.

Quiescence first blocks new admission and invalidates captured tokens. Existing admitted operations may finish, while new work from the same old handle must fail. A stopped PID does not prove that its server request stopped: interrupted admissions remain unresolved evidence. No seal or selection can occur while an operation is active or unresolved. Failure after dispatch must not be relabeled as no write. Source comparison and existing create/delete journals are additional gates, not substitutes for this admission boundary.

Still required before activation: reopening after an explicitly reconciled abort must use a new generation. Old workers do not regain write authority. Native activation/rebinding belongs to the later selector implementation; this cycle must not expose an unsafe authority toggle.

## Runtime routes to cover

| Route | Required boundary |
|---|---|
| Foreground legacy documents | Create, save, restore, delete, proposal resolution and seeding; direct bound document handles must retain their generation. |
| Foreground Paper | Connection-bound ops, creation, deletion/recovery, historical proposal acceptance, upload, import, publishing and title writes. Hold admission until the async operation and owned local evidence settle. |
| API tools | Capture once with the run; creation and agent body/table edits use that admission. Validate before any remote mutation. |
| MCP | Forward the parent token before child startup; do not recapture on a later tool invocation. Read/list must not seed after quiescence. A surviving child must refuse a new mutation. |
| Goal worker | Serialize captured token on the private start pipe; reconstruct the same token and propagate it to its own MCP child. |
| Workspace and attachments | Foreground save/commands, background run/event persistence and attachment writes remain part of migration source consistency. Their drain/preservation must be audited before claiming a complete source fence. |

The current `createConversations` service is read-only. Background writes are in `workspace-repository` through `profile-service`, not in the conversations reader. Existing foreground IPC drain protects only handlers; external file tools and an older uninstrumented binary are not server-side fencing. Child teardown and managed-runtime isolation remain required before activation.

## Proof before accepting the slice

- Two profiles with identical document IDs and wrong-owner tokens never cross-write.
- Pause a writer inside an actual async mutation: quiescence admits no successor and cannot seal while that writer is pending.
- A bound foreground/API handle and a real already-running stdio MCP child refuse after generation change; restart does not erase stale/uncertain ownership.
- A delayed goal-worker dispatch cannot upgrade its old generation while reconstructing its scope.
- Kill an admitted child; retained evidence blocks a claim of quiescence even after process-lease recovery.
- Malformed state, changed store roots and concurrent admission/transition never reset or mix ownership. Read-only original-history access remains available.
- Preserve normal create/edit/Undo and profile-switch behavior with targeted tests, then full desktop, current live Paper, reviewed visual evidence and hosted gates.

Use bounded synchronous metadata sections and existing complete-owner file leases/atomic-write checks. Avoid holding a global blocking lease across network waits. Do not disable current tripwires or create a second active cycle while the merge checkpoint is pending.

## Legacy profile adoption

Source ownership controls are validated against their actual root, retained byte-for-byte in backups and omitted from the destination projection. A new profile captures a distinct root identity; a snapshot is never a new authority for its original control records. Active, uncertain or quiescing sources require reconciliation before adoption. Existing closed-process and unchanged-manifest checks remain required; this compatibility projection does not turn profile adoption into note-engine cutover.

## Next cutover boundary — prepared, not implemented

C076 now connects its durable coordinator and held Paper freeze to production main/preload/renderer capture. Scoped native evidence covers raw-source/chat-draft retention, Chromium IME refusal, abrupt exit, same-record read-only restart and B switching. Reconciled abort/recovery, native dirty legacy/project-buffer and terminal preparation cases and final full/visual gates remain required. Supplied adapters in service tests do not replace those native proofs. [Current evidence](../cycles/evidence/C076/README.md).

C075 closes captured note-writer admission. The [mounted draft probe](../cycles/evidence/C075/draft-retention-probe.json) shows why that alone is insufficient: upstream b70214090 recoverySnapshot() omits an active note-label composition even after flushPendingChanges(). This is a jsdom source reproduction, not native IME or crash-recovery proof. Reproduce it with the [probe](../cycles/evidence/C075/draft-retention-probe.mjs), passing the upstream api/assets/paper-editor directory and a new output path.

The [pending-turn probe](../cycles/evidence/C075/run-drain-probe.json) separately demonstrates that writer quiescence can succeed while an ordinary turn is awaiting runtime acquisition or authentication. Both turns refuse before provider dispatch when released, and their leases eventually release; the drain result itself does not wait for that lifecycle. Reproduce from the repository root with `node docs/cycles/evidence/C075/run-drain-probe.cjs <new-output.json>`. It uses the actual profile/workspace/writer services with deferred adapters, not a live provider or OS-child test.

The complete preparation contract must order these boundaries, each with durable ownership and restart refusal on uncertainty:

1. Close new ordinary turns and goal scheduling for the captured profile, including resolves/dispatches already awaiting authentication or runtime startup. C076 implements durable launch closure and internal ordinary/goal drains; these are not a complete preparation acknowledgment. Profile-specific goal drain preserves journal settlement before closing its lease, leaving other profiles usable. Restart must revalidate both drains.
2. Preserve human drafts before destructive navigation or restart. Bind each retained version to profile, document identity, original connection, acknowledged revision, title and local edit version. Use the live recovery projection, never canvas.blocks (the acknowledged baseline). Capture raw composing islands/source text or wait for a verified composition end without dropping text. Failed serialization or storage must stop preparation. Late acknowledgements must not replace newer typing or relabel it saved.
3. Stop owned ordinary/goal workers and await transcript completion while their old generation still admits final persistence. Use the existing complete Windows job receipt/verifyTermination boundary, not PID absence or cancel() return. Include queued starts, surviving MCP children and restart-discovered attempts. Goal journals and process receipts also mutate source state; freeze them before final comparison.
4. Close writer admission, drain tracked async operations, and reconcile every uncertain record using owned receipts and exact server/source state. A terminated child or an empty IPC queue cannot erase uncertainty. The current controller intentionally has no reopen operation; an eventual explicit reconciled abort must advance generation and never revive old handles.
5. Recompare the complete source/backup, staged notes, media and workspace identities immediately before durable sealed selection. Interruption at each seal/selector write must recover one engine plus retained drafts. Rollback must preserve post-selection edits and staged Papers; legacy editing remains until whole-corpus A2 acceptance.

Required cases include active composition, debounced node controls, invalid Markdown projection, dirty title plus body, newer typing during delayed acknowledgement, storage failure, two profiles with identical slugs, queued provider launch, surviving child/grandchild, partial receipts and interruption before/after every durable transition. These are future acceptance obligations, not claims supplied by C075.

### Implementation entry points for the next cycle

Ordinary Windows turns already use `createOwnedWorkerAgent()` in `profile-service.js`; this is the intentional alias of the goal worker adapter. Extend its existing complete-job termination proof instead of adding another process runner. A migration admission ticket must precede `resolve()` and survive runtime acquisition, authentication and dispatch. Closing the profile must prevent a pending ticket from launching, track its release, and include runs that are already completing. Keep transcript finalization writable until the owned worker and its descendants are verified stopped.

Goal admission covers `goal-service.js`'s queued `pump`, periodic `tick`, `list`-triggered tick, Start/retry commands and automatic coordinator advancement. C076 adds `GoalScheduler.drain()` to preserve settlement before closing the journal; simply calling `close()` would suppress late outcomes. Goal-service `drain(profileId)` verifies native receipts and reconciles stopped restart attempts, retains readable history and preserves other profiles. Uncertain adapter completion still waits for trusted reconciliation; neither an AbortSignal nor an elapsed timeout establishes termination. Restart reads launch closure and must repeat drain verification. The connected coordinator now joins retained drafts and writer quiescence; complete reconciliation and final acceptance remain required.

The next cycle should stop at a demonstrated profile preparation barrier: no new or delayed launch, drafts retained or preparation refused, owned descendants stopped, transcripts settled and uncertain state kept closed across restart. This is a prerequisite to selection, not permission to enable migration or retire legacy editing. Convert both probes above into regression scenarios at the affected real adapters; preserve their original observations here.
