# E012 — Stable identities after a native split

Root C030's strict native comparison at upstream54579 exposed a real identity mismatch after Enter: saved PortableDoc blocks have a newly minted ID, but the live split retains its parent's ID. Each recovery snapshot then projects another fresh ID. Full content, marks and links matched in the retained C030 failure; this is not permission to ignore identity.

This isolated editor lane starts from E011 d9d36c1 and upstream54579. It owns no central P1 queue. The upstream checkout is barkpark-block-identity on codex/canvas-block-identity; the Barkdown lane is codex/editor-block-identity. Shared and frozen source remains untouched. No runtime/UI grant is held.

Mounted failed-first reproduction uses the real Paper canvas and native splitBlock, followed by the production acknowledgement seam. The child retains origin instead of its acknowledged c-1 ID. Planned correction materializes only the identity that normalization actually replaced, preserving the original first occurrence, unrelated IDs/references, caret and native history. Regressions must cover subsequent edits, in-flight changes, Undo/Redo and complete snapshot equality. Actual server acknowledgement remains a separate required native proof.

The quote observation is separate: ordinary blockquote Backspace uses native joinBackward and appends quoted text to the previous rich paragraph. The custom conversion branch only handles pullquote. Root owns the C030 fixture and its exact expected content assertion.

Next: preserve failed-first output, correct the upstream materialization contract, run focused and full editor checks/build, then request a named native window. Do not weaken the strict C030 comparison or update vendored assets before proof.
