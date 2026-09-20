# The Barkpark canvas reviewed against Tiptap

Written 2026-09-20 to size the distance to "Tiptap quality" for [the standing goal](EDITOR-PARITY.md). Both sides are read from source: the canvas from the `barkpark-editor` checkout (`api/assets/paper-editor/src`, commit `e227b550f`), Tiptap from its package directory on GitHub (`ueberdosis/tiptap/packages`) and its pricing page, and Tiptap's own Notion-like editor template as the reference for what a finished Tiptap editor feels like.

## The one fact that sets the scale

**The canvas is Tiptap.** `<bp-paper-canvas>` is `@tiptap/core` + StarterKit + Link, Placeholder, Typography, Underline, TaskList/TaskItem over one ProseMirror document, with about twenty custom node types on top. StarterKit's blockquote, horizontal rule and code block are switched off in favour of the canvas's own callout/pullquote, divider and code nodes; everything else in StarterKit (history, dropcursor, gapcursor, hard break, lists, marks, headings) is in force.

So "reach Tiptap quality" is not a rewrite and not even a port. Most of what Tiptap has and the canvas lacks is a Tiptap extension the canvas could load tomorrow. **The cost of each feature is on the Barkpark side, not the editor side**: a new mark or attribute has to exist in PortableDoc (the server schema, Elixir), render byte-identically in the reader (doctrine rule 3: view and edit are the same producer), travel in the ops patch shape, and be covered on both sides. Rule of thumb from today's work: about a fifth of the effort is editor, four fifths is schema, renderer, contract and tests.

Tiptap's paid tier, for orientation, is cloud services — hosted collaboration, comments, in-line AI, import/export, document history — not editor features. Its once-Pro extensions (drag handle, emoji, file handler, find and replace, mathematics, details, table of contents, unique id, node range) are now open source.

## Capability matrix

Tiptap's open-source catalogue against the canvas. **Has** means an author gets it today; **partial** means the canvas does something adjacent; **missing** means nothing; **n/a** means Barkdown covers it another way. "Server" notes whether PortableDoc already knows the concept.

### Blocks

| Tiptap | Canvas | Server | Note |
|---|---|---|---|
| paragraph, text, document | has | yes | |
| heading | partial: levels 1–3 | check | Tiptap gives 1–6. The canvas config is `levels: [1, 2, 3]`; Notion uses three. Decide, don't drift |
| bullet list, ordered list, list item, nested lists | has | yes | Tab/Shift+Tab nesting verified live |
| task list / task item | has | yes | added in PR #19366 (`task: true`, `checked` per item) |
| blockquote | partial | yes | `> ` becomes a callout; a pullquote role exists; there is no plain quote block. Authors from Notion/Tiptap expect a plain quote |
| code block, code block with lowlight | partial | yes | language attribute, keyboard exits, fence shorthand; **no syntax highlighting** anywhere (no lowlight/prism/shiki in canvas or reader) |
| horizontal rule | has (divider) | yes | |
| hard break | has | yes | |
| image | partial | yes (figure, media) | figure block with the media picker; **no paste or drop of an image file** into the canvas (no `dataTransfer.files` handling). The Tiptap template treats drag-and-drop upload as table stakes |
| table | has, now at TableKit parity for editing | yes | Tab/Shift+Tab selection, Tab-adds-row, chrome, pipe-table paste (row 10). Missing versus prosemirror-tables: **merge/split cells, resizable columns, header column, per-cell alignment**. The canvas table is custom (protected cells, structure as actions), not prosemirror-tables, so these are schema work |
| details (toggle block) | partial | yes | collapsible callout with a summary; Tiptap's details is a neutral toggle without a tone |
| mathematics (KaTeX) | missing | no | |
| emoji (`:` picker) | missing | text only | |
| mention (`@`) | partial | yes (wikilink, tag) | `[[` wikilink and `#` tag autocompletes exist; no `@` trigger. For a note app, wikilinks are the better primitive; an `@` alias is cheap |
| youtube, twitch, audio | has (embed) | yes | generic embed node |
| table of contents | missing | headings/sections exist | |
| unique id | has (`bpId`) | yes, server-minted; client ids honoured | |
| node range (Notion-style whole-block selection) | partial | — | one PM doc gives selection across blocks; there is no block-selection mode with keyboard block picking |

### Marks

| Tiptap | Canvas | Server | Note |
|---|---|---|---|
| bold, italic, strike, code, link, underline | has | yes | |
| highlight | missing | no | the Tiptap template's most visible missing mark for note-takers |
| color, text style, font family | missing | `color` appears once | for notes, colour is the one that matters; font family is not a note feature |
| subscript, superscript | missing | no | |
| text align | missing | no | block attribute, needs reader parity |
| typography (smart quotes, dashes) | has | — | |

### Functionality and feel

