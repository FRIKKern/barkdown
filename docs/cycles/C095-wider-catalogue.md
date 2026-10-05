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

## Task board

`task-2cc53c96d6e24010` on Guerrilla, worker `claude-barkdown-c095`.

## Next

Build A–F, extend `control.test.mjs` and `control.live.mjs`, then pictures and records.
