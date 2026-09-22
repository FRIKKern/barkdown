# E003 — Rich-content takeover and caret fidelity

Planned editor lane, 2026-09-22, authorized by root after E002. Central profile queue remains root-owned. Same isolated Barkdown and Barkpark branches; no merge/deploy or real library mutation.

## Audit and bounded acceptance

Editor parity rows 10/11/14 cover tables, multi-block round trips and links; E002 proves plain-paragraph takeover. Its same-textblock minimal replacement does not yet prove mark-only changes preserve a selection, or edits inside a list/table preserve a caret in an unaffected sibling within that container. Current `_applyExternalContent` replaces a changed non-textblock wholesale. These are hypotheses to reproduce before behavior changes.

Exercise marked/link text, multiline text, structured lists/tables, and forward/backward selections in unchanged content. Require actual acknowledged server content and human edits to survive; keep E002 pending/IME/ownership refusal and no-extra-write rules. Fix in upstream real PM/PortableDoc if demonstrated. Extend mounted regressions first, then real isolated Paper with exact built source, motion and screenshot review. Existing save-ack:721 and press-watchdog:284 failures stay separate.

## Checkpoint

Read current matrix, plan/cycle and owner instructions. Root released bb3 compiled source after combined takeover passed8/8; its later status capture failed health recovery with code-reloader/Mix-lock warnings and stopped. Source/build changes now allowed in own upstream worktree. No new code or tests yet. Next: reproduce mark-only selection and unaffected list/table descendant selection against bb3 baseline, retain failure output, then choose smallest verified correction.

## Mounted reproduction and correction checkpoint

At unchanged upstream bb3bd299d, four of five mounted cases failed: mark-only and href-only updates collapsed selection, as did edits to another list item or table cell. A multiline edit in another paragraph passed. Failure output is retained in app/test-results/E003-baseline.log and will be copied into durable evidence at closeout.

The uncommitted correction uses mark operations for identical inline content with changed formatting and recursively maps unchanged list/table structure. It retains the existing replacement path for structural shape/type or identified list-item changes. All five regressions now pass, including exact rich projection, direction, next human replacement and one acknowledged batch. E002 mounted takeover, list-lossless, cross-source echo and 37 table/control interactions pass. Full upstream suite and private live run JV9jdZ are running; no live passing claim yet.

Own generated and served bundle now match SHA1 6850a97eb9a7af6b9e0af9513c239ee4be19398d; root warned not to consume this uncommitted source for stable captures. E003 harness and fingerprint/coverage additions are uncommitted. Two E002 README files are normalized from Windows code-page punctuation to UTF-8; no evidence image, manifest or review hash changed.

## Live table conversion failure

JV9jdZ stopped after a publish-wall rejection caused by short fixture rationales; corrected metadata. hg2wev then started normally and passed marks/link/list, but the table was deleted. Diagnosis: existing markdownToDoc produces a table, while pmDocToBlocks silently omitted it; agent-edits converted the empty result to remove-block. Failure screenshot/manifest retained under visual/rich-takeover/before-fix/table-conversion; source was dirty diagnostic, not approval. Runtime stopped cleanly.

Root approved narrow table conversion and fail-closed unsupported/mixed content. Implemented table head/rows rich inline conversion, readable table headers/values/escaped pipes, rejection of unknown blocks/inline nodes/marks, malformed/spanning/mixed-header cells and unsupported nested list/quote/cell content. Converter tests preserve mixed paragraph/table/paragraph input and assert zero production API calls for unsupported mixed input in append/replace/replace_block. A valid table emits replace-block. Private diagnostic OxJ3ko and full app suite now running; all source remains uncommitted.

## Passing diagnostic checkpoint

OxJ3ko passed all five original server scenarios (marks, link, list, table, multiline words) and stopped cleanly. It loaded before the hardbreak correction: its final server block still joined lines with spaces. The strengthened exact-source final run must prove an actual newline; this diagnostic is not hardbreak proof. The full app suite passed, including desktop76, direct-edit UI, history and side-chat parity. Final agent and PortableDoc conversion tests also passed after explicit hardbreak support. Upstream mounted rich coverage is now6/6 including nested marks and native Undo restoring human-selected text without undoing external content. Full upstream test reaches unchanged save-ack:721 as before.

Next: source commit in both repos, then exact-source real capture, deterministic comparison/review, final root verify and evidence commit. Current source/evidence changes remain uncommitted until that checkpoint; no runtime remains active.
