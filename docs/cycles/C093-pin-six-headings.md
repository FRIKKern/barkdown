# C093 — The pin moves to six heading levels

**Why.** The owner ruled six heading levels on 2026-10-03 and pull request #66 changed the row 14 test to expect them. Barkdown carries Barkpark `9f1874235`, 526 commits before `944a57a1e`, the upstream commit that adds them, so main's parity matrix is 19 of 20. Issue #13 cannot close while a row is red.

**State on 2026-10-04: built, not merged.** The move makes row 14 green and six other rows red, so it is parked on a branch and main keeps the old pin.

```
 main (old pin 9f1874235)            19 of 20 rows   row 14 red: the test expects six heading levels
 codex/pin-944a57a1e (0d0ff9de)      14 of 20 rows   row 14 green; six rows red that are green on main
```

## What the branch holds

- **Editor upgrade.** A fresh worktree at the commit (`~/Documents/GitHub/barkpark-worktrees/pin-944a57a1e`, dependencies installed), the bundle rebuilt with the upstream build flags: byte-identical to the committed one. `scripts/editor-notices.mjs` regenerated the notices for the changed lock (45 packages, Tiptap 3.31.4); the 35 superseded notice folders were removed from the archive and from beside the bundle; `scripts/bump-barkpark-ref.mjs --editor-upgrade` wrote the pin, provenance, consumption audit and both manifests. The vendor tests pass.
- **Runtime.** `runtime/barkpark-944a57a1e-darwin-arm64` was built on this Mac with `scripts/build-runtime-release.mjs` and carries Postgres 15.18. It is not in git; rebuild it with that script from the worktree if it is gone.

## The matrix on the new pin ([evidence](evidence/C093/parity-on-944a57a1e.txt))

| Row | Old pin | New pin | First failing case |
|---|---|---|---|
| row 14 headings, checklists, link edit, placeholder | 3/4 | **4/4** | — |
| images (row 13) | 6/6 | 5/6 | the uploaded picture is not served: `fetch failed` |
| gaps (rows 1 to 7) | 13/13 | 4/13 | the seed heading does not survive an interaction; a pasted heading lands differently |
| subsup | 6/6 | 3/6 | not read yet |
| linkpreview | 6/6 | 5/6 | the preview's Open button cannot be clicked |
| tablewidths | 5/5 | 1/5 | not read yet |
| tablehead | 6/6 | 2/6 | the bubble's cell alignment never reaches the server |

The other fourteen rows are green on both pins. The causes are not known: each may be a deliberate upstream change the test must follow, or an upstream regression to report.

## Why six rows moved unnoticed

Barkpark's pull-request check for these rows (`barkdown-parity.yml`) cannot read this private repository and passes without running them (issue #4). Fixing #4 is what keeps the next pin move small.

## Next

Take the red rows one at a time on the branch (the command is in `docs/cycle.json`), then the app's test chain and the pictures on the new pin, then merge, chain, nightly and close #13.

## Task board

"C093 Move the Barkpark pin", `task-dcf96433fb131cca`, worker `claude-barkdown-c093`.
