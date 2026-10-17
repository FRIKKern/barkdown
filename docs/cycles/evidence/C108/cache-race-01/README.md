# A prepared address refuses the delayed cache fill

The receive-first private candidate refuses a cache write when SQL preparation
claims its address during network receive. The native-observed synthetic
original, media row and prepared intent remain unchanged; no partial file or
recovery state appears. [Three observations](result.json) pass on Windows:
1,477ms body, 3,651ms VM, 56,275ms including owned backend/PostgreSQL lifecycle.

The [fixture](fixture.exs) starts a cache miss with its object response delayed.
Only then does the [producer](producer.mjs) allocate a synthetic original at that
key, capture its actual Windows identity/hash and build the strict request.
The fixture inserts its matching media row and calls the existing
`public.prepare_media_delete_v1` function. Its prepared intent commits while
the cache request is still waiting. No raw operations row is fabricated.

After releasing the response, actual `LocalWrite` refuses before the derived
candidate enters its physical closure. The returned error is
`storage_unavailable`; admission settles open/zero because the refusal precedes
the effect. The fixture compares the full row and intent and rehashes the
original. An independent [post-shutdown native observation](post-shutdown-observation.json)
confirms the same readable file identity and bytes. No `.part` file remains.

This is a lower-level SQL preparation race. The public
`Media.commit_pending_delete` operation rejects non-local backends; this proof
adds no S3 deletion support, logical deletion or physical cleanup authority.
The separately named candidate and explicit test seam remain distinct from the
unchanged production source and release. Its source [license](SOURCE-LICENSE.txt)
and [derivation](derivation.json) are retained.

[Author review](review.json) verifies all 6,193 release files, four selected
original BEAM files, four source owners, candidate bytes and all 205 entry files.
One object request and two fixture controls occur. Owned host/VM/PostgreSQL are
stopped; originals, databases and journals remain private and recoverable.
Private configuration and host logs are excluded; selected VM warnings/status
are retained as readable text and exact base64 bytes.

Connection/owner loss across the receive-to-write transition, actual SVG503
propagation, aliases/native identity at cleanup, native children and remaining
cache/rendition callers still need proof. No frozen PR23205/source/app/pin change,
production repair/adoption, real library/account, recovery API, cleanup, merge,
deployment or A2/A3/A5 acceptance is established. Task-0571ac0327eced87 stays0/4.
