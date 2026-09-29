# Legacy retirement: what remains and what removing it takes

Status: audit, 2026-09-29. Nothing here is removed yet. Retirement needs the user's go and the real-library review on Windows ([A2](../ACCEPTANCE.md#a2--one-engine-without-lost-notes)); the switch, rollback, interruption and reconciliation it depends on are rehearsed on macOS ([C083](../cycles/C083-writer-admission.md)).

## What "legacy" is today

| Piece | Where | Size | Used by |
|---|---|---|---|
| Separate editor (Tiptap) | `app/renderer/src/tabs/document.js`, eight `@tiptap/*` packages | 355 lines | `renderer/src/index.js` only |
| Local document store | `app/main/documents.js` | 280 lines | `main.js`, `mcp-server.js`, `agent-edits.js`, `agent.js` |
| Its IPC | 15 `docs:*` channels in `main.js` | | renderer, 15 call sites |
| Agent tools on local documents | the non-`bp:` branches of `read_document`, `edit_document`, `create_document`, `edit_table` in `mcp-server.js` | | every provider |

## Where legacy is still the live path

1. **Launches without `--profiles`.** Profiles mode is opt-in by flag; an ordinary launch still runs the single legacy library.
2. **Profiles without the local runtime.** New page falls back to `docs.create` unless the profile has its managed runtime enabled.
3. **Profiles that have not switched.** Everything before the switch is legacy by definition.

On a switched profile legacy is already closed: the store refuses writes (`BARKDOWN_NOTES_ON_PAPER`), New page creates a Paper, retained originals open read-only with a lock, and the assistant edits Papers.

## What must stay after retirement

- The backup, the retained legacy workspace and the selection journal: rollback restores from them and needs no editor.
- A reader for retained originals and their history (`original-history.js`, `docs:get`, `docs:list`, `docs:history`), and Markdown export.
- Adoption of a pre-profile library (`adoption-*.js`, `legacy-authority-adoption.js`): it is how an old library reaches a profile at all.

## Stages

| Stage | Change | Depends on |
|---|---|---|
| R0 (now) | Nothing removed. Switched profiles cannot write legacy. | done |
| R1 | Retained originals render read-only without the editing surface (no toolbar, no input rules, no save path); the Tiptap editing extensions leave the bundle. | a read-only renderer for the legacy Markdown |
| R2 | Profiles mode becomes the default launch; an ordinary launch adopts the old library into a profile. | the adoption tours on every host |
| R3 | A new profile starts with its managed runtime on, so New page is always a Paper. | the packaged runtime ([A5](../ACCEPTANCE.md#a5--install-and-daily-use)) |
| R4 | The legacy write paths go: `docs:create`, `docs:save`, `docs:delete`, `docs:restore`, `docs:proposal`, the local branches of the agent tools, the local branch of `agent-edits.js`. | R1 to R3, every profile switched or exported, the real-library review |

## Open questions for the user

- How long does rollback stay available after a switch? Rollback needs the retained store, not the editor, so R1 to R4 do not shorten it; deleting retained originals would.
- Pre-existing cloud references stay unowned after a switch and are refused by owned navigation ([C083](../cycles/C083-writer-admission.md)). Retirement makes that the only behavior a person sees, so it should be decided first.
