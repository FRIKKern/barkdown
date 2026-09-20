# Goal: the Barkpark editor is as good as Tiptap

Set 2026-09-20. This is the standing goal for editing in Barkdown until the matrix below is green and Barkdown's own Tiptap document tab has been retired.

## Why this is the goal

Barkdown is a note + agent app utilizing Barkpark. Notes are Barkpark papers; the editor is Barkpark's `<bp-paper-canvas>`; the store is a real Barkpark running locally beside the app and syncing to bp cloud. That only works if an author never notices they left the local Tiptap editor. Two editors in one app is the state to leave, not to maintain.

The canvas already *is* Tiptap: one ProseMirror document over the whole paper (StarterKit, Link, Placeholder, Typography, Underline, TaskList) with about twenty custom node types on top. So the gap is not the engine. The gap is everything around it: which blocks are editable rather than carried opaque, tables, how multi-block edits survive the ops round trip, images, and the loop that gets editor fixes from Barkpark into Barkdown. Each of those is finite and testable, which is what makes this a goal rather than a wish.

## Definition of done

Every row in the matrix is a behaviour Barkdown's Tiptap document tab ([app/renderer/src/tabs/document.js](../app/renderer/src/tabs/document.js)) already gives an author. A row is green when a live test proves the canvas does it **and the server holds the same result the canvas shows**. The test is [app/tests/editor-gaps.live.mjs](../app/tests/editor-gaps.live.mjs) and its siblings, run against the local Barkpark. The goal is met when every row is green in both repos' CI and the Tiptap tab is deleted.

"Green in the canvas but wrong on the server" is red. The continuous canvas gives multi-block editing for free; the ops diff and the echo reconciliation are where it can silently diverge, so every row checks both sides.

## The matrix

Status as of 2026-09-20. Verified rows come from the live suites (`editor.live.mjs`, `editor-code.live.mjs`, `editor-gaps.live.mjs`, `paper.live.mjs`); the rest are red until proven.

| # | Behaviour | Status |
|---|---|---|
| 1 | Typing, Enter-split, Backspace-merge across blocks; caret and selection across blocks | verified |
| 2 | Inline marks: bold, italic, strike, code, underline, link (Ctrl+K row); markdown shorthands for all of them | verified |
| 3 | Headings 1–3 by `#` shorthand and Ctrl+Shift+digit turn-into; back to text | verified |
| 4 | Bulleted, numbered and check lists; Tab / Shift+Tab nesting; `[ ]` shorthand; Backspace lifts a first item | verified |
| 5 | Quote (`> `), callout (`> [!note] `), divider (`---`), code block (fence, language, keyboard exits) | verified |
| 6 | Slash menu at top level and inside an empty list item; block gutter with drag, block menu, Ctrl+Shift+↑/↓, Ctrl+D | verified |
| 7 | Paste: plain markdown as blocks, HTML lists, URL over a selection; typed URL autolinks | verified |
| 8 | Undo / redo, including of a paste | verified in the canvas; server state after undo unverified |
| 9 | Save under `ifRev`, 412 conflict card, re-apply keeps both edits, echo writes minted ids back | verified |
| 10 | **Tables**: type in cells, Tab between cells, add and remove rows and columns, paste a markdown table, round trip to the server | **11/11** in `editor-tables.live.mjs` (2026-09-20). Started 8/11. Fixed in Barkpark (`canvas/table-node.js`, `markdown.js`, `canvas/index.js`, branch `barkdown/editor-quality`): Tab/Shift+Tab now select the target cell's content as TableKit does, Tab in the last cell adds a row and lands in it, and a pasted GFM pipe table (delimiter row with a pipe; `\|` for a literal pipe) becomes a table block. Fixed in Barkdown (`paper.js`): the tab said "Saved · rev N" when one batch acked while a later batch was still debouncing or in flight, so the server briefly held an intermediate state; it now says Saved only when the canvas has nothing pending and no newer batch was emitted |
| 11 | **Multi-block selection across ops**: Ctrl+A, copy three blocks, paste elsewhere, delete a spanning selection, undo — server matches canvas after each | red |
| 12 | **Opaque set for note content**: every block type a note can contain mounts editable; nothing an author can insert renders as a read-only `bpOpaque` chip | red (enumerate against `paper_canvas.ex` first) |
| 13 | **Images**: drop, paste and pick; lands as a figure with media on the server; resize and caption | red |
| 14 | Headings 4–6; nested checklists; link edit-in-place; placeholder text on an empty block | red |
| 15 | IME composition (dead keys, CJK) does not produce stray ops | red |
| 16 | A 500-block paper: no visible lag while typing; ops batched, not one per keystroke | red (measure against the local server) |
| 17 | Local documents open in the canvas on the local Barkpark; the Tiptap tab is gone | red |

