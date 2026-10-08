# Workspace draft acknowledgement at quit

Subsequent [implementation and native proof](workspace-quit-repair.md) repair these bounded failures; original diagnostics below remain unchanged.

Review of published `7d9b4b78` found a separate unfinished shutdown boundary: chat drafts and workspace navigation are sent to persistence, but their acknowledgement does not participate in the quit result. The Paper recovery repair remains applicable to Paper words; it does not establish workspace-draft preservation.

## Retained reproduction

[Diagnostic 01](quit-workspace-01/result.json) fails both intended assertions in 4.355s. It imports the actual renderer state, debounce and quit modules, replacing only IPC with controlled delayed/refused promises. Both cases send an empty successful note result before the draft is durable. The refused case displays the existing keep-open warning after the affirmative reply.

[Diagnostic 02](quit-workspace-02/result.json) repeats those failures and adds an actual profile registry/workspace repository, failing all three assertions in 4.451s. A disposable `workspace.json` is moved to a checked sibling backup and replaced with a directory. The real store refuses with EISDIR; the renderer still sends `[]`. After the obstruction is moved aside and the original restored, readback contains `durable earlier draft`, while the renderer contains `latest unsent words`. The temporary profile and obstruction remain for diagnosis; no real profile is touched. The log records its path.

This proves a decision gap through real renderer modules and, in the third case, actual disk refusal. It does not launch Electron, execute IPC delivery, close an application, or establish an ordinary timing-based native loss. Main's current reply validator accepts an empty array, which is legitimate only when all other required workspace persistence has been established.

## Cause and smallest repair boundary

- `app/renderer/src/state.js` schedules `api.state.save(serialise())` and catches refusal with a toast. It does not expose a durable completion result.
- `app/renderer/src/ui.js` debounce flush returns no persistence promise and does nothing when no timer remains. Awaiting the existing `save.flush()` alone cannot fix the gap, including an already-in-flight write.
- `app/renderer/src/quit-settlement.js` calls that flush and sends `app.settled` regardless of the workspace result. The final current-note assertions precede this additional asynchronous boundary in a future repair, so they must be checked again afterward.
- Preparation deliberately pauses ordinary saves. Its own capture awaits `api.preparation.saveView`, then holds a fingerprint/owner/inventory assertion. A repair must use verified preparation evidence when appropriate; forcing a new normal write through closed admission would regress the clean-frozen export/quit repair. Do not treat a paused flag alone as proof that the current workspace was saved.

The next bounded outcome is: normal quit waits for the exact owned workspace view to be saved; refusal keeps the app and draft open; prepared quit reuses only matching, acknowledged capture evidence. Preserve provider-owned transcripts, composer-history draft semantics, per-chat project drafts and the existing seven Windows-only skips. Capture identity and generation, prevent stale completion from authorizing a later request, and recheck Paper proofs after workspace settlement. Define behavior for composition in chat inputs as well as Paper; inert focus loss is not a save proof.

Fast checks should cover delayed and refused writes, an already-in-flight save, late workspace mutation, ownership change, cancelled/late replies, and prepared readback/assertion mismatch alongside the existing Paper and preparation tests. A native disposable profile should type a chat draft and quit immediately, restart and read it back; a real workspace-store refusal must retain the visible draft/window, and restoration plus retry must persist it. Intercepting native dialog requests does not prove their pixels. Then finish code-area README updates, implementation commit, standard/private Paper capture and image review, root verification and hosted checks.

No application source changed in this review. Current approved visuals remain applicable. This is a repair brief with retained failures, not an acceptance pass. Merge approval, Mac transfer, real libraries, comprehensive shutdown and installer acceptance remain open. The migration estimate remains unchanged within its existing low-confidence recovery allowance.

[Root verification 26](verify-26/result.json) passes in 42.118s for this diagnostic/documentation checkpoint. The deliberately failing diagnostic is separate from the passing repository regression suite. Hosted Desktop 37627071228 and general verification 37627071238 pass on the unchanged app source 7d9b4b78.
