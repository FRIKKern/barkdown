## Editor parity: 18/20 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🔴 `tables` | row 10 | exit 1; 9/11 green | 32s |
| 🟢 `multiblock` | row 11 | 11/11 green | 29s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 70s |
| 🟢 `images` | row 13 | 6/6 green | 22s |
| 🟢 `row14` | row 14 | 4/4 green | 21s |
| 🟢 `ime` | row 15 | 4/4 green | 18s |
| 🟢 `perf` | row 16 | 3/3 green | 17s |
| 🔴 `gaps` | rows 1–7 (Notion behaviours) | exit 1; 0/1 green | 78s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 20s |
| 🟢 `highlight` | #15 | 6/6 green | 18s |
| 🟢 `find` | #17 | 6/6 green | 17s |
| 🟢 `emoji` | #18 | 4/4 green | 17s |
| 🟢 `mention` | #19 | 4/4 green | 18s |
| 🟢 `subsup` | #20 | 6/6 green | 19s |
| 🟢 `align` | #21 | 6/6 green | 20s |
| 🟢 `linkpreview` | #23 | 6/6 green | 18s |
| 🟢 `codehl` | #27 | 4/4 green | 16s |
| 🟢 `tablespans` | #24 | 7/7 green | 23s |
| 🟢 `tablewidths` | #25 | 5/5 green | 15s |
| 🟢 `tablehead` | #26 | 6/6 green | 23s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