| Tiptap / template | Canvas | Note |
|---|---|---|
| history (undo/redo) | has | verified live, including across the ops round trip (row 11) |
| placeholder | has | |
| slash command | has | 31 items, grouped, inside empty list items too |
| floating (bubble) toolbar | has | custom format bubble; Ctrl+K link row |
| drag handle / block menu | has | gutter with `+`, grip drag with drop line, block menu |
| floating `+` menu | has | |
| bubble/floating menu packages | n/a | custom implementations |
| find and replace | missing | Tiptap ships it open source; loadable as-is |
| file handler (paste/drop files) | missing | see image |
| invisible characters | missing | niche |
| markdown | has, and more | `markdown.js` converter plus a **source mode** (edit the paper as Markdown), which Tiptap does not offer as UI |
| static renderer | has, better | the server renders 80 block types; view and edit are one producer |
| collaboration, collaboration caret (Yjs) | missing | Barkpark is revision-based with `ifRev` and a conflict card; real-time co-editing is a different architecture. Not on the note-app path today |
| comments (paid) | partial | Barkpark proposals are agent-to-author review, not inline comments |
| AI (paid) | n/a | Barkdown's agent is the product; it reads and proposes on papers already |
| import/export (paid) | partial | `bp export`, markdown in and out; no DOCX/PDF |
| document history (paid) | has | revisions and history endpoints |
| dark/light theme | has | Barkdown's `paper-notion.css` skin |
| mobile / responsive | partial | Barkpark has narrow-width guards; untested inside Barkdown |
| accessibility | partial | aria roles and keyboard reach on chrome are tested in Barkpark; no screen-reader pass |
| IME composition | untested | row 15 |

### What the canvas has that Tiptap does not ship

Callouts with tones, columns, sections with presets, cards, stages, actions, Mermaid diagrams, terminal blocks, figures, schema fields, wikilinks with backlinks, block references, tags, value references, a Markdown source mode, per-block revision ops with server echo and 412 conflict handling, and a server-side renderer that is the same producer as the editor. None of this is on the Tiptap side of the ledger.

## How much work

Estimates are for one person on the `barkpark-editor` codebase at today's pace (three table fixes plus the rejection path took an afternoon, each with Barkpark unit tests and a live Barkdown row). Each item includes the Barkpark schema/render/contract work, which is where the days go.

**A. Authoring feel, to the Tiptap template's level for notes — about 9–13 days**

| Item | Days | Where the cost is |
|---|---|---|
| Image paste and drop into a figure (upload to Barkpark media, placeholder while uploading) | 2–3 | media endpoint wiring, figure ops, echo |
| Highlight mark | 1 | PortableDoc inline type, reader render, ops patch, contract |
| Plain quote block (or decide callout-only and make `> ` honest) | 0.5–1 | schema decision, render |
| Find and replace | 1 | load Tiptap's extension; a Barkdown UI |
| Emoji picker on `:` | 1 | editor only (text) |
| `@` as an alias for the wikilink autocomplete | 0.5 | editor only |
| Subscript, superscript | 1 | inline types, render |
| Text alignment | 1 | block attribute, render |
| Headings 4–6 or a firm "three levels" | 0.5–1 | config or schema |
| Link hover preview | 1 | editor + a fetch |

**B. Tables to prosemirror-tables level — about 4–6 days**

Merge/split cells needs a `colspan/rowspan` concept in PortableDoc's table (it has none today), reader render, the table actions, and the canvas node-view. Column resize needs a width attribute with the same journey. Header column and cell alignment are smaller. This is real schema work; it is also the least Notion-like item on the list (Notion tables don't merge either).

**C. Code highlighting — about 1–2 days**

Lowlight in the canvas is an afternoon; the reader must render identically, so the server needs the same tokenizer output or a shared client pass. Decide once for both.

**D. The remaining parity rows (12–17) — about 6–9 days**

Opaque-set enumeration and fixes (2–3), image round trip proven live (with A), IME (1), 500-block performance (1–2), retiring the Tiptap tab and moving local documents onto the local Barkpark (2–3).

**Not on the path:** real-time collaboration (a Yjs architecture beside a revision-based server — weeks, and not what a note + agent app needs first), comments, DOCX/PDF export.

**Total to "an author who knows Tiptap's Notion template would not miss anything for note-taking": roughly 20–30 focused days, about 5–6 weeks for one person**, with A first because it is what an author touches every minute, D interleaved because it is the goal's definition of done, B and C when tables and code matter to the notes people actually write.

## What this review changes in the plan

- Row 12 (opaque set) stays next; it decides whether "one engine" is true for notes.
- Add rows for the A items to [EDITOR-PARITY.md](EDITOR-PARITY.md) as they start; each goes green by a live test like rows 10 and 11.
- Every new mark or attribute is a Barkpark PR first (schema, render, contract, tests), then a canvas change, then a Barkdown row — the order today's work proved.
- Load Tiptap's own extensions where they fit (find and replace, emoji, mathematics later) instead of writing them; the canvas is Tiptap, and that is the whole point.
