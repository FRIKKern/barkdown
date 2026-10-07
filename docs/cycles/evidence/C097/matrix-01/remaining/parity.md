## Editor parity: 19/19 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🟢 `multiblock` | row 11 | 11/11 green | 24s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 45s |
| 🟢 `images` | row 13 | 6/6 green | 17s |
| 🟢 `row14` | row 14 | 4/4 green | 15s |
| 🟢 `ime` | row 15 | 4/4 green | 16s |
| 🟢 `perf` | row 16 | 3/3 green | 15s |
| 🟢 `gaps` | rows 1–7 (Notion behaviours) | 13/13 green | 24s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 13s |
| 🟢 `highlight` | #15 | 6/6 green | 13s |
| 🟢 `find` | #17 | 6/6 green | 11s |
| 🟢 `emoji` | #18 | 4/4 green | 11s |
| 🟢 `mention` | #19 | 4/4 green | 12s |
| 🟢 `subsup` | #20 | 6/6 green | 13s |
| 🟢 `align` | #21 | 6/6 green | 14s |
| 🟢 `linkpreview` | #23 | 6/6 green | 15s |
| 🟢 `codehl` | #27 | 4/4 green | 12s |
| 🟢 `tablespans` | #24 | 7/7 green | 14s |
| 🟢 `tablewidths` | #25 | 5/5 green | 11s |
| 🟢 `tablehead` | #26 | 6/6 green | 12s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
