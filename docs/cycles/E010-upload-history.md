# E010 — Image uploads survive native Undo and Redo

Isolated editor audit from E0093495. Frozen E00925cb114/3495 remains separate and still awaits actual Paper proof. No foreground Electron or private runtime is active.

## Reproduced failure

Real mounted canvas fails: paste image with a delayed injected uploader, Undo before completion, resolve upload, then Redo. The image returns with no src and uploading:true; there is no request left to settle it. The original human paragraph survives. Control completion-before-Undo/Redo retains the asset. Upstream baseline b4dd07791 commits the failing assertion; [mounted output](../visual/upload-history/before-fix/mounted-failure.txt) retains the result.

[Trusted headless Chromium](../visual/upload-history/before-fix/chromium.json) uses ClipboardItem with valid PNG and actual Ctrl+V/Ctrl+Z/Ctrl+Shift+Z. It confirms the pending placeholder after completion during absence. This uses an injected delayed uploader, not a real server upload. Both actual stills were inspected; the broken case visibly says Uploading, while the control renders the green image. A first harness attempt did not wait for focus and timed out; the valid run explicitly clicks the editor before pasting.

## Approved bounded contract

Root approved preserving upload completion across history without duplicate network requests. Retain Undo removal, restore the same acknowledged asset on Redo, preserve later human edits/selection and failure recovery. Cover redo before/after completion, repeated history, rejection/late callbacks, deleted/replaced nodes and unrelated upload identities. Only this isolated branch may change; no shared task database, merge or deployment.

Next: implement upload-result ownership/history reconciliation, add targeted mounted/headless cases, then request actual server evidence after E009. No production fix yet. Locked root/app/upstream installs passed; existing app2high/upstream3moderate1high audit remains unchanged.

## Source and targeted checkpoint

Upstream54579debe is pushed. Upload receipts retain only per-editor settled metadata and never restart a request; async settlement is outside native history. Nine mounted cases cover all event orders, repeated history, rejection, untouched human text/caret, manual URL/alt, explicit clear and return-to-original, input not yet debounced, independent upload identities and disposal/remount. Intent flags stay transient and do not serialize into PortableDoc. Existing image conversion and node-view flush checks passed.

Root review exposed URL-clear/alt-return overwrites in the first fix; [failure retained](../visual/upload-history/diagnostics/human-intent-failure.txt). The corrected source retains explicit field intent in native history and flushes island input before repaint. [Final trusted headless evidence](../visual/upload-history/runs/2026-09-22T04-16-50-774Z/review.json) was inspected. Both event orders render the acknowledged image after Redo and one Undo removes the pasted image; no duplicate upload is issued.

Full54103 passed, but started at508b before the field-intent correction; it is historical semantic validation, not an exact final source gate. Exact frozen54579 full run19587 is pending. Source-generated JS is rebuilt; no server build or live runtime was started. E009 still owns the next actual editor slot. Next: finish frozen test, prepare actual Paper upload/history proof in this branch, await named UI grant. No live data durability claim yet.

## Frozen offline gates

Exact clean54579 full upstream npm test19587 passed ([log](../visual/upload-history/diagnostics/full-54579.txt)). Isolated forced server compile59464 passed ([log](../visual/upload-history/diagnostics/compile-54579.txt)); generated editor JS/CSS were copied into this own compiled served tree, not a shared checkout. Actual fixture88358f9 is committed and syntactically checked. No live runtime or foreground UI was started. Next action is the named actual Paper window after E009; then deterministic and live-status review plus final verification.
