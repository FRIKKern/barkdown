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

## Actual Paper checkpoint

E009 closed1a9faf3 before this exclusive window. First3567/GZrw5Z attempt timed out on the empty static app shell because renderer/dist had not been built; [original failure](../visual/upload-history/runs/2026-09-22T05-08-54-282Z/manifest.json) is retained. App build passed, source remained0c73c7f/54579, retry56968/DeVhLc passed. Server61395/version0.2.26.3925 served exact JS c73a0f46c5402178721a9fe334a25a8a6f530d70 and CSS38197e09d17efc468a3dc875dbd59571e3aeb7c8. Native Undo before delivery, Redo, two further Undo/Redo cycles used one actual upload; later human revision9 and reload matched real server blocks. Both private runs stopped and postmaster absence was checked.

[Native review](../visual/upload-history/runs/2026-09-22T05-11-00-573Z/review.json) covers6stills,99continuous-video samples at2fps and all30decodedGIFframes. Root independently reviewed pending/Undo/Redo/narrow stills. Document Saved rev2 while Uploading remains is explicit: this is in-process history behavior, not restart recovery of unfinished uploads or durable receipt persistence. Deterministic05-12-00 all21states within tolerance; allstills/diffs/21GIFframes inspected and explicitly approved. Final live status16401/m9RRaS is running; no success claim until stopped and media reviewed.

Final status16401/m9RRaS exited0, normalstop and postmaster absence checked. Exact0c73/54579 statusserver62532/version0.2.26.3925 used realCodex afterClaude limit;5stills/all37GIFframes inspected. [Original manifest](../images/status/history/E010-0c73c7f.json) and hashreview retained. Explicit UI release sent to root for C029. Repository verify follows; no owned UI/runtime remains.

Final npm run verify5559 passed exit0 (build, links, plan/cycle, visual hashes/review and all concept/handoff checks). Ready for selective integration; combined branch gates remain separate. Root approved proceeding to E011 consumption after reviewing bounded native evidence. No upstream merge or deployment.
