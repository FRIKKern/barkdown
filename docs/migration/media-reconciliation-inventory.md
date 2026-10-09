# Read-only media reconciliation inventory

Prepared in C097 on 7 October 2026; **not implemented and not an available endpoint**. This specifies part of the existing A2 media-reconciliation requirement. [Current cycle](../cycle.json) still prioritizes Windows integration. The [source receipt](../cycles/evidence/C097/media-inventory-source.json) pins this bounded review to Barkpark944a57a1e and Barkdown3800c22e. No runtime or real library was scanned for this review.

The first implementation should report what rows and original bytes exist in one owned local runtime, including ambiguity. It must not delete files, repair rows, acknowledge recovery, reopen admission or certify a portable export. User-facing reconciliation and durable effect settlement require separate implementation and proof.

## What the current source provides

| Boundary | Observed source | Consequence |
|---|---|---|
| Legacy media listing | `Media.list_files` defaults and clamps to10,000, then discards the total; the legacy controller reports the returned list length. | A successful response is not a complete inventory. |
| V1 media listing | `V1.MediaController.index` provides total, limit, offset, hasMore and nextOffset, with a500-row page maximum. It applies dataset/scope/visibility filters and renders `AssetResponse`. | Pagination can enumerate that filtered metadata view; it does not expose all physical ownership. |
| Public metadata and search | `AssetResponse` exposes the published path, not `object_key` or the complete row scope. Search calls `MediaIntelligence.record`. | Do not derive physical addresses from URLs or assume GET search is write-free. |
| Raw media ownership | `MediaFile` stores id, dataset, dataset_id, workspace_id, project_id, path, object_key, MIME, size and timestamps. `ObjectKey.for_row` uses the stored key, falling back to path for a null key. | Preserve both published path and physical key. Never recompute an existing key from the current claimant order. |
| Backend and files | `Blobstore` selects local or S3 at call time. S3 uses local files as a cache; renditions stay local. `ensure_local` may populate that cache. | The first contract supports a verified local backend only. Do not call cache-populating helpers or treat local S3 cache presence as remote-object proof. |
| Host adapter | The managed lease captures profileId and connection; its data interface currently exposes dump and mediaDir. Expected admission identity is `profile-<profileId>`. The host admission view drops raw instance_id and sequence. | A new narrow trusted adapter is required. Existing lease/status interfaces alone cannot deliver or validate this inventory. Do not invent a SQL or HTTP endpoint. |

The earlier proofs explain why this must examine both rows and bytes: [pre-row and committed-delete interruption](../cycles/evidence/C097/media-delete-review.md) leave similar rowless originals; [Windows locked deletion](../cycles/evidence/C097/media-delete-lock-review.md) returns success while bytes remain; [death before a hold](../cycles/evidence/C097/media-open-death-review.md) loses pending evidence, survives restart and permits a later successful hold. [C099 actual API deletion](../cycles/evidence/C099/review.md) reproduces rowless originals through ordinary restart/unlock/retry404. [C100 actual managed API](../cycles/evidence/C100/review.md) reports zero counters after false success and while held, with the same original retained; held restart correctly fences writes but still reports zero. Counts and callback success do not identify what happened to a particular object.

## Proposed trusted read boundary

Capture the managed profile, persistent runtime instance, boot, generation, operation, pinned runtime/build identity, schema version, backend and canonical owned media root. Validate these before and after collection. Refuse manual/shared/remote connections, changed bindings, unsupported schemas and unknown or non-local backends. Capabilities remain in memory; credentials and raw library content do not enter repository evidence.

The scanner consumes an already established exclusion context; it does not acquire, recover or release admission itself. A held runtime with no active writers permits bounded observation, not historical consistency certification. A recovery-required runtime may only be inspected after a separately proven owner has established that no surviving writer or child effect can race the read. Nonzero historical pending evidence must remain intact. If stable exclusion cannot be established, return unavailable/partial observations, never a settled result. External filesystem writers remain outside admission's guarantee.

