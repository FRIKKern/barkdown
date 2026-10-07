# Writer death before a hold — 7 October 2026

A media writer killed during ordinary open admission leaves an orphan, but its pending root is removed. Restart remains open and a later hold succeeds with zero pending writers. [Private runtime receipt](media-open-death-01/result.json): 96.470 seconds; [fail-fast runner](media-open-death-run-01/result.json): 96.769 seconds. Passing means the expected gap was demonstrated, not repaired.

## Executed boundary

This is a new disposable instance at unchanged Barkpark pin `944a57a1e`, with the same compiled build fingerprint as the prior recovery probes. A private PostgreSQL BEFORE INSERT trigger and advisory lock stop a real upload after its complete blob exists but before its media row can commit. Before killing only that owned writer, the probe verifies phase `open`, one writer and one pending root. No hold has been requested.

After death, the row remains absent and the 7,196-byte orphan retains its exact SHA-256. The distinct acknowledged 7,101-byte control retains its row, path and bytes. Admission reports `open`, zero writers, zero pending roots and zero dead writers; a later ordinary HTTP mutation is accepted.

A full runtime stop/start changes boot identity and advances generation from 1 to 2. The same orphan and control remain unchanged, but admission still reports `open` with zero counts and accepts another HTTP mutation. `holdReconciled` then reaches `held` with zero pending roots; writes correctly refuse while held. The probe never calls explicit recovery or reopening, and never deletes the orphan. It stops the owned runtime and retains the fixture.

## Interpretation and repair boundary

[Source hashes](media-open-death-source.json) bind the reviewed `handle_info(:DOWN, ...)` branch: while open it calls `release`, which removes the root when no admitted process still shares it. During closing or after holder loss, the separate branch preserves evidence and requires recovery. The existing upstream test also deliberately treats failed settlement as ordinary while open. This is consistent with the pinned admission contract, not a new regression caused by PR75.

The earlier [pre-row death during a hold](recovery-findings.md) proves a different boundary: pending evidence survives and the repaired host refuses automatic recovery. Both results can be true. Neither an empty journal nor a successful later hold establishes historical row/blob consistency. The current host guard cannot detect evidence the coordinator has already discarded.

The prepared reconciliation work therefore needs durable operation/effect evidence or a conservative inventory of owned rows and physical objects. It must test death before hold, while closing, after commit and before cleanup, plus the [Windows locked-file error](media-delete-lock-review.md). Merely applying the existing nonempty-journal guard to more callers cannot resolve this case. Unknown bytes must remain preserved; a successful hold must not be presented as library reconciliation.

No full export or workspace deletion, S3, remote event, rendition, real-library or Mac-transfer proof is claimed. No app, upstream, dependency or capture input changed. The [reviewed app visuals](review-navigation.json) remain applicable. This measured case narrows an already named open-admission/media uncertainty; the conservative 495 completed / 156 working remaining effort weights stay unchanged, with low confidence. P2/A2 and comprehensive reconciliation remain unaccepted.
