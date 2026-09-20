# Plan: the Barkpark editor reaches Tiptap quality, and Barkdown runs on a local Barkpark

Set 2026-09-20 from [the standing goal](EDITOR-PARITY.md) and [the review against Tiptap](TIPTAP-REVIEW.md). Every task is a GitHub issue on `FRIKKern/barkdown` with what, where, acceptance and an estimate; the milestones group them; this page is the order. Rows of the parity matrix go green only by a live test; every schema or render change is a Barkpark PR first, then a canvas change, then a Barkdown row.

Sizing: about 20–30 focused days for the editor (M1–M4) plus the pipeline it rides on (M5's first four items); the local-Barkpark sidecar, profiles and sync (M5's last three) are a second block of roughly 11 days after it.

## Sequence

The order interleaves the tiers so an author feels progress every few days while the definition of done keeps moving.

| # | Issue | Task | Milestone | Days | Why here |
|---|---|---|---|---|---|
| 1 | [#1](https://github.com/FRIKKern/barkdown/issues/1) | Open and land the Barkpark PR for `barkdown/editor-quality` | M5 | 0.5 | Everything later stacks on main |
| 2 | [#8](https://github.com/FRIKKern/barkdown/issues/8) | Row 12: enumerate the opaque set, drive to zero | M2 | 2–3 | Decides whether "one engine" is true for notes |
| 3 | [#15](https://github.com/FRIKKern/barkdown/issues/15) | Highlight mark end to end | M1 | 1 | Smallest feature that touches every layer: proves the pipeline |
| 4 | [#2](https://github.com/FRIKKern/barkdown/issues/2) | Load the canvas bundle from the connected Barkpark | M5 | 1 | Ends the hand-copy loop before the volume of editor changes grows |
| 5 | [#3](https://github.com/FRIKKern/barkdown/issues/3) | Publish-wall-aware fixture helper for every live suite | M5 | 0.5 | The older suites must run locally too |
| 6 | [#14](https://github.com/FRIKKern/barkdown/issues/14) + [#9](https://github.com/FRIKKern/barkdown/issues/9) | Image paste and drop into a figure; row 13 live | M1 + M2 | 3–4 | The biggest visible gap to Tiptap's template |
| 7 | [#16](https://github.com/FRIKKern/barkdown/issues/16) | A plain quote block | M1 | 0.5–1 | One of the most-used blocks in notes |
| 8 | [#17](https://github.com/FRIKKern/barkdown/issues/17) | Find and replace | M1 | 1 | Tiptap's extension, loaded as-is |
| 9 | [#19](https://github.com/FRIKKern/barkdown/issues/19) | `@` alias for the wikilink autocomplete | M1 | 0.5 | Cheap; what Notion hands reach for |
| 10 | [#18](https://github.com/FRIKKern/barkdown/issues/18) | Emoji picker on `:` | M1 | 1 | |
| 11 | [#22](https://github.com/FRIKKern/barkdown/issues/22) + [#10](https://github.com/FRIKKern/barkdown/issues/10) | Heading levels decision; row 14 live | M1 + M2 | 1.5 | |
| 12 | [#20](https://github.com/FRIKKern/barkdown/issues/20) | Subscript and superscript | M1 | 1 | |
| 13 | [#21](https://github.com/FRIKKern/barkdown/issues/21) | Text alignment | M1 | 1 | |
| 14 | [#23](https://github.com/FRIKKern/barkdown/issues/23) | Link hover preview | M1 | 1 | |
| 15 | [#4](https://github.com/FRIKKern/barkdown/issues/4) | Parity suite in both CIs against a local Barkpark | M5 | 2 | Before the matrix is large enough to regress silently |
| 16 | [#11](https://github.com/FRIKKern/barkdown/issues/11) | Row 15: IME composition | M2 | 1 | |
| 17 | [#12](https://github.com/FRIKKern/barkdown/issues/12) | Row 16: 500-block performance | M2 | 1–2 | |
| 18 | [#27](https://github.com/FRIKKern/barkdown/issues/27) | Code syntax highlighting, one tokenizer | M4 | 1–2 | |
| 19 | [#24](https://github.com/FRIKKern/barkdown/issues/24) [#25](https://github.com/FRIKKern/barkdown/issues/25) [#26](https://github.com/FRIKKern/barkdown/issues/26) | Tables: merge/split, resize, header column and alignment | M3 | 4–6 | Schema work; when the notes people write need it |
| 20 | [#5](https://github.com/FRIKKern/barkdown/issues/5) | Local Barkpark sidecar lifecycle in Barkdown | M5 | 3 | The store the app runs on |
| 21 | [#6](https://github.com/FRIKKern/barkdown/issues/6) | Profiles: cloud or local-only, zip to another device | M5 | 3 | |
| 22 | [#13](https://github.com/FRIKKern/barkdown/issues/13) | Row 17: local documents on the local Barkpark; delete the Tiptap tab | M2 | 2–3 | The goal's last row |
| 23 | [#7](https://github.com/FRIKKern/barkdown/issues/7) | Sync a local profile with bp cloud | M5 | 5 | A Barkpark feature; after the editor is one engine |

## Milestones

- **M1 Authoring feel** — #14 #15 #16 #17 #18 #19 #20 #21 #22 #23. What an author touches every minute; brings the canvas to the level of Tiptap's Notion-like template for notes.
- **M2 Parity rows 12–17** — #8 #9 #10 #11 #12 #13. The rest of the matrix; the definition of done.
- **M3 Tables** — #24 #25 #26. To prosemirror-tables level; real schema work.
- **M4 Code highlighting** — #27.
- **M5 Pipeline and local Barkpark** — #1 #2 #3 #4 #5 #6 #7. What the editor work rides on, then the store and sync the product is defined by.

## How a task is worked

The project skill `plan-followup` (`.claude/skills/plan-followup`) walks this; `node .claude/skills/plan-followup/scripts/next.mjs` prints the next open issue and checks the environment.

1. Read the issue's acceptance line; it names the live row or test that ends the task.
2. If the task adds or changes a block, mark or attribute: Barkpark first — schema, reader render (view and edit are one producer), the ops contract, a Barkpark unit test — on the `barkdown/editor-quality` branch, through Barkpark's gates.
3. Then the canvas change (a Tiptap extension where one exists), the bundle rebuilt and, until #2 lands, vendored into `app/renderer/vendor`.
4. Then the Barkdown row in `app/tests/`, red first, run against the local Barkpark until green three runs.
5. Update the row in [EDITOR-PARITY.md](EDITOR-PARITY.md), commit both repos, push, close the issue with the run's numbers.

## Working environment

- Local Barkpark: `scripts\setup-windows.ps1 status` in the Barkpark checkout; Postgres on `:5432`, Phoenix on `:4000`, `demo` seed, token `barkpark-dev-token`. Compile with `mix` inside a Visual Studio `vcvars64` environment (`argon2_elixir` needs `nmake`); if migrations hang, look for error 487 in `pg.log` and restart the cluster.
- `bp use local` points the CLI (and the live suites, which use `viaCli`) at it; `bp use gyldendal-2` returns to cloud.
- Barkdown: branch `codex/electron-prototype`; `cd app && npm run test:tables && npm run test:multiblock` are the two green rows to keep green.
- Barkpark: checkout `../barkpark-editor`, branch `barkdown/editor-quality`; `cd api/assets/paper-editor && npm run build` rebuilds the bundle; the unit sweep is 103/105 with two pre-existing failures (`__save_ack_mounted`, `__press_answer_watchdog`).
