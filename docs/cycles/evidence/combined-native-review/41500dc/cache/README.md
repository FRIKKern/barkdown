# Independent cache media review

Source `41500dc1f282182cbbd0539193376826a3c9475b`; original manifest reports stopped. See [review.json](review.json), [original hashes](original-hashes.json), and [motion map](motion-map.json).

All four full stills and all eleven 2 fps samples across two distinct raw WebM sessions inspected.

Corrupted A cache has explicit hash-mismatch rejection and vendored-fallback provenance in wide and narrow settings. B has its own Cache-B.invalid cached-bundle provenance; B restart without cache explicitly uses vendored fallback.

Startup empty-shell frames and gray recording padding during resize are transitional recording content, not a settled product failure. No new visual blocker.

Only derived media and review records are stored here. Original captures remain separately archived. This does not refresh global visual approval.
