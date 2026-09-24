## Editor parity: 20/20 rows green

| Row | Proves | Result | Time |
|---|---|---|---|
| 🟢 `tables` | row 10 | 11/11 green | 34s |
| 🟢 `multiblock` | row 11 | 11/11 green | 30s |
| 🟢 `opaque` | row 12 | 22/22 note block types mount editable; 10/10 edits held by the server; 9/9 slash inserts land on the server; editor bundle from the server | 68s |
| 🟢 `images` | row 13 | 6/6 green | 23s |
| 🟢 `row14` | row 14 | 4/4 green | 21s |
| 🟢 `ime` | row 15 | 4/4 green | 19s |
| 🟢 `perf` | row 16 | 3/3 green | 17s |
| 🟢 `gaps` | rows 1–7 (Notion behaviours) | 13/13 green | 56s |
| 🟢 `paper` | row 9 (ifRev, 412, re-apply) | 11/11 paper checks | 21s |
| 🟢 `highlight` | #15 | 6/6 green | 19s |
| 🟢 `find` | #17 | 6/6 green | 17s |
| 🟢 `emoji` | #18 | 4/4 green | 16s |
| 🟢 `mention` | #19 | 4/4 green | 19s |
| 🟢 `subsup` | #20 | 6/6 green | 20s |
| 🟢 `align` | #21 | 6/6 green | 22s |
| 🟢 `linkpreview` | #23 | 6/6 green | 19s |
| 🟢 `codehl` | #27 | 4/4 green | 16s |
| 🟢 `tablespans` | #24 | 7/7 green | 23s |
| 🟢 `tablewidths` | #25 | 5/5 green | 17s |
| 🟢 `tablehead` | #26 | 6/6 green | 24s |

Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under `app/tests/`; the matrix is `docs/EDITOR-PARITY.md`.
