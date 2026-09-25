## Editor parity: 20/20 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🟢 `tables` | row 10 | 11/11 green | 25s |
| 🟢 `multiblock` | row 11 | 11/11 green | 23s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 52s |
| 🟢 `images` | row 13 | 6/6 green | 18s |
| 🟢 `row14` | row 14 | 4/4 green | 16s |
| 🟢 `ime` | row 15 | 4/4 green | 16s |
| 🟢 `perf` | row 16 | 3/3 green | 14s |
| 🟢 `gaps` | rows 1–7 (Notion behaviours) | 13/13 green | 41s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 15s |
| 🟢 `highlight` | #15 | 6/6 green | 14s |
| 🟢 `find` | #17 | 6/6 green | 12s |
| 🟢 `emoji` | #18 | 4/4 green | 12s |
| 🟢 `mention` | #19 | 4/4 green | 14s |
| 🟢 `subsup` | #20 | 6/6 green | 15s |
| 🟢 `align` | #21 | 6/6 green | 16s |
| 🟢 `linkpreview` | #23 | 6/6 green | 15s |
| 🟢 `codehl` | #27 | 4/4 green | 13s |
| 🟢 `tablespans` | #24 | 7/7 green | 17s |
| 🟢 `tablewidths` | #25 | 5/5 green | 13s |
| 🟢 `tablehead` | #26 | 6/6 green | 18s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
