# C095 — The wider catalogue

**Why.** The owner chose to widen the `barkdown` catalogue after C094 (2026-10-05). C094 listed what a person could still only do by hand: export and import of a profile, the Paper switch, provider sign-in, goals, deleted-note recovery, images on a message, and editing a note's text in place.

**The shape.** No new gate. Each new command goes into `app/shared/control-commands.js`, gets a handler in the main process (`app/main/main.js`, `startControl`) or the window (`app/renderer/src/control.js`), and calls the function a person's click already reaches.

| Slice | Commands | Tier |
|---|---|---|
| A. Notes | `note edit`, `note undo`, `note deleted`, `note recover`; `note delete` | act; admin |
| B. Profiles | `profile portable` (read); `profile export`, `profile import`, `profile discard-import` | read; admin |
| C. The Paper switch | `library switch-status`, `library compare` (read); `library switch`, `library rollback`, `library reconcile` | read; admin |
| D. Sign-in | `provider check`, `provider login-status` (read); `provider login`, `provider login-cancel` | read; admin |
| E. Goals | `goal list` (read); `goal new`, `goal start`, `goal pause`, `goal cancel`, `goal open` | act |
| F. Images | `--image` on `chat send` and `agent add` | act |

**Stays a person's** (added to the never-list): accepting or retrying a goal worker's evidence and confirming a worker has stopped (they are attestations), signing out (no such action exists), and the restart a finished export asks for.

## Preflight (2026-10-05, this Mac)

- Fresh clone; `npm ci` in both folders. npm 11 skips install scripts not in `allowScripts`: Electron's binary, node-pty and esbuild were installed by running their scripts by hand.
- The runtime: `barkpark-worktrees/barkdown-ref` created at the pin `944a57a1e`, release built with `scripts/build-runtime-release.mjs` into `runtime/barkpark-944a57a1e-darwin-arm64` (Homebrew Postgres 17, not carried). `cc` on this machine is a shell shim, so the build needs `CC=/usr/bin/clang`.
- Baseline: `control.test.mjs` 6 of 6; `control.live.mjs` 13 of 13 against that runtime before any change.

## Evidence

| What | Result | Where |
|---|---|---|
| The gate, tiers, never-list additions, a file list given twice, help | 7 tests pass (one new) | `app/tests/control.test.mjs` |
| The real app driven by the `barkdown` launcher, replies scripted | 13 checks pass at `2474cd04` | `evidence/C095/live/2026-10-05T16-36-24-695Z-wider/` |
| C094's tour, unchanged | 13 checks pass | run locally, not kept |
| Pictures | approved (darwin) | visual run `2026-10-05T16-37-02-383Z`: clock text and a temporary path only |

The tour: admin commands refused without Full YOLO; the switch clicked on; `paper status` and `paper switch` on a library with no notes yet, then a person's restart and the library on Paper; `note edit` appending with Undo shown in the note; `note undo` once; `note edit --mode replace` refused without `--rev` and with a stale one, then done with the right one; `chat send --image` with a PNG (the model got an image block), a text file and a missing file refused; `goal new --no-start`, `list`, `open`, `cancel`, and review, accept, complete, reconcile refused; `provider check`, `cancel` with nothing running, no sign-out; `note delete`, `deleted`, `recover` as a separate copy; `profile export` into a folder with its manifest and the notice offering the restart; `profile import` as a new profile not switched to, a folder without a manifest refused; the log naming every change.

## Found on the way

- **A deleted note's tab blocked profile preparation.** Its pane has no editor, so the freeze threw "Paper recovery is unavailable" and an export or the switch failed while the tab was open, from Settings too. Fixed in `app/renderer/src/tabs/paper.js`: such a tab gives an empty lease.
- **A refused stale edit held the writer fence.** `agent-edits` threw its revision check inside the writer's run without a status, so the fence kept an uncertain write; exports and the switch then refused until the app restarted (for an assistant's edit too: the departed-writer sweep only clears `barkpark:` operations). Fixed: refusals before anything is sent carry 409, which the fence reads as answered.
- **The switch refuses Paper note ids with a dot** (`drafts.<id>`) in tabs, favorites or Pages: `migration-workspace.js` `identity()`. Not fixed here; task `task-40bc35d902c777e8`. The tour switches before any note exists.

## Limits

- Proven on this Mac (darwin arm64, a second machine), from source. Not the packaged app; not Windows.
- `provider login` was not run against a real sign-in: it opens the browser and waits for a person. Its refusal without Full YOLO and the provider checks are proven; `provider check codex` ran against whatever Codex this machine has.
- Goals were created, opened and cancelled, not run: a coordinated run needs a real model's plan.
- `paper rollback` and `paper reconcile` are proven only as refused without Full YOLO and, for reconcile, refusing a Paper the status does not list. The Settings path they reuse has its own tour (`migration-switch-ui.live.mjs`).
- Not in the catalogue still: attaching a non-image file, editing a single block or table cell (assistants have their document tools), Chrome import, the retained-drafts review.
- `barkdown` is still not on the system path.
- The migration estimate in `docs/PLAN.md` was reviewed and is unchanged: the catalogue is outside that scope.

## Task board

`task-2cc53c96d6e24010` on Guerrilla, worker `claude-barkdown-c095`.

## Next

Push, chain and nightly when the owner says so. Then the owner's call: the switch fix (`task-40bc35d902c777e8`), `barkdown` on the system path, Windows, or C089's owner items.
