# A media GET can write cache bytes during a held seal

On Windows, the real SVG HTTP route writes an absent S3 cache file while the
managed coordinator reports held with zero writers and zero pending effects.
A second request started while open also completes its cache write after a
subsequent hold reports that same empty state. [Measured result](result.json)
and [author review](review.json): six checkpoints, 48,545ms.

The probe boots the retained compiled C109 backend and fresh PostgreSQL through
the actual owned driver. A test-only [host](host.cjs) explicitly configures its
server child for S3 with fake credentials and an owned loopback object server.
This exercises real HTTP authorization, scoped row lookup, Req download,
temporary-file write, rename and SVG response. It does not prove that the
shipping packaged driver accepts S3 configuration: that driver filters inherited
S3 settings, as the earlier [environment review](../writer-boundaries-01/README.md)
records. Source-checkout configuration remains a separate mode.

The [producer](producer.mjs) inserts only synthetic rows into the fresh default
workspace/project. It asserts an absent cache, obtains the real held capability,
then fetches the SVG. HTTP 200 returns the exact 107 bytes with image/svg+xml and
a sandbox CSP. The first cache appears while both before/after coordinator
observations remain held/zero. A cached repeat returns identical bytes without
another object request.

For the in-flight case, the loopback server receives the GET but withholds its
response. The producer takes another real hold, checks that the cache is still
absent and counters are zero, then releases the response. The cache appears;
the coordinator still reports held/zero. Exactly two object requests occur.
Both rows remain byte-equivalent JSON snapshots; the independent synthetic
original and both retained cache files have the same SHA256 after shutdown.
PostgreSQL reports stopped (status 3); the review finds no owned host, backend or
orchestrator process remaining. No real library or S3 account is involved.

Two failures are retained. [Boot400](boot-failure.json) fails before API startup
because its private harness manually constructed the Windows command path.
[Scope405](scope-failure.json) boots but receives404 before any object request:
its raw rows omit tenancy while the real route selects the default scope.
The corrected fixture uses those actual default IDs; expected HTTP 200, exact
bytes, CSP, absent-cache and held-state assertions remain intact. Producers and
the failed response are retained alongside the successful producer. Runtime
inventory is compared before/after; production inputs match source fce63,
apart from its later storage README. Private databases, logs and journals remain
recoverable; credentials and hold capabilities are not published.

This is an HTTP cache-write coverage gap, not a repair or permission to clean
media. The original-blob guard in frozen PR #23205 does not cover these effects.
Task-0571ac0327eced87 remains open with all four criteria unmet. Cache admission,
in-flight settlement, interruption, other callers and ordinary storage contracts
need a separately reviewed repair before runtime adoption. App, source, runtime
pin, dependency and capture inputs remain unchanged; there is no new UI claim,
installer execution, merge, deployment or A2/A3/A5 acceptance.
