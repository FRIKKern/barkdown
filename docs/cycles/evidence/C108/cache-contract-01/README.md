# Remote storage success and local cache refusal stay distinct

Eight direct `S3.put_file` cases pass on Windows: original/private candidate,
ordinary/managed mode and successful copy/actual directory collision. Fixture
work takes17,584ms; VM19,196ms; owned backend/PostgreSQL lifecycle70,481ms.

All eight uploads receive exact PUT/HEAD-verified remote receipts. Four local
copies succeed. Four actual Windows `File.cp` attempts return `:eisdir` against
existing directories; their markers and upload sources remain unchanged.
The top-level receipt still succeeds in those cases, preserving the existing
best-effort warm-cache contract. This does not claim the local cache was stored.

The private candidate leaves ordinary behavior unchanged. Managed successful
copies settle open/zero. For managed copy refusal, its `LocalWrite` retains
pending1/`recovery_required` even though `put_file` returns a verified remote
receipt. This conservative recovery policy is **unaccepted**, not a repaired
production contract. No recovery was invoked to clear it.

The [fixture](fixture.exs) uses actual `File.cp` results, real loopback PUT/HEAD,
Repo and admission. The two private S3 sources add a result observer; the candidate
also carries the earlier LocalWrite wrapper. Its old success barrier is unset.
[Source derivation and license](plan.json) are retained. This is direct storage
contract proof, not completed `Media.upload`, HTTP upload or the full
plugins/Content pipeline. The media-row snapshot remains unchanged.

[Author review](review.json) verifies all6,193 release files, four selected
original BEAMs, five source owners and205 entry originals. Native before/after
and [post-shutdown observations](post-shutdown-observations.json) bind all eight
source identities, four collision markers and four successful cache files.
Sources, cache files, markers, database and journals remain retained; all owned
services are stopped. Private configuration and host logs are excluded.

The [closeout preflight failure](closeout-failure.json) retains an unexpected
PowerShell module cache in the checkout. Its exact path/hash is pinned beside
the171 inherited files; all205 originals match. Its specific writer is unconfirmed.
The cache remains untracked and preserved; no ignore rule or cleanup hides it.

Frozen source/release/app/pin/installer remain unchanged. Actual Checkout/Renditions
callers, locked-child failures, native children and reconciliation still need proof.
Independent source review, policy review, owner integration and runtime adoption
remain separate. No real library/account, public S3 deletion, cleanup, merge,
deployment or A2/A3/A5 acceptance is established. Task-0571ac0327eced87 stays0/4.
