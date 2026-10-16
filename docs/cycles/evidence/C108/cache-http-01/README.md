# Actual SVG admission refusal reaches the existing 503 response

The private receive-first cache candidate now has actual HTTP proof through the
owned Windows backend. Two fresh variants pass seven checkpoints, including
their boot checks: 48,752ms with the original controller and 48,128ms with a
private controller change. A separate ordinary-mode comparison passes two cases
in 276ms of fixture work / 5,289ms including its VM and inventory checks.

With the original controller, a held cold SVG GET returns404 despite a real
admission refusal. No object request or media directory appears. The private
controller adds only an exact `{:error, {:write_admission, reason}}` pass-through
to its existing fallback. The same request then returns503 with code
`storage_unavailable`, reason `write_admission_admission_closed` and the existing
retry hint. Rows remain unchanged and admission stays held with zero writers.
[Original response](original-controller/held-cold-response.json) ·
[Candidate response](pass-refusal/held-cold-response.json).

After reopening, a cold GET receives and caches exact SVG bytes with the sandbox
CSP and settles open/zero. A subsequent hold still permits the cached GET without
another object request. Missing and transport controls create no new cache
directories and retain the controller's existing404 policy. **Generic storage
errors are not changed to503 by this candidate.**

The [ordinary comparison](ordinary/result.json) calls original S3 and the
separately named receive-first candidate with admission disabled. Success,
cached bytes, `not_found` and `storage_unavailable` return values agree. Failed
receive creates a parent in original S3; the candidate avoids that mutation.
This comparison covers `ensure_local`, not every storage operation.

The [copied boot](actual-boot.exs) compiles private source only inside each
disposable backend VM and verifies loaded-module MD5s against compiled bytes.
The original controller is separately bound to its retained release BEAM.
[Parent preparation](preparation/derivation.json) records the earlier473 files;
the actual boot adds original-controller binding and the [actual host](actual-host.cjs)
selects that copied boot. [Author review](review.json) checks all6,193 release
files, four selected original BEAMs, eight source owners and205 entry originals.
All owned services are stopped; fixture rows, cached bytes, databases and journals
remain retained. Private host logs/configuration and hold capabilities are excluded.

Frozen source/release/app/pin/installer are unchanged. This is private integration
preparation, not a production repair or runtime adoption. Warm-cache/delete and
remaining rendition/native callers, identity reconciliation, independent source
review and owner integration remain. No real library/account, public S3 deletion,
recovery/cleanup authority, merge/deployment or A2/A3/A5 acceptance is established.
Task-0571ac0327eced87 remains0/4.
