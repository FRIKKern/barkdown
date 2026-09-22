# Stable Paper block identities

E012 fixes a mounted failure in which Enter copied the original paragraph ID and the projected child ID was not written back into the live editor. The first paragraph and unrelated references retain their identities; the new paragraph receives the exact ID sent for saving. Subsequent edits, native history and pending split/reorder/delete cases pass the mounted regression.

[Cycle handoff](../../cycles/E012-block-identity.md) · [Failed-first output](baseline/mounted-54579.txt) · [Full upstream validation](validation/full-e7f35117f.txt).

Actual Paper evidence remains pending. The prepared fixture requires the connected server to serve exact600fd7434 editor bytes and compares the complete live snapshot against real acknowledged server blocks, including every ID. No vendored asset or pin changes are part of this cycle; the E011 fallback remains54579. A passing isolated source does not establish upstream merge readiness or combined application validation.
