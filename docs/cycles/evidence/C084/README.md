# C084 macOS parity evidence

Host: Darwin 24.3.0, arm64, Node 22.22.2, npm 11, Electron from `app/package-lock.json`. Runs on 2026-09-28. The app's test chain (`app/package.json` `test`) was executed segment by segment, every `&&` link as its own process, so one failure never hides the rest; raw results are the two JSON files here.

## Install

`npm --prefix app ci` failed until the user ran `sudo chown -R $(whoami) ~/Library/Caches/electron`: the directory was root-owned from an April 2023 install and Electron's postinstall refused it. After that: 344 packages, esbuild and Electron.app present.

## Before fixes ([mac-segments-before.json](mac-segments-before.json))

80 segments: 68 pass, 12 fail. Unit tests 649: 606 pass, 1 fail, 42 skipped (all Windows-only native drain, restart and process-tree cases).

| Failure | Cause | Class |
|---|---|---|
| `profile-preparation.live`, `project-buffer-profile.live`, `run.mjs` | Tests press `Control+a`, `Control+End`, `Control+s`; macOS Chromium binds select-all and document-end to Meta, so text was appended, not replaced | Test plumbing |
| `runtime-build.test` | `main/runtime-build.js` pre-created the staging directory and then copied with `errorOnExist`; Node 22.23 refuses that on macOS, and the same failure appeared on `windows-latest` in CI with the same Node | App, every platform |
| `editor-asset-proxy.test` (vendor fallback) | `main/canvas-bundle.js` fell back while the second asset request was still in flight, so the proxy's refusal count was incomplete on a fast host | App, every platform |
| `profile-goals.live`, `goal-coordinator.live`, `goal-coordinator-recovery.live`, `profile-goals-recovery.live`, `terminal-ownership.live`, `chat-recovery.live` | Owned goal and terminal process trees are implemented with Windows job objects (`main/goal-process.js`: "requires Windows"); off Windows the app has no owned agent and these flows cannot be exercised | Product gap, recorded |
| `credential-durability.live` | DPAPI `Local State` durability is Windows-only by design (`main/credential-durability.js` returns early elsewhere) | Product gap, recorded (Keychain twin pending) |
| `profile-preparation.live` terminal half | Expects the PowerShell banner and call operator, and owned terminal trees | Half gated, gap recorded |

## After fixes ([mac-segments-after.json](mac-segments-after.json))

80 segments: 80 pass, 0 fail. Unit tests 649: 607 pass, 0 fail, 42 skipped. Eight live `SKIP` lines, each naming its reason and host. Total 201 s.

Fixes: `app/tests/helpers/keys.mjs` (host modifier and document-end chords, 37 files); `main/runtime-build.js` lets `cp` create the staging directory; `main/canvas-bundle.js` settles every asset request before falling back; `app/tests/helpers/host.mjs` `skipUnlessWindows` for the seven Windows-only live files; the preparation test's terminal half gated inline; `app/tests/host-skips.test.mjs` pins platform-only sites per kind (27 unit skip sites, 7 live files, 3 inline blocks) and is appended to the chain.

## What remains a real gap on macOS

- Owned agent and terminal process trees (P1 "keep agent runs isolated") exist only on Windows. A POSIX twin (process groups, `setsid`, group signals, restart verification) is product work, not test work.
- Credential durability proof is Windows-only; macOS uses Keychain through `safeStorage` and has no durability test yet.
- `main/local-barkpark-source.js` refuses to launch a source Barkpark off Windows ("packaged runtime support is pending").
- Visual approvals are not keyed by platform yet; no Mac capture was approved.

## CI

`.github/workflows/desktop.yml` runs the chain on `windows-latest` (required), `macos-latest` and `ubuntu-latest` (advisory until green), gated to `app/**` and the workflow, nightly on `main`. First run: all three red on the same `runtime-build` copy defect before the fix; the account's Actions artifact storage quota was full, so uploads are diagnostics only and cannot fail the job.
