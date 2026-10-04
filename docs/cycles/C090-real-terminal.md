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
| B | **The emulator.** xterm.js 6 with fit, search, web links and Unicode 11, the DOM renderer (the WebGL addon drew at the wrong scale under Electron on this Mac, so it is out). The theme follows the app's light/dark palette and re-themes live (the colours handed to the emulator are plain hex: the app's text colour is a `light-dark()` expression, which xterm.js cannot parse and silently replaced with white, unreadable on the light background until the tour ran in light mode too). ⌘F opens a find bar (Enter / Shift+Enter step, Escape returns to the shell); ⌘K clears; a mouse selection lands on the clipboard. Off macOS the keys follow Windows Terminal: Ctrl+V and Ctrl+Shift+V paste, Ctrl+C copies when text is selected and interrupts when none is, Ctrl+Shift+C always copies; on macOS ⌘C and ⌘V stay the system's own. The assistant's Bash commands in the chat mirror into a strip of their own under the terminal ("Assistant ran", collapsible, clearable): the shell's screen belongs to the shell. Written into the emulator they were overwritten by the shell's next output on Windows (ConPTY keeps its own model of the screen) and would scribble over a full-screen program anywhere. Start/Restart and Clear in the path bar. | The journey's terminal step and the tour pass. |
| C | **Ghostty.** ghostty-web 0.4.0 (coder's build of Ghostty's VT core to WebAssembly with an xterm-compatible surface), chosen in Settings › General › Terminal, loaded only when chosen, falling back to xterm.js when it cannot load. Three things had to be learned: it fetches its WebAssembly from a `data:` URL, which the renderer's CSP refuses — the engine answers that fetch from memory and the CSP now allows `wasm-unsafe-eval` (WebAssembly compilation, not JavaScript eval); it reads `attachCustomKeyEventHandler`'s answer the opposite way from xterm.js (true means "handled, swallow"), so the tab hands each engine its own idiom; it has no search addon, so Find is absent on that engine. | The same tour passes on ghostty. |
| D | **Windows.** An on-demand job on a hosted Windows runner (`.github/workflows/terminal-windows.yml`): node-pty spawning PowerShell through ConPTY under Electron's node, the ownership unit tests, the ownership tour in the real app, and the interactive tour in PowerShell on both engines. | Green at `be728eaf` ([run](https://github.com/FRIKKern/barkdown/actions/runs/37162736078)). |

## Evidence

**macOS (this Mac, Electron from source, the login shell of this account).** The tour `app/tests/terminal.live.mjs [--engine ghostty] [--theme light]` passes eleven checks on each engine in each theme: the shell opens in the chat's folder; `TERM=xterm-256color` and the shell's width is the pane's; the pty follows a resize; a prompt that reads input is answered as it waits; ANSI red renders as colour; Ctrl+C interrupts a running `sleep`; `less` takes the alternate screen and `q` gives it back; ⌘F finds (xterm.js); the assistant's commands show in the strip and survive the shell's next output; both themes are readable (xterm.js repaints live; a Ghostty tab keeps the theme it opened with); Restart stops with verification and opens a new shell.

- `evidence/C090/live/2026-10-03T23-42-46-938Z-terminal-xterm/`, `…T23-42-56-263Z-terminal-ghostty/`, `…T23-43-11-345Z-terminal-xterm-light/`, `…T23-43-04-057Z-terminal-ghostty-light/`
- `app/tests/terminal-ownership.test.mjs` 10/10 (a fake emulator through the same surface: keystrokes to the live session, stale output dropped, input blocked while a shutdown is unverified, the mirror strip, the Windows copy and paste keys)
- `app/tests/terminal-ownership.live.mjs`, `app/tests/profile-preparation.live.mjs` and `app/tests/run.mjs` (76 checks) pass
- Delivered in [v0.6.0-nightly.20261003.3](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261003.3): chain receipt `.release/chain/b684800f….json`. The packaged app's terminal was proven against the earlier nightly's `Barkdown.app` with the ownership tour.

**Windows (a hosted windows-latest runner, Electron from source, PowerShell 7 through ConPTY).** [Run 37162736078](https://github.com/FRIKKern/barkdown/actions/runs/37162736078) at `be728eaf`, files in `evidence/C090/windows/37162736078/`:

- node-pty spawns PowerShell through ConPTY under Electron's node; the ownership unit tests pass 10/10.
- The ownership tour in the real app (`log.txt`, `manifest.json`, five frames and a desktop screenshot): a command starts its descendants, a profile switch stops A and refuses the foreign session, B gets its own shell, a killed app is verified closed at restart, an explicit start runs a command once, an ordinary quit and the legacy launch finish; five owned workers verified stopped.
- The interactive tour, thirteen checks on each engine (`tour-xterm-dark/`, `tour-ghostty-dark/`): `Read-Host` answered live, `[Console]::ReadKey` taking one key, `Write-Host` colours, the window width following a resize, Ctrl+C on `Start-Sleep`, Ctrl+V from the clipboard (xterm.js), the alternate screen through ConPTY, find, the mirror strip, themes, restart.

What Windows taught, all fixed or recorded: ConPTY clears the screen at shell start (tests wait on the session and the prompt, not the tab's first line); it keeps its own model of the screen (the mirror moved to its strip); a narrow pane wrapped lines the text read used to break; Playwright's page never answers on a runner when video recording is on (the tours leave it out there, print their failure before cleanup, log each step and exit explicitly).

## Limits and polish list

- The Windows proof is a hosted runner running from source: not the packaged app, not the owner's machine, and no Windows nightly exists.
- On Windows the Ghostty engine does not paste with Ctrl+V (the pty answered a single `p`); xterm.js, the default, does.
- A Ghostty tab keeps the theme it opened with and has no Find; its canvas clips its last column slightly at the pane's right edge. Its WebAssembly (≈400 KB, base64 inside the bundle) loads only when chosen.
- On Windows a grey scrollbar track shows at the terminal's right edge (seen in the runner's frames; not yet styled away).
- The Windows copy keys (Ctrl+C with a selection, Ctrl+Shift+C) are unit-tested only; Ctrl+V is proven in the real app.
- The tab keeps no command draft: a half-typed line lives in the shell's line editor.
- Three dependencies entered: node-pty (MIT, prebuilt native code for darwin/win32 arm64/x64; the Mac build does not rebuild native modules), @xterm/xterm and addons (MIT), ghostty-web (MIT).

## Task board (Guerrilla, `bp -s Guerrilla task …`)

Parent `task-a75334fdb1e798ef`; A `task-060949d501edeab7`, B `task-1bd13cbabf7a820c`, C `task-a14be84d3826d268`, D `task-db0a2a496b79a20f`, all closed with evidence. Worker `claude-barkdown-c090`.

## Next

C090 is delivered. The polish list above has no gate. Then C089's owner items: a working day in the browser and the two desktop bench columns.