Add rows when the Tiptap tab is found to do something not listed; never remove a row to make the matrix greener.

## Order of work

1. Row 10, tables. The Tiptap tab has GFM tables through TableKit; the canvas has `table-node.js` with cell ops. Biggest visible gap, fully testable.
2. Row 11, multi-block edits across the round trip. Cheap to write, and the most likely place for silent divergence.
3. Row 12, the opaque set. Enumerate first; the list is short for notes because run splitters are down to schema field kinds (`composite`, `object`, `arrayOf`, `codelist`, `localizedText`) that never appear in a note.
4. Row 13, images.
5. Rows 14–16.
6. Row 17 last: switch local documents to the local Barkpark and delete the Tiptap tab.

Also: `__save_ack_mounted.test.mjs` fails on Barkpark `main` untouched. Fix it early; a red test nobody owns erodes the suite this goal depends on.

## Process

- Editor work happens in the Barkpark repo (`barkpark-editor` checkout, branch `barkdown/editor-quality`) and merges through Barkpark's own gates, as PR #19366 did. Barkpark is the single source of editor truth.
- Barkdown loads the canvas bundle from the Barkpark it is connected to (`/assets/bp-paper-editor.bundle.js`) instead of a hand-copied file in `app/renderer/vendor`, and records the Barkpark version it targets. The vendored copy is a fallback for a session with no server, not the source.
- The parity suite runs in both repos' CI against a local Barkpark. A row can only go from red to green by a test, and a green row that goes red blocks the merge.

## Running the suite locally

The live suites need a Barkpark on this machine. On Windows the toolchain is installed by Barkpark's `scripts\setup-windows.ps1` (Scoop: Erlang, Elixir, PostgreSQL, ImageMagick). Two things the script does not say, learned 2026-09-20:

- `argon2_elixir` compiles a C NIF and needs `nmake`; run `mix` inside a Visual Studio `vcvars64` environment (the guide's "no Visual Studio" is wrong for this dependency).
- Postgres on Windows can start refusing to spawn backends (`could not reserve shared memory region … error 487` in `pg.log`); the migrator then hangs. Restart the cluster with `pg_ctl` and retry. A Barkdown sidecar must detect this and restart rather than wait.

With Phoenix on `:4000` and the `demo` seed (token `barkpark-dev-token`), point `bp` or Barkdown's Settings at `http://localhost:4000`, then:

```sh
cd app && npm run test:tables && npm run test:editor && node tests/editor-gaps.live.mjs && npm run test:paper
```

`test:tables` registers the tags it needs and publishes its scratch paper with a description, because a current Barkpark runs a publish wall on new papers (`label_spine`, `unknown_tag`). The older live suites publish bare papers and will trip that wall on a local server until they do the same.

## Context: the direction this goal serves

Stated 2026-09-20, not yet folded into the PRD:

- **Barkdown is a note + agent app, utilizing Barkpark.** It uses Barkpark's format, ops protocol, editor and cloud; it does not reimplement them.
- **Local Barkpark.** The real Barkpark (Elixir release plus its own Postgres cluster) runs beside the app, one per profile. Barkpark is Postgres to the bone (`jsonb`, advisory locks, `tsvector`, `pg_trgm`), so there is no lighter store; a JavaScript reimplementation was considered and rejected.
- **Profiles.** A profile is a `bp` server entry plus a data folder: cloud-backed, or local-only and never synced.
- **Sync and portability.** Offline edits sync to bp cloud when online again, building on `bp migrate`, `bp export` and the `ifRev` rebase; all of a profile's data can be zipped and opened on another device. These are Barkpark features that Barkdown orchestrates.
