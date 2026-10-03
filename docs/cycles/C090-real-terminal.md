# C090 — A real terminal

**Why.** The terminal tab was a line-at-a-time pipe to a shell with no tty: an input box, a text area, one command per Enter. Nothing interactive could run in it, nothing had colour, nothing knew the pane's width. The owner's words: it must be good on both Windows and Mac, hold an interactive terminal, and feel like PowerShell or Ghostty.

**The shape.** The ownership contract from C035/C076 stays exactly as it was — one shell per tab, a journal on disk, an owned worker (a Job on Windows, a process group on macOS), a stop that is verified before the tab lets go. What changed is what runs inside that worker and what draws in the tab.

```
 tab (renderer/src/tabs/terminal.js)
   │ keystrokes ──► term:write ──► main/terminal.js ──► owned worker ──► pty (node-pty)
   │ resize     ──► term:resize                                          │  login shell  (macOS)
   ▼                                                                     │  pwsh/ConPTY  (Windows)
 emulator (renderer/src/terminal-engine.js)   ◄── term:data ◄────────────┘
   xterm.js 6 (default)  |  ghostty-web (Settings › General › Terminal)
```

## Slices

| | Slice | Exit |
|---|---|---|
| A | **The pty.** `main/terminal-worker.js` spawns the shell with node-pty 1.1.0 (`xterm-256color`, the pane's cols/rows, `TERM_PROGRAM=Barkdown`, the provider environment). macOS: `$SHELL -l`. Windows: `pwsh.exe` from PATH with `-NoLogo`, else `powershell.exe`, through ConPTY. The service adds `write` (raw bytes, ≤256 KiB) and `resize` (2..1000) and keeps `input` (a line) for the ownership tests. The worker refuses a missing folder before spawning. node-pty's prebuilt `spawn-helper` ships without its execute bit; the worker sets it. `asarUnpack` carries node-pty. | Unit tests 10/10; the ownership live test passes on this Mac. |
| B | **The emulator.** xterm.js 6 with fit, search, web links and Unicode 11, the DOM renderer (the WebGL addon drew at the wrong scale under Electron on this Mac, so it is out). The theme follows the app's light/dark palette and re-themes live. ⌘F opens a find bar (Enter / Shift+Enter step, Escape returns to the shell); ⌘K clears; a mouse selection lands on the clipboard. The assistant's Bash commands in the chat mirror into the tab as before. Start/Restart and Clear in the path bar. | The journey's terminal step and the tour pass. |
| C | **Ghostty.** ghostty-web 0.4.0 (coder's build of Ghostty's VT core to WebAssembly with an xterm-compatible surface), chosen in Settings › General › Terminal, loaded only when chosen, falling back to xterm.js when it cannot load. Three things had to be learned: it fetches its WebAssembly from a `data:` URL, which the renderer's CSP refuses — the engine answers that fetch from memory and the CSP now allows `wasm-unsafe-eval` (WebAssembly compilation, not JavaScript eval); it reads `attachCustomKeyEventHandler`'s answer the opposite way from xterm.js (true means "handled, swallow"), so the tab hands each engine its own idiom; it has no search addon, so Find is absent on that engine. | The same tour passes on ghostty. |
| D | **Windows.** The ownership live test and the journey with the pty worker on the owner's machine: PowerShell through ConPTY inside the owned Job (conhost descends from the worker), resize, colours, a verified stop. | The owner's check when the machine is back (~2026-10-05). |

## Evidence (this Mac, Electron from source, the login shell of this account)

The tour `app/tests/terminal.live.mjs [--engine ghostty]` proves nine things per engine: the shell opens in the chat's folder on the chosen engine; `TERM=xterm-256color` and `tput cols` answers with the pane's width; the pty follows a resize (56 → 35 columns on xterm.js, 51 → 31 on ghostty); a prompt that reads input (`printf 'name? '; read n`) is answered as it waits; an ANSI red sequence renders as colour; `less` takes the alternate screen and `q` gives the main screen back; ⌘F opens find (xterm.js) or Find is recorded absent (ghostty); the assistant's commands mirror into the tab; Restart stops with verification and opens a new shell.

- xterm.js: `evidence/C090/live/2026-10-03T16-34-06-815Z-terminal-xterm/` (result.json, three screenshots)
- ghostty: `evidence/C090/live/2026-10-03T16-32-20-666Z-terminal-ghostty/` (result.json, three screenshots)
- `app/tests/terminal-ownership.test.mjs` 10/10 (the UI test now drives a fake emulator through the same surface: keystrokes to the live session, stale output dropped, keystrokes without a shell dropped, input blocked while a shutdown is unverified)
- `app/tests/terminal-ownership.live.mjs` passes (descendants closed on profile switch, on a killed app and on quit; a stopped shell is started explicitly; the legacy launch runs a command)
- `app/tests/run.mjs` 76 checks (the terminal step types into the emulator and reads its buffer)

## Limits

- One Mac. Windows (ConPTY, the Job containing conhost, `pwsh` detection) is unrun until the owner's machine returns.
- The tour types only once the prompt shows: keystrokes before the shell is ready meet the tty's own echo and zsh's redraw, as in any terminal.
- The ghostty canvas clips its last column slightly at the pane's right edge; Find is absent there; its WebAssembly (≈400 KB, base64 inside the bundle) loads only when chosen.
- The tab no longer keeps a command draft per tab: a half-typed line lives in the shell's line editor, as it does in a terminal.
- Three dependencies entered: node-pty (MIT, prebuilt native code for darwin/win32 arm64/x64), @xterm/xterm and addons (MIT), ghostty-web (MIT). Their notices ride with the app's existing dependency licensing.

## Task board (Guerrilla, `bp -s Guerrilla task …`)

Parent `task-a75334fdb1e798ef`; A `task-060949d501edeab7`, B `task-1bd13cbabf7a820c`, C `task-a14be84d3826d268`, D `task-db0a2a496b79a20f` (the owner's). Worker `claude-barkdown-c090`.

## Next

Windows proof (D). Then C089's owner items: a working day in the browser and the two desktop bench columns.