Use a narrow, read-only database adapter with a consistent snapshot over **all media_files rows in the owned database**, across every dataset/workspace/project. Record raw identity/scope, published path, stored object_key, effective key and whether fallback was used. Validate field types and enumerate deterministically, with explicit bounds and completion evidence; exceeding a bound is partial, never success. A stable keyset cursor alone is not a transaction snapshot. Do not expose arbitrary SQL to the renderer or use a dump as an undocumented live query interface.

Group every claimant by effective physical key before comparing files. Same published path with distinct stored keys is valid to observe; multiple rows claiming one physical key remain explicit ambiguity. Source documents a concurrent legacy-flat-key insertion residual, so do not assume uniqueness from the schema's `(path, dataset_id)` constraint. A null stored key uses the audited fallback but remains visible in the report.

Read the filesystem without creating, renaming, deleting, downloading or repairing media. Validate the root and each traversed entry against the owned root; refuse unsafe absolute/parent paths, symbolic links, junction/reparse escapes and unproven file identity. Detect case/normalization collisions and hard-link ambiguity on Windows rather than choosing a claimant. Use bounded streaming hashes and before/after identity/size checks; retain unreadable, locked, changed-during-read and unsupported entries as uncertainty. An implementation must prove its Windows handle/path checks against substitution races before advertising a complete observation. Read-only here excludes application/content writes; it does not promise unchanged OS access timestamps or external database logging.

Keep known derived-cache namespaces separate from originals, without declaring their contents disposable. Unknown files are unexplained, not garbage. Observe every in-scope file or state exactly which region was not inspected. Database snapshots plus admission and file identity checks do not form a cross-service atomic snapshot or power-loss guarantee.

## Proposed result and refusal semantics

Return the captured identity, scan bounds, start/end observations, row/file totals, completion status and reasons alongside these classifications:

| Classification | Permitted conclusion |
|---|---|
| One row and readable original | Bytes were observed at the effective key. Compare size; hash identifies observed bytes. Authenticity needs an independently trusted prior hash, not merely the current hash. |
| Row with absent original | The referenced physical object was not found under the verified local binding. Preserve the row. |
| Original with no row claimant | Bytes are unexplained. Interrupted upload and intended-but-unfinished deletion can produce this same state; do not infer intent or delete. |
| Conflicting claimants or filesystem aliases | Ownership is ambiguous; list the claimants without rebinding or rewriting any reference. |
| Derived cache or unknown entry | Record separately; do not count it as an original or remove it automatically. |
| Unreadable, changing or unsupported observation | Inventory is partial/unavailable with an explicit reason. Never translate failure into an empty library. |

Even an observationally complete inventory is **not reconciled**. It cannot prove missing deletion intent, original authenticity without prior evidence, asset-document consistency, rendition correctness, CDN/webhook delivery, remote storage or historical effect settlement. A future recovery decision must bind its evidence and explicit actions to the same runtime/generation and durable operation; this report grants no authority to acknowledge pending writes.

## Required proof before implementation is accepted

- Complete raw traversal beyond500 and10,000 rows, bounds exhausted, unknown schema, duplicate/missing pages and concurrent change. Public metadata must never substitute for raw scope/key ownership.
- Same published path with distinct stored keys; duplicate physical claimants across datasets; null-key fallback; absent original and unclaimed original. Preserve every original and row on refusal.
- Both interrupted histories that leave a rowless blob, plus the open-admission death case. The report must retain ambiguity even when admission counts are zero.
- Windows locked files, hard links, junctions/reparse points, case aliases, parent traversal, root replacement and file substitution during hashing. A platform limitation must refuse completeness.
- Profile/runtime/boot/generation/root/backend changes, surviving child effects and incomplete exclusion. Recovery state and operation ownership must stay unchanged.
- Verify no row/content mutation, media write, analytics event, cache population, recovery acknowledgement or admission reopening. Use owned disposable fixtures with exact before/after checks; source inspection alone does not satisfy these assertions.

Stop this preparation at the contract and source review. Implementation belongs to a subsequent bounded checkpoint after C097 integration, with current upstream instructions and ownership rechecked. No stage, effort percentage, endpoint or app capability is advanced by this document.
