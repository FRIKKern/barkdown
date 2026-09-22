# E004 - Faithful structured table edits and export

Planned editor lane on codex/editor-structured-tables, starting d5b76ef/ upstream8530a9e23. Root owns central queue; dedicated cycle record lives here. Own separate Barkdown worktree; upstream built checkout remains unchanged.

## Audit and acceptance

Real schema: api/assets/paper-editor/src/canvas/run-convert.js cellToInline/withCellAlign and __table_head_align.test.mjs store center/right alignment as a cell content-map, absent head as headerless, newline text as multiline. Unknown source metadata is retained by the canvas. Current agent Markdown editing cannot express these safely, while structured fallback only reads them.

Add revision-checked edit_table targeting stable blockId and explicit body/header cell coordinates. Preserve unrelated blocks, table/row/cell metadata and untouched rich content. Emit one patch-block, acknowledge actual server revision, reuse visible edit presentation and guarded Undo. Structured read/export returns the exact blocks at a revision; Markdown stays available only where representable, including audited uniform GFM column alignment. No invented Markdown for headerless/multiline or broad document replacement.

Prove stale reads, missing/duplicate block IDs, invalid/covered cells and invalid mixed patch input make zero writes. Real private Paper proof must exercise aligned/headerless/multiline cell edits, rich marks, unaffected human selection, subsequent human save, Undo/reload and exact structured read. Preserve E0036/6 mapping and prior data-loss evidence. Commit source before live/deterministic motion review; full app and root verification, handoff/evidence commit. No merge/deploy or real data changes.

## Checkpoint

Root/app npm ci and Playwright Chromium install passed. Existing app lock audit reports two high vulnerabilities; no dependency updates. Plan/cycle/design/acceptance/visual instructions read; central queue intentionally unchanged per root ownership. No source behavior changed yet. Next: add adapter regressions for current unsupported structured edit/export, then implement audited cell patch path. GitHub pushes paused after shared connectivity failures.

## Implementation checkpoint

Structured edit_table adapter and MCP tool use stable blockId plus read revision, emit a single patch-block carrying touched head/rows, preserve source carriers/metadata, and reuse direct-edit receipt/visible Undo. Signed-provider activity mapping includes the new tool. Explicit structured read exports exact blocks; uniformly aligned GFM tables roundtrip. Mixed alignment, metadata and headerless/multiline use structured representation. Unit, MCP and full app suite pass, including76 desktop, direct-edit UI, history and side chats.

First real diagnostic z3bMDz stopped normally after headerless edit/Undo/human-save passed and reload status wait timed out: load intentionally clears save status; harness now waits replacement canvas and exact blocks. Retained failure under visual/structured-table/before-fix. The same frame exposed actual row-header multiline display loss caused by upstream header nowrap. Own upstream CSS now scopes pre-wrap to editable header cells; generated/served CSS SHA1d5b986ece7f82dc8d83a2b2d98b7c5940bc4e5a8 matches. Mounted rich6/6 and header/alignment6/6 pass. Real geometry+narrow diagnostic qc43nN running; source uncommitted, no final proof yet.

API audit confirmed local-only documents in current agent.js, including root e877428. E004 leaves agent.js untouched; root independently owns E005 API Paper parity. New table tool reaches both existing Paper-capable MCP providers. Central profile queue unchanged; own upstream remains branch-only/no shared task tracker mutation. E003 evidence push recovered atd5b76ef.

Second diagnostic qc43nN passed headerless edit/Undo/reload/export, then actual computed row-header style remained nowrap. Correct CSS bytes were served, but the selector used reader-only .bp-paper-surface absent in Barkdown host. Runtime stopped; failure retained. Corrected selector scopes to actual bp-paper-canvas .ProseMirror .bp-table__th. Next live run must measure geometry before source commit.

Third diagnostic7ZsJf6 proved pre-wrap/line geometry and narrow long-header wrap, then actual typed Human appeared uman. Full app UI suite overlapped and Tiptap focus was RAF-deferred, so this is not yet attributed to product source. Retained failure; next run serializes own UI suite, waits actual DOM focus and records keyboard/beforeinput/selection traces. Runtime stopped cleanly.
