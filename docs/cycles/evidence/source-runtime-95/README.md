# Source launch runs on the pinned runtime (#95)

On 27 October 2026, on macOS 27 arm64, `node scripts/start.mjs` from 8ab9bea5 started Barkdown on a fresh profile through Playwright's Electron driver ([producer](producer/probe-source-start.mjs)). The launcher found `runtime/barkpark-1482fb675-darwin-arm64`, built with `node scripts/build-runtime-release.mjs` from a clean checkout at `app/BARKPARK_REF`, and passed it to Electron as `BARKDOWN_CARRIED_RUNTIME`.

| Check | Result |
| --- | --- |
| Electron's main process holds `BARKDOWN_CARRIED_RUNTIME` | the runtime folder |
| A new profile's settings have `barkpark.local.enabled` with that source | yes, nobody opened Settings |
| The profile's `barkpark.json` | `enabled: true`, `writes: true`, a loopback server whose `/status.json` answers |
| Pages + | opens a Barkpark Paper note ("Untitled", live editing, revision shown), no Settings toast |
| After quitting with SIGINT | no Barkdown process and no `postmaster.pid` left |

[result.json](result.json) · [before Pages +](01-ready.png) · [after Pages +](02-note.png)

The screenshots are light because the capture used the Mac's system appearance; this run checks behavior, not visuals.

## Limits

- The runtime was built on this Mac without carried Postgres, so the profile used Homebrew `pg_ctl` (PostgreSQL 14). The published asset from `.github/workflows/runtime.yml` carries PostgreSQL 15.18.
- The download path is covered by `app/tests/source-runtime.test.mjs` against a local server. The first real download happens after the workflow publishes `runtime-1482fb675` from `main`.
- Typing into the new note was not checked; the editor did not have focus when the probe typed.
