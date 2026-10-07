# Preserve uncertain writer recovery — 7 October 2026

Implementation `3cc67117` fixes a host-side recovery error found while PR75's coordinator repair was in CI. A migration/export journal can explain an interrupted **empty hold**; it cannot establish that every pending server writer's effects have been reconciled.

## Real failure boundary

[Initial probe](media-pre-row-01/result.json), 86.585s, runs the unchanged pinned Barkpark build `944a57a1e`. Its private database has a BEFORE INSERT trigger for one fixture filename. A separate connection holds the advisory lock that the trigger needs. The probe verifies exactly one waiting lock, the complete blob on disk and no media row before beginning the HTTP admission hold and killing only the owned upload process. This instruments timing in a disposable database; no production Media/Blobstore code is replaced.

The 7,196-byte original survives without a media row through full runtime restart. Its SHA-256 is unchanged. A separately acknowledged 7,101-byte control with a different hash retains its row and bytes. Barkpark correctly reports recovery_required with one pending root and refuses writes. The orphan and database are retained; no recovery acknowledgement or deletion is performed.

## Guard and regressions

Before this repair, `holdReconciled` and `reopenUnowned` copied the observed generation and pending count into a recovery acknowledgement. The [new regression fails against that behavior](recovery-guard-before/result.json). The repaired helpers require pending, live-writer and dead-writer counts to be explicitly zero before automatic recovery. Missing, malformed, negative or nonzero counts leave recovery closed. Explicit `admission.recover` remains available for callers that have actually reconciled effects; this change does not invent an automatic media repair.

[The real probe with both host helpers](media-pre-row-02/result.json) passes in 87.500s. After restart, startup returns `reopened: false` / `unreconciled_writes`; an attempted export hold refuses with `upstream_reconciliation_required`. The journal remains in the same generation with one pending root. [Provenance](recovery-proof-provenance.json) binds the tested uncommitted helper bytes to implementation `3cc67117`.

[32 adjacent checks](recovery-adjacent-02/result.json) pass in 1.980s: admission, migration selection, sealed comparison, profile export and portability. They retain the successful empty-journal path and prove that an uncertain interrupted export keeps its partial dump, interrupted outcome and preparation. The [first adjacent run](recovery-adjacent-01/result.json) retained a fixture failure: it omitted live/dead counts. The fixture now supplies the actual zero counts for its empty-journal case, while separate malformed-count assertions refuse recovery.

## Remaining limits

- The guard preserves a recovery stop; it does not provide an orphan inventory/reconciliation UI. A person must inspect and reconcile uncertain effects before explicit recovery. Retained bytes must not be silently deleted or treated as an acknowledged note.
- Upstream releases a dead writer's admission while the phase is open. This probe kills during closing. The new host guard only protects a runtime that reports recovery; it does not prove detection of every earlier failed upload.
- Post-commit deletion effects, S3, media processing, whole-library migration and power loss remain unproven. The previous after-row upload proof is separate and remains applicable.
- Real libraries and sibling Barkpark are untouched. No merge/deployment or actual Mac transfer occurred.

The effort estimate remains 495 completed / 156 working remaining. The discovered host gap is repaired, but the existing broad media reconciliation allowance remains; this does not warrant a new acceptance percentage.

Final implementation validation: [56 unit checks plus one existing POSIX skip](recovery-final-unit-01/result.json), [native empty-hold/switch recovery](recovery-native-01/result.json), [fresh image inspection](review-recovery.json) and [root verification](verify-09/result.json) pass. The full hosted suite passed on preceding2712dff5; the guard requires its own hosted run.

## Caller review before integration

Read at026e9866: main startup/settings runtime readiness calls reopenUnowned; comparison, migration selection and profile export use holdReconciled before their traversal, authority mutation or dump. Interrupted-export discard calls the same guard before discarding its partial folder or changing its outcome. The export runtime lease releases in finally. The ordinary capability-based reopen paths operate only after a successful hold; they do not acknowledge pending recovery. The production search found explicit admission.recover calls only inside the two guarded helpers. This is a scoped source review, not proof of every writer or all possible failures.

Known presentation/documentation limits: runtime readiness can remain available for reads while the server refuses writes; this repair adds no dedicated recovery inventory/banner. The subsequent navigation checkpoint also corrects older comments in migration-selection, profile-portable and the low-level recover method: a journal or matching generation/count does not prove arbitrary effects were reconciled. No code or capture input changed during this review; the56-check group, native recovery and reviewed3cc67117 visuals remain applicable.

## Later open-admission boundary

The [writer-death-before-hold probe](media-open-death-review.md) measures the previously separate open-phase case: orphan bytes survive while pending evidence is dropped, restart stays open and a later hold succeeds. The refusal repair above covers recorded recovery-required work; it cannot infer effects from an empty journal.
