# C023: Windows atomic-write contention audit (planned)

Parent reserved C023 after C020; C022 belongs to cold adoption. C020 remains the current active cycle until its final gates close. This preparatory audit is explicitly authorized and does not change production behavior.

## Outcome and boundaries

Reproduce Windows replacement failures using actual bound-profile store and goal journal in disposable roots. Preserve exact prior authority and prepared temp bytes, prove failed writes never advance memory authority, then test explicit post-unlock writes. Distinguish controlled reproduction from the unknown origin of naturally observed failures. Do not add blind retries, adopt arbitrary temp files, delete evidence, or weaken ownership/revision checks.

## Prepared fixture

Run `node docs/goals/audits/windows-rename-contention.cjs` on Windows. It holds a separate .NET reader denying delete, then exercises an ordinary Node read handle separately. Both actual writers must retain authority when replacement fails. The reader is explicitly closed before a new write is attempted; all fixture helper processes stop.

First run0JG17d on17c2cc8: both bound workspace and goal journal produced EPERM rename under controlled .NET handle; prior hash/in-memory state remained unchanged and prepared JSON temp survived; explicit writes after reader exit passed. Unexpectedly, ordinary Node fs.openSync(file, r) also yielded EPERM for both writers. This is observed behavior in the current environment, not a statement about Windows sharing flags or the exact cause of the earlier natural failure. Fixture extended to validate prior authority and explicit post-close recovery for this second case too.

## Next investigation

Confirm the ordinary Node handle result with a minimal core-fs fixture and retained evidence. Evaluate bounded retry designs only under a stable single-writer lease and unchanged expected target revision/hash; cover a reader that persists, disappears, or a different writer changes authority. Failed or uncertain acknowledgement must never become completion or replay external effects. Production changes require a separate explicit plan and focused failure-first tests. No retry implementation is present.

Expanded actual-writer MpwUG9 passed prior-authority and explicit post-close checks for both .NET and ordinary Node reader handles. Minimal core-fs cQTyFc on Node22.13.1/libuv1.49.2/Windows10.0.26200:10/10 held-read replacements returned EPERM, old/candidate bytes unchanged; closing the descriptor allowed the same candidate rename. [Immutable evidence](../goals/evidence/windows-rename/README.md). Natural failing handle identity remains unknown. No production changes and no live reader processes remain.
