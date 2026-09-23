# C030 strict native failure — retained, not approved

Source44fb480 against Barkpark54579, private runtimezcf95g, command `node tests/status-shots-isolated.mjs tests/editor-gaps.live.mjs` with isolated source and capture enabled. Actual33428 exited1: **0/13 green**. Electron closed, wrapper stopped, postmaster absent.

[Original report](result.json), [original manifest](manifest.json), [raw video](editor-gaps.webm). Artifact hashes verified. Root inspected stills04/07/10/13; full motion has not been reviewed or approved. No global screenshot pointer changed.

Twelve rows expose newly serialized top-level block identities differing from acknowledged server identities; independent editor audit found otherwise equal full semantic snapshots. Duplicate inherited bpId remains unstamped after acknowledgement, so repeated snapshot/save can mint new c-* IDs. E012 investigates this contract; this fixture does not erase IDs to make it pass. HTML Undo/Redo failure cascades from the prior failed acknowledgement before HTML paste, not evidence that HTML history itself broke.

The ordinary blockquote Backspace assertion incorrectly expected a standalone paragraph. Current native joinBackward merges quoted text into the preceding rich paragraph; the custom standalone conversion applies to pullquote only. A subsequent source revision will assert exact rich merge and unchanged siblings. The original failed assertion and images stay intact. A successful replacement/Undo still failed the final full identity comparison.
