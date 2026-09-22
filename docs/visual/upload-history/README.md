# Image upload history

E010 preserves a completed upload when native Undo temporarily removes its image. [Cycle handoff](../../cycles/E010-upload-history.md).

[Baseline](before-fix/chromium.json) uses trusted headless ClipboardItem and keyboard input, with a delayed injected uploader. Undo before completion followed by Redo restores a permanent pending placeholder. Completion after the normal history grouping interval also becomes a separate history action before the fix.

[Corrected headless review](runs/2026-09-22T04-16-50-774Z/review.json) binds exact artifacts/source. Both final images were inspected; the image renders after Redo and one Undo removes it. This is not actual server upload/reload evidence or the app visual baseline. Those checks remain pending.

Production source54579debe and nine mounted regressions are in isolated codex/canvas-upload-history. E009 remains independently frozen and has priority for its live window. No merge/deployment.
