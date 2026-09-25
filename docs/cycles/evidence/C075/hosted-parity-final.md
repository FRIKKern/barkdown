## Editor parity: 20/20 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🟢 `tables` | row 10 | 11/11 green | 31s |
| 🟢 `multiblock` | row 11 | 11/11 green | 31s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 70s |
| 🟢 `images` | row 13 | 6/6 green | 25s |
| 🟢 `row14` | row 14 | 4/4 green | 23s |
| 🟢 `ime` | row 15 | 4/4 green | 20s |
| 🟢 `perf` | row 16 | 3/3 green | 18s |
| 🟢 `gaps` | rows 1–7 (Notion behaviours) | 13/13 green | 59s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 21s |
| 🟢 `highlight` | #15 | 6/6 green | 20s |
| 🟢 `find` | #17 | 6/6 green | 17s |
| 🟢 `emoji` | #18 | 4/4 green | 18s |
| 🟢 `mention` | #19 | 4/4 green | 20s |
| 🟢 `subsup` | #20 | 6/6 green | 25s |
| 🟢 `align` | #21 | 6/6 green | 22s |
| 🟢 `linkpreview` | #23 | 6/6 green | 20s |
| 🟢 `codehl` | #27 | 4/4 green | 19s |
| 🟢 `tablespans` | #24 | 7/7 green | 25s |
| 🟢 `tablewidths` | #25 | 5/5 green | 17s |
| 🟢 `tablehead` | #26 | 6/6 green | 26s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
