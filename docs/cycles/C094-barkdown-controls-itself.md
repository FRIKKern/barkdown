# C094 — Barkdown controls itself

**Why.** The owner's words: an incredible CLI API for controlling the Barkdown app itself; a "Full YOLO" check in Settings that lets it control every part of Barkdown, turning things on and off and changing settings; the one thing Barkdown may not do is turn Full YOLO on or off itself. Everything a person can do should be reachable from the command line, so Barkdown can add agents, create notes and use itself as a person does.

**The shape.** One catalogue of commands, one gate, two callers.

```
 barkdown CLI ──► pointer file ──► private socket + token ─┐
 (main/cli/barkdown.js, control-client.js)                 ├─► gate (main/control.js) ─┬─► main handlers: status, settings get, profiles, library
 assistant's app tool ──► the run's browser bridge ────────┘   tiers, Full YOLO,        └─► the window (renderer/src/control.js):
 (main/browser-mcp.js: app, app_commands)                      the never-list, the log       the same functions a click calls
```

- **Catalogue** (`app/shared/control-commands.js`): 44 commands in three tiers. *read* looks. *act* is a person's everyday work: chats, messages, notes, tabs, the terminal, favorites. *admin* is settings, profiles, deletions, the library and update checks, and needs Full YOLO.
- **Gate** (`app/main/control.js`): checks the token, the tier, the arguments, and a never-list (`fullyolo.*`, `app.quit`, `app.relaunch`, `app.start`, `updates.install`). Settings that are secrets, the runtime path, or the switch itself are never written. Everything that changes something is logged in `control-log.jsonl` with who asked (`cli` or `assistant`).
- **Full YOLO**: a switch in Settings › Assistant. It has its own request to the main process (`control:setFullYolo`); `settings:set` ignores it and no command handler calls it. The main process holds it in memory, reads it once at launch from a value sealed with the system keychain (`control-settings.json`), so editing a file while the app runs changes nothing.
- **The command**: the app writes `<userData>/bin/barkdown` (and `.cmd`) at start, running the CLI on the app's own runtime, so no Node is needed. Barkdown's terminal tabs have it on their path and know which app they belong to (`BARKDOWN_CONTROL`). `barkdown` alone prints every command; `barkdown help <command>` one in full; `--json` gives programs the raw answer; text takes `-` (standard input) and `@file`. Exit codes: 0 done, 1 failed, 2 usage, 3 not running, 4 refused (Full YOLO needed, or never allowed).
- **An agent is a chat.** `barkdown agent add "Title" --folder … --message … --wait` starts one and prints its reply. An assistant doing the same through its `app` tool gets a helper; the helper does not take the person's view. A command that takes a chat defaults to the caller's own chat for an assistant, and to the chat in view for the CLI.
- **Notes** are created with their text in one step (`barkpark:createNoteWith`, the same owned draft store as the New page button), opened beside the chat and placed in Pages.

## Evidence

| What | Result | Where |
|---|---|---|
| The gate, the client and the CLI, without Electron | 6 tests pass | `app/tests/control.test.mjs` (in `npm test`) |
| The real app driven by the `barkdown` launcher, replies scripted | 13 checks pass | `evidence/C094/live/2026-10-04T20-32-54-931Z-control/` (`result.json` holds every command and its answer) |
| Real Claude Code inside Barkdown using the `app` tool | 4 checks pass | `evidence/C094/live/2026-10-04T20-35-32-763Z-agent-control/` |

The scripted tour: status and the overview; `agent add` with a folder and a first message, reply read back; `chat send`, `read`, `list`, `set`, `rename`; `note new` with text, `read`, `list`, `page`; `tab open`, `activate`, `rename`, `list`, `close`; `favorite add`; `terminal run` and `read`, including `barkdown status` typed inside the app's own terminal; settings, profile creation and chat deletion refused without Full YOLO; the switch clicked in Settings; the same commands working; the switch, quit, relaunch, update install and a secret refused with Full YOLO on; the assistant's `app` tool over the real bridge; the switch clicked off and both callers refused again; the log naming who did what.

The real assistant: it started a chat titled "Helper from Claude", the helper answered PONG, and the first assistant reported it while the person's view stayed put. Asked to change the theme, it was refused and passed on the reason. After the switch was clicked on, it changed the theme. Asked to switch Full YOLO off and to quit, it was refused both and said so.

## Limits

- Proven on this Mac from source. The packaged app writes the same launcher against its own executable; that path is first exercised by the nightly's tours, and Windows (named pipe, `barkdown.cmd`) has not run.
- The real-assistant proof is Claude Code, one run per prompt. Codex gets the same tools and instruction line; not run.
- Full YOLO survives a restart only when the system keychain is available; otherwise it lasts until the app closes, and the toast says so. A process running as the person with keychain access, or a person-approved restart after a replayed file, is outside what the seal protects against.
- Not in the catalogue yet: export and import of a profile, the Paper migration switch, sign-in to a provider, goals, deleted-note recovery, attaching images to a message, and editing a note's text in place (assistants edit notes with their document tools; the CLI can create and read). Website tabs are driven by the assistant's browser tools, not by `barkdown`.
- `barkdown` outside the app's terminal needs the launcher's full path (Settings › Assistant shows it); nothing is installed on the system path.
- The migration estimate in `docs/PLAN.md` was reviewed and is unchanged: this cycle is outside that scope.

## Task board

`task-67f2f1837af71e6d` on Guerrilla, worker `claude-barkdown-c094`.

## Next

Delivery: pictures, check, push, chain, nightly. Then the owner's call: widen the catalogue (the list under Limits), put `barkdown` on the system path at install, or return to C089's owner items.
