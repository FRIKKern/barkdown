# C048 — Quotes and nested lists

Starting from accepted C047 abfedf2 on codex/p2-migration. Upstream codex/paper-create-only at 2289cf270 already supports native blockquote inline content and list item maps with ordered children arrays. Audit anchors: api/assets/paper-editor/src/canvas/run-convert.js and docs/contracts/portable-doc-nested-lists.md. No upstream code change is planned unless real tests expose a defect.

Implement one-paragraph quotes and recursive lists without flattening. Preserve nested bullet/ordered/task markers, task checked state and inline marks. Refuse multiple paragraphs, arbitrary child blocks, non-default numbering, nested paragraph alignment and quote inline breaks until proved. Existing reference/media/deep-heading refusals remain. No real-library reads, migration activation, merge or deployment.

Next: implementation, hand-authored corpus/unit assertions, commit source, then native editor and interruption proof. Fresh standard live/fixture captures and actual review follow production changes. Full desktop/root validation and truth review close the cycle. No owned test process is active.

The six-hour goal remains active through at least 2026-09-24 04:17:20 UTC. Upstream list-break task criterion 0 needs native list Shift+Enter proof; other claims and integration limits are in C047.
