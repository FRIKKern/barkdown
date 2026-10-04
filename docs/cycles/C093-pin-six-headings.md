# C093 — The pin moves to six heading levels

**Why.** The owner ruled six heading levels on 2026-10-03 and pull request #66 changed the row 14 test to expect them. Barkdown carries Barkpark `9f1874235`, 526 commits before `944a57a1e`, the upstream commit that adds them, so main's parity matrix is 19 of 20. Issue #13 cannot close while a row is red.

**State on 2026-10-04: merged.** The parity matrix is 20 of 20 on Linux with the new pin, row 14 included ([run](https://github.com/FRIKKern/barkdown/actions/runs/37201636752)).

## What was done

- **Editor upgrade.** A fresh worktree at the commit, `npm ci`, the bundle rebuilt with the upstream build flags: byte-identical to the committed one. `scripts/editor-notices.mjs` regenerated the notices for the changed lock (45 packages, Tiptap 3.31.4, every notice copied from the installed package); the 35 superseded notice folders were removed from the archive and from beside the bundle, and the archive's README follows the manifest. `scripts/bump-barkpark-ref.mjs --editor-upgrade` wrote the pin, provenance, consumption audit and both manifests.
- **Runtime.** `runtime/barkpark-944a57a1e-darwin-arm64`, built with `scripts/build-runtime-release.mjs` from that worktree, carrying Postgres 15.18. Not in git.
- **The one thing the new pin broke in Barkdown.** Upstream separated its public port from its listen port; a release assumes the scheme's standard port in every absolute address unless `PHX_PORT` says otherwise. Uploaded pictures came back as `http://127.0.0.1/media/…` and could not be fetched. `app/main/local-barkpark-source.js` now passes `PHX_PORT`.

## The matrix, and a lesson about where it is run

| Where | Old pin | New pin |
|---|---|---|
| GitHub, Linux | 19 of 20 (row 14 red) | **20 of 20** |
| This Mac, first run | not run | 14 of 20 ([evidence](evidence/C093/parity-on-944a57a1e.txt)) |
| This Mac, after `PHX_PORT` | — | 17 of 20 |

The first local run looked like six regressions. Three were the port (images, link preview, table widths). The other three (gaps, subsup, tablehead) fail identically on this Mac with the old pin: those tests press Control where macOS uses Command. A baseline on the old pin, on the same machine, is what separated the two; without it the pin move looked far worse than it was.

## Also verified on the new pin

- The app's whole test chain passes on this Mac with the new runtime.
- The visual run differs beyond tolerance in two frames, both by the editor bundle's sha1 line in Settings.

## Limits

- Three parity rows cannot be judged on macOS until their tests use the platform's modifier key.
- Barkpark's own pull-request check for these rows still passes without running them (issue #4), so upstream drift is caught only when the pin moves.
- Windows is unrun.

## Delivery

Merged at `28f4327a`. Parity on main: 20 of 20 ([run](https://github.com/FRIKKern/barkdown/actions/runs/37215017462)). Delivered in [v0.6.0-nightly.20261004.4](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261004.4), chain receipt on `28f4327a`; the nightly's packaged tours ran on the new runtime. Issue #13 closed. The branch `codex/pin-944a57a1e`, its worktree and the upstream worktree were retired after the merge.

## Task board

"C093 Move the Barkpark pin", `task-dcf96433fb131cca`, worker `claude-barkdown-c093`.
