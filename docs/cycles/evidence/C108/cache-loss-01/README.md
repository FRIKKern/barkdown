# Interrupted cache writes retain their evidence

Three Windows [observations](result.json) pass: 3,244ms in the fixture, 5,752ms
for its VM and 57,046ms including the owned backend/PostgreSQL lifecycle.

- Killing the admitted download owner before local work leaves no media files
  or directories. Its coordinator restarts open with zero pending writers.
- Killing the owner after an actual partial write preserves that partial file.
  PostgreSQL releases the table lock, while admission retains one uncertain
  effect and restarts in `recovery_required`.
- Terminating the writer's own PostgreSQL connection after a partial write
  releases the lock before the writer continues. The subsequent rename still
  finishes. The operation returns `storage_unavailable`, retains the effect
  and restarts in `recovery_required`; it never reports a clean drain.

The [fixture](fixture.exs) uses a separately named [derived S3 candidate](candidate.exs)
with a test barrier after `File.write` and before rename. The actual compiled
`LocalWrite`, Repo and admission coordinator remain unchanged. Each case owns
its gate and journal. The terminated database PID is captured inside that
writer's actual transaction. No broad process search or recovery API is used.
[Derivation](derivation.json) and the original [Apache license](SOURCE-LICENSE.txt)
are retained.

Native observations before interruption and [after shutdown](post-shutdown-observations.json)
confirm the same exact bytes and NTFS file identities, including the file
renamed after connection loss. Elixir's `File.stat` reports inode zero here;
it is not used as identity proof. The [author review](review.json) checks all
6,193 release files, four selected original BEAM files, six source/test owners
and 205 retained entry originals. All owned services are stopped. Partials,
final files, private database and journals remain retained; nothing was purged.

This is process/connection interruption preparation, not a power-loss guarantee
or production repair. Actual SVG HTTP503 propagation, ordinary storage contracts,
remaining cache/rendition callers, native children and cleanup reconciliation
remain. Frozen source/app/pin/installer are unchanged; independent source review,
owner integration and runtime adoption remain separate gates. No real library,
S3 account, public S3 deletion support, cleanup authority or stage acceptance is
established. Task-0571ac0327eced87 remains0/4.
