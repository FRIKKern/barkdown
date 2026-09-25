## Editor parity: 19/20 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🟢 `tables` | row 10 | 11/11 green | 22s |
| 🟢 `multiblock` | row 11 | 11/11 green | 27s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 51s |
| 🟢 `images` | row 13 | 6/6 green | 22s |
| 🟢 `row14` | row 14 | 4/4 green | 18s |
| 🔴 `ime` | row 15 | exit 1; 3/4 green | 43s |
| 🟢 `perf` | row 16 | 3/3 green | 15s |
| 🟢 `gaps` | rows 1–7 (Notion behaviours) | 13/13 green | 35s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 17s |
| 🟢 `highlight` | #15 | 6/6 green | 17s |
| 🟢 `find` | #17 | 6/6 green | 15s |
| 🟢 `emoji` | #18 | 4/4 green | 12s |
| 🟢 `mention` | #19 | 4/4 green | 15s |
| 🟢 `subsup` | #20 | 6/6 green | 15s |
| 🟢 `align` | #21 | 6/6 green | 17s |
| 🟢 `linkpreview` | #23 | 6/6 green | 17s |
| 🟢 `codehl` | #27 | 4/4 green | 13s |
| 🟢 `tablespans` | #24 | 7/7 green | 15s |
| 🟢 `tablewidths` | #25 | 5/5 green | 12s |
| 🟢 `tablehead` | #26 | 6/6 green | 14s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
