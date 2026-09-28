# C084 macOS parity evidence

First run on macOS (Darwin 24.3.0, arm64, Node 22.22.2, Electron from app/package-lock.json), 2026-09-28.

- Install: `npm --prefix app ci` failed until the user ran `sudo chown -R $(whoami) ~/Library/Caches/electron`; the directory was root-owned from an April 2023 install and Electron's postinstall refused it. After that: 344 packages, esbuild and Electron.app present.
- Unit files (the first nine `node --test` files of the chain): 110 tests, 105 pass, 0 fail, 5 skipped. All five skips are Windows-only native drain and restart tests (`skip: process.platform !== 'win32'`).
- First live Electron test, `profile-preparation.live.mjs`: failed. It presses `Control+a` to select all; on macOS Chromium binds select-all to Meta, so the draft text was appended to the file text instead of replacing it. The app's own shortcut handling accepts either Ctrl or Cmd; the hardcoding is in the tests (49 files press `Control+`).
- The test chain is one `&&` sequence, so that failure stopped the run. A per-segment measurement follows in this directory.
