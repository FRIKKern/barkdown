# E011 original evidence import

Imported from `d9d36c1` onto integration base `22ef23b`, without production changes or new execution. Native galleries retain `cefe312`; final deterministic and standard status retain `cc17fca`. These are original lane passes, not combined-source approval.

[Original handoff](../../cycles/E011-fallback-consumption.md), [native galleries](README.md), deterministic run (`docs/visual/runs/2026-09-22T05-31-59-959Z/README.md`, kept in git history), [immutable review](../reviews/approval-09aa9a14923fcad33fcb21202a3134dc890425528a8787d15be921eb111791a7.json), [archived live status](../../images/status/history/E011-cc17fca.json), [live review](../../images/status/history/E011-cc17fca.review.json).

Verification used committed source blobs and staged destination blobs, rather than working-tree line endings. All 755 selected originals match exactly: 130 imported, 625 already identical, zero conflicting historical files. All 53 review-bound hashes and 392 deterministic artifact hashes pass. Eleven deterministic runs retain the complete recursive comparison baseline chain. Imported Markdown links resolve. [Machine-readable verification](import-verification.json) records paths, hashes and preserved pointers.

Current global approved/pending pointers, status manifest, root README and active cycle JSON remain byte-identical to the base. C008 receives only an evidence note; coverage gains the dedicated gallery. No original review was rewritten or restamped.

The coordinator independently inspected old-server stills03/05 and new-server stills02/06. They support the bounded content/Undo/reload proof. In narrow06 the save caption is offscreen/not visible in the right pane; only Editing live metadata is visible. This records caption absence only; its cause is clarified in the addendum below. The original reviews are preserved unchanged. Neither these galleries nor the deterministic tour prove all PortableDoc operations, unfinished-upload restart recovery, upstream merge readiness or P1 completion.

No UI/runtime was launched for this import. `npm run plan` and `npm run cycle` pass; current combined behavior/visual/root gates remain the coordinator's separate task.

`git diff --cached --check` reports one original trailing blank line in the deterministic run README (line436). That historical file is retained byte-for-byte rather than edited during import.

## Caption observation correction

Subsequent source inspection found that `paper.js` deliberately clears `#save-state` after a fresh server load (line331 in the reviewed source). Narrow06 follows reload05 without another write, and wide05 also lacks the caption. The observed absence therefore does not demonstrate narrow clipping or establish a usability defect. No CSS change is warranted by these images. Original screenshots and reviews remain unchanged.
