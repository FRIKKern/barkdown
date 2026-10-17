# Cache settlement preparation

A private test wrapper keeps a real S3 cache download counted until its local
write finishes, refuses a new cold fill while closing, and retains an interrupted
download as pending across coordinator restart. This narrows the repair mechanism
for the [published HTTP gap](../http-cache-01/README.md). No production source or
runtime is changed.

The [candidate fixture](candidate-fixture.exs) wraps the actual compiled
`S3.ensure_local` with the existing `checkout_effect` API. An owned loopback
server delays the object response. Admission reports open/one writer/one pending,
then closing with the same counts; a new cold fill refuses before creating its
parent directory. After releasing the response, exact cache bytes appear and
the hold becomes held/zero. A separate writer is killed during another real
download: pending remains one, phase becomes recovery_required, and the same
state survives coordinator restart. No recovery API is called.

The prototype deliberately retains every returned error as uncertain. A bucket
404 therefore puts it into recovery even though that is an ordinary storage
outcome. This conservative policy is **not ready for production adoption**.
[Candidate result](candidate-result.json): three observations, 334ms body and
1,818ms VM; three object requests plus two local release controls.

The separate [failure calibration](failure-contracts-result.json) shows why a
bare error tuple is insufficient to classify physical effects. A real bucket
404 returns `not_found` after creating a previously absent cache parent during
held/zero state. A successful download into a deliberately conflicting Windows
directory returns `storage_unavailable` with `eisdir`, removes its temporary
file, and preserves the directory marker. Three observations, 246ms body and
1,563ms VM; two object requests. These are direct helper calls, distinct from
the earlier end-to-end HTTP proof.

[Author review](review.json) compares all 6,193 retained runtime files, ten
source/test owners and all four loaded module hashes per probe. It rehashes
originals, the collision marker and completed cache; no partial files or owned
VMs remain. All 205 entry files stay exact. Original journals and synthetic
files remain private and recoverable. Selected logs contain only synthetic
paths/status; readable copies and exact base64 bytes are retained here.

The [repair boundary](repair-boundary.json) remains a proposal. A source repair
still needs known-settled versus uncertain outcomes, pending-delete address
exclusion, appropriate database-lock duration, native identity and interruption
proof, ordinary storage/HTTP error contracts, and the remaining rendition/native
callers. Reusing `LocalWrite` would hold a media-table lock through network I/O;
using `Door.admit` alone would settle controlled errors without physical-effect
tracking. Neither shortcut is accepted by these experiments.

Frozen source PR23205, app, runtime pin, dependencies and captures are unchanged.
Task-0571ac0327eced87 stays open with all criteria unmet. There is no complete
writer census, source repair, HTTP adoption, real account/library, installer
execution, merge, deployment or A2/A3/A5 acceptance.
