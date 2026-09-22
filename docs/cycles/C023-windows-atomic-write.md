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

## Active cycle after C020 closure

C020 evidence1367b37 is pushed and its completed JSON archived. Parent authorized bounded retry implementation after failure-first tests. Current synchronous APIs require a small explicit retry cap; no indefinite main-thread waits. Audit confirms bound store writeJson currently has no per-target lease; goal journal has a lifetime nonce lease but no per-write revalidation. New work must preserve those boundaries and refuse changed target/candidate/ownership. UI released to C022, no owned process; headless tests only until source freeze and renewed grant.

Failure-first adapter tests:2/2 fail as intended on1367b37, retained retry/failure-first.log. Actual Windows read descriptors cause EPERM; fixture closes known reader only after real refusal, then existing single-rename code still throws. Workspace8Jk8xX and journal0jBkvN retain prior authority and prepared temp. No production edits at this checkpoint. Proposed narrow helper retries only prepared rename, Windows EPERM/EBUSY, at most5 attempts and100ms cumulative waits, guards target identity/hash, candidate identity/hash and lease. Per-call managed-store lease added only for writeJson; registry/adoption publication unchanged. Goal lifetime lease gains ownership check. Explicit acknowledgement remains after successful rename; persistent/changed/uncertain writes fail closed.

Implementation checkpoint: managed store.writeJson and goal journal now use one prepared candidate under owned lease, expected target identity/hash and candidate identity/hash revalidation before each attempt. Journal additionally compares prior acknowledged bytes across calls. Only Windows EPERM/EBUSY renames retry; at most5 attempts,100ms cumulative sleep and120ms elapsed check before further waits. Filesystem calls themselves have no wall-time bound. Registry/adoption publication and legacy store remain unchanged. No arbitrary orphan adoption.

20 focused tests pass, including independent worker reader release while synchronous caller waits, persistent reader, target/candidate/lease mutation, same-byte replacement, new target, no retry for EACCES, fsync failure and injected ambiguous post-rename error. The latter leaves disk committed but journal memory unacknowledged and prevents replay; it is distinguished from pre-rename refusal. Initial implementation guard failed because Windows lstat dev=0 differs from fstat volume serial; corrected comparison keeps path/handle inode+metadata and handle volume identity. No broad sharing-flag claim. Failure-first and passing logs retained as text under windows-rename/retry.

Headless broader56162 passes68/68 goal checks including native review/summary deaths.79378 passes24 profile registry checks, file lease, workspace repository, profile service and IPC suites. No owned process/UI/runtime remains. Source uncommitted; next self-review, source freeze, parent queue request for full desktop and fresh visual/live/root gates. C023 remains active.

Source33c70c8 pushed. Added two actual headless host-death checks for the newly introduced write-lease boundary before requesting final gates: kill after candidate fsync but before rename, reopen exact old authority, recover stale PID lease, issue distinct explicit new write, retain orphan candidate. Workspace8ACyTR and journalUyacop pass;22/22 focused checks. This closes the new per-call-lease interruption concern without another runtime change. No owned process remains. Freeze test addition before UI grant; source33c70c8 runtime unchanged.
