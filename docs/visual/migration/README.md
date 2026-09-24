# Migrated Paper: 21 cases verified

Source `d92898f` / private Barkpark `30c007e43`. [Manifest](runs/2026-09-24T00-08-01-504Z/manifest.json) records the served editor hash, 21 native typing/save/Undo pairs and a deep nested child edit, native paragraph, marked-heading and list Shift+Enter and Undo, reload and Electron restart. Source, backup and workspace bytes remain unchanged. The rehearsal checks the served bundle against the selected source artifact.

![Migrated source](runs/2026-09-24T00-08-01-504Z/01-staged-original.png)

![Native editing and saved Undo](runs/2026-09-24T00-08-01-504Z/editing-and-undo.gif)

The GIF derives from the full [Electron recording](runs/2026-09-24T00-08-01-504Z/editing-and-undo.webm) at 2 fps, 840×540, without masking or cropping. [Restart recording](runs/2026-09-24T00-08-01-504Z/restart.webm), [narrow view](runs/2026-09-24T00-08-01-504Z/04-narrow.png), [native inserted break](runs/2026-09-24T00-08-01-504Z/native-break-inserted.png). [Named review](runs/2026-09-24T00-08-01-504Z/motion-review.json) covers 31 stills, 96 video samples, all 96 decoded GIF frames and eight restart samples.

## Retained failures and limits

The [original native-input trace](runs/2026-09-23T21-20-49-208Z/failure-state.json) showed newline text becoming a rejected ProseMirror hardBreak. Upstream now serializes it as LF text, retaining original carriers on Undo. Inline CR carriers remain refused.

The [first corrected-source rehearsal](runs/2026-09-23T22-29-49-100Z/manifest.json) still served stale compiled assets and failed; it is not passing evidence. Refreshing this private worktree's built editor artifact produced the [first ten-case pass](runs/2026-09-23T22-32-55-161Z/manifest.json). The C046 ten-case checkpoint added the hash tripwire and native Shift+Enter proof. C047 adds heading formatting/alignment, literal marked LF and marked-heading line insertion. Earlier code-language, title-clipping and nine-case runs remain immutable history.

No media/internal-reference migration, navigation authority switch, legacy-history conversion, real-library migration or power-loss durability is established. [C048](../../cycles/C048-quotes-nested-lists.md) tracks current closeout; [migration contract](../../migration/README.md) owns wider P2 gates.

C047 retained assertion failures: [literal LF segmentation](runs/2026-09-23T23-07-55-168Z/manifest.json) and [new heading-break marks](runs/2026-09-23T23-14-15-739Z/manifest.json). Both preserved existing text/marks; expectations now reflect native carrier splitting and unmarked new breaks while retaining exact saved Undo requirements. [First sixteen-case pass](runs/2026-09-23T23-10-28-832Z/manifest.json) precedes the final rendered-style and marked-heading Shift+Enter checks.

C048 adds genuine rich quotes, recursive mixed list markers and checked state. [Full list break](runs/2026-09-24T00-08-01-504Z/native-list-break-inserted.png) and [narrow nesting](runs/2026-09-24T00-08-01-504Z/04-narrow-nested-lists.png) close the first pass’s viewport coverage gap. Retained failures: [task-list boundary omission](runs/2026-09-23T23-44-05-666Z/manifest.json) and [multiline DOM locator](runs/2026-09-23T23-52-41-023Z/manifest.json). The [first 21-case pass](runs/2026-09-23T23-55-19-987Z/motion-review.json) remains valid behavioral evidence with its stated visual limits.
