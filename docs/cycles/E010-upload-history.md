# E010 — Image uploads survive native Undo and Redo

Isolated editor audit from E0093495. Frozen E00925cb114/3495 remains separate and still awaits actual Paper proof. No foreground Electron or private runtime is active.

## Reproduced failure

Real mounted canvas fails: paste image with a delayed injected uploader, Undo before completion, resolve upload, then Redo. The image returns with no src and uploading:true; there is no request left to settle it. The original human paragraph survives. Control completion-before-Undo/Redo retains the asset. Upstream baseline b4dd07791 commits the failing assertion; [mounted output](../visual/upload-history/before-fix/mounted-failure.txt) retains the result.

[Trusted headless Chromium](../visual/upload-history/before-fix/chromium.json) uses ClipboardItem with valid PNG and actual Ctrl+V/Ctrl+Z/Ctrl+Shift+Z. It confirms the pending placeholder after completion during absence. This uses an injected delayed uploader, not a real server upload. Both actual stills were inspected; the broken case visibly says Uploading, while the control renders the green image. A first harness attempt did not wait for focus and timed out; the valid run explicitly clicks the editor before pasting.

## Approved bounded contract

Root approved preserving upload completion across history without duplicate network requests. Retain Undo removal, restore the same acknowledged asset on Redo, preserve later human edits/selection and failure recovery. Cover redo before/after completion, repeated history, rejection/late callbacks, deleted/replaced nodes and unrelated upload identities. Only this isolated branch may change; no shared task database, merge or deployment.

Next: implement upload-result ownership/history reconciliation, add targeted mounted/headless cases, then request actual server evidence after E009. No production fix yet. Locked root/app/upstream installs passed; existing app2high/upstream3moderate1high audit remains unchanged.
