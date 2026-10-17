# Receive first, lock local effects

A derived test candidate settles ordinary bucket404 and transport failures
without creating media directories or entering recovery. It receives the object
under ordinary admission, then uses the unchanged `LocalWrite` physical-effect
guard and database lock for local cache effects. [Five observations](result.json)
pass on Windows: 260ms fixture body, 2,120ms VM, 51,793ms including the owned
backend/PostgreSQL bootstrap and shutdown.

This is a separately named [candidate module](candidate.exs), derived from the
exact frozen source by the retained [producer](derive.cjs). The upstream module,
release, app and pin remain unchanged. The source [Apache license](SOURCE-LICENSE.txt)
is retained; [derivation](derivation.json) records the original and changed hashes.
An explicit test barrier pauses the candidate inside the actual `LocalWrite`
closure, after its address check and table lock, before cache creation.

The [native fixture](fixture.exs) observes these boundaries:

- Bucket404 returns `not_found`; a deliberately closed transport returns
  `storage_unavailable`. No media parent/cache is created, and admission returns
  to open/zero. The normal admission journal still records its transitions.
- While the loopback object response is delayed, another actual PostgreSQL
  transaction can acquire the media-table lock with NOWAIT. Admission remains
  open/one writer/one pending, and no media directory exists.
- A concurrent hold stays closing. A new cold fill refuses before creating its
  parent. After the object response is released, the same admitted root upgrades
  to physical admission while closing. The second PostgreSQL transaction now
  receives `lock_not_available` while the local-effect barrier is paused.
- Releasing the barrier writes the exact cache bytes and settles the tickets.
  Only then does the hold become held/zero. A cached read remains usable while
  held and makes no additional object request; no partial file remains.

There are three actual object requests and one fixture release control. The
database is fresh and has no pending-delete operations. This proves lock timing,
not the reservation race: a concurrent preparation, connection loss and deaths
before/after the physical upgrade still need their own proof. Actual SVG HTTP503
propagation, other cache/rendition/native callers and identity/reconciliation are
also open. The helper/Req errors here are distinct from an HTTP controller result.

[Author review](review.json) checks all 6,193 runtime files, four selected original
BEAM files, seven source owners, derived source and retained license bytes. It
rehashes the synthetic original and cache after shutdown; all 205 entry files
stay exact. The owned host, VM and PostgreSQL are stopped (PG status3). Private
configuration, databases and journals remain recoverable; credentials, host logs
and private configuration are excluded. The selected VM status log is retained
as readable text and exact base64 bytes.

No production source repair or runtime adoption is established. Frozen PR23205,
installer and independent-reader/owner gates remain. Task-0571ac0327eced87 stays
open with all criteria unmet. No real S3 account/library, recovery API, cleanup,
merge, deployment or A2/A3/A5 acceptance is involved.
