# Committed deletion and deferred effects — 7 October 2026

[The private Windows probe](media-delete-commit-01/result.json) passes in 87.147s at Barkdown `026e9866`, using unchanged Barkpark pin `944a57a1e`. This means the expected failure state and recovery refusal were observed; it does **not** mean orphan reconciliation is implemented.

## Executed boundary

The caller uses real `Door.admit`, `Repo.transaction`, `Media.delete_file` and `flush_deferred_media_effects`. It follows the public outer-transaction defer/flush protocol also used by `Tenancy.delete_workspace`, but does not execute the complete workspace-deletion function. No media implementation is replaced or recompiled.

An ordinary control deletion commits and flushes: its media row and original blob are absent and the process-local effect queue is empty. A second deletion pauses after commit, outside any transaction, with exactly one queued effect. An independent database connection verifies the target row is absent while the complete 7,196-byte original is still on disk. The harness begins the HTTP hold, verifies writes refuse, and kills only the admitted caller.

The deleted row remains absent and every original byte survives through full runtime restart. A separate acknowledged 7,101-byte upload keeps its row, path and distinct SHA-256. Admission retains one pending root; stale generation and wrong count refuse. The repaired startup and operation helpers both leave recovery closed. No explicit recovery or orphan deletion is performed. The owned runtime stops; fixture and evidence remain.

The probe does not establish companion asset-document, rendition, webhook or CDN outcomes. It neither configures remote endpoints nor sends external messages. It is not a real-library or full workspace-deletion acceptance test.

## Source findings and repair requirements

[Reviewed source hashes](media-delete-source.json) bind these findings to the pin. Existing upstream deletion tests were read, not rerun here.

| Boundary | Finding | Required evidence before claiming reconciliation |
|---|---|---|
| Media row / blob | `Media.delete_file` commits row/asset deletion before queuing CDN, media event, blob and rendition effects. The queue is a process dictionary entry, removed before its closures execute. The probe demonstrates loss of that queued cleanup on caller death. | Persist enough operation identity and effect state to distinguish an intended deletion from an interrupted creation. Exercise death before commit, after commit, between effects and after the final effect but before acknowledgement. |
| Physical ownership | Blobstore resolves a row's `object_key`, which may differ from its public `path` for legacy or competing claims. | Compare physical keys and all scoped claimants; a path-only orphan scan must never remove another row's bytes. Refuse ambiguous ownership. |
| Delete receipts | Local `delete` ignores `File.rm` errors; rendition cleanup likewise discards its removal result. The later [Windows locked-file probe](media-delete-lock-review.md) now demonstrates `:ok` with every original byte retained; this earlier transaction probe did not inject that error. | Prove bytes actually disappeared or retain a retryable cleanup failure. A returned `:ok` alone is not evidence of deletion. |
| Media events | `Events.dispatch` starts a task; durable delivery rows are created later inside that task. Those rows support retries once persisted. | Distinguish an event never enqueued from a persisted delivery awaiting retry. Do not replay a possibly delivered webhook merely because the media row is gone. Remote delivery remains untested. |
| Admission | The pending count identifies unfinished roots, not their intended content/media effects. Host recovery now refuses nonempty or malformed counts. | Bind any explicit acknowledgement to reviewed effects, the current generation and unchanged pending state; revalidate after restart. Do not clear pending as a substitute for reconciling it. |
| Profile export | Barkdown copies and hashes the owned media tree after acquiring the hold. It does not classify row-to-blob consistency; it can preserve unexplained bytes if the runtime was previously reopened. | Keep the recovery guard. Distinguish an integrity-preserving backup from a reconciled library; successful copy/hash checks do not resolve orphan ownership. No export was attempted in this probe. |

## Prepared next checkpoint

Before implementing an automatic repair, define a read-only reconciliation inventory bound to profile, runtime instance, generation and pinned schema. It must preserve separate categories: row with matching original, missing original, unclaimed original, conflicting physical-key claims, derived cache and unreadable/unknown entry. Retain unknown bytes and avoid traversing links outside the owned root. A destructive action requires an explicit reviewed disposition; this document does not authorize one.

An orphan alone cannot tell whether an upload was interrupted or a deletion committed. A future repair must retain that uncertainty or obtain durable operation evidence. The two C097 probes now demonstrate both histories producing a rowless blob. Broader UI, durable upstream effect recording and any cleanup implementation remain future scoped work after the current integration checkpoint.

No new app, dependency or capture inputs changed. [Reviewed visuals](review-recovery.json) from implementation `3cc67117` remain applicable. The migration estimate remains 495 completed / 156 working remaining: this replaces one source-inferred risk with measured evidence, while the existing reconciliation allowance remains open. No stage acceptance, merge or deployment follows from this result.
