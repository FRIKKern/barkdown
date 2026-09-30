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
| R0 | Nothing removed. Switched profiles cannot write legacy. | done |
| R1 (done 2026-09-30, C087) | Retained originals render read-only without the editing surface. The Tiptap packages leave with R4. | `shared/doc-html.js` |
| R2 (done 2026-09-30, C087) | Profiles are the ordinary launch; a legacy library is offered for adoption at launch. | the launch rehearsal; Windows not yet |
| R3 (done 2026-09-30, C087) | A new profile starts on the carried or remembered runtime, so New page is a Paper. | [C086](../cycles/C086-packaged-runtime.md) |
| R4 (done 2026-09-30, C087) | The legacy write paths refuse; the legacy tab is read-only; the Tiptap packages are gone. The real-library review on Windows is still owed. | R1 to R3 |

## Answered by the user (2026-09-30)

- Rollback stays available as long as the retained originals exist; retirement does not shorten it.
- Pre-existing cloud references stay references and are not given the local owner ([D-cloud-references](../DESIGN-DECISIONS.md#d-cloud-references--a-reference-to-the-cloud-stays-a-reference-a-copy-is-ours-2026-09-30)).
- Retirement is a go ([D-legacy-retirement](../DESIGN-DECISIONS.md#d-legacy-retirement--go-2026-09-30)); the packaged runtime R3 depends on exists on macOS ([C086](../cycles/C086-packaged-runtime.md)).
