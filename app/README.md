# Barkdown desktop

The working Electron application: notes and conversations on the left, agents and their work alongside them. [Product overview](../README.md) · [Active roadmap](../docs/PLAN.md) · [Contributing](../CONTRIBUTING.md)

## Run and verify

From the repository root:

```sh
npm --prefix app ci
npm run desktop
npm run test:desktop
```

From `app/`, `npm start` builds and launches; `npm run dev` also opens DevTools. Requires Node 22.13+ and a desktop session. Install Playwright Chromium from the root before the Electron test suite. Live runtime/editor suites have additional prerequisites in [validation](../docs/VALIDATION.md).

## What runs today

| Surface | Implementation |
|---|---|
| Notes | Real Barkpark Paper canvas, PortableDoc ops, acknowledged save, revision conflicts, server echo and guarded assistant Undo. Legacy local documents still use a separate Tiptap store until migration. |
| Conversations | Shared main/side composer, provider/model/effort controls, images, 100-message recall, independent drafts and saved parent links. |
| Workspaces | Per-chat working folders and tabs for notes, project files, websites, terminal, reviews and side chats. Favorites reopen individual destinations. |
| Pages | Human-controlled nesting and order. Cloud discovery stays in Cloud archive; opening a paper does not place it. |
| Agent work | Document read/search/create/direct-edit tools, visible activity, revision checks and Undo. File/command permissions retain their provider-specific boundaries. |
| Local runtime | Opt-in Windows source launcher with private PostgreSQL, health checks, bounded recovery and shutdown. Requires a built Barkpark checkout; not a bundled installation. |

## Providers

| Provider | Connection | Execution boundary |
|---|---|---|
| Claude Code | Existing local login, Claude Agent SDK | Per-chat sessions and folder; approval handling for file edits/commands |
| Codex | Existing local login, Codex SDK | Per-chat sessions; sandboxed to the captured folder, read-only without a folder |
| Claude API | Key in Settings or environment | Barkdown's streaming tool loop and tool approval handling |

No-folder conversations remain valid. A folder selected in the composer never scopes the global sidebar. Side chats inherit settings once and may change them independently.

## Source map

| Directory/module | Owns |
|---|---|
| `main/main.js`, `preload.js` | Native window, settings and IPC boundary |
| `main/store.js`, `documents.js`, `conversations.js` | Existing persistence; P1’s ownership inventory starts here |
| `main/local-barkpark*` | Private runtime lifecycle and Windows source bootstrap |
| `main/barkpark.js`, `canvas-bundle.js`, `agent-edits.js` | Barkpark adapter, editor delivery and edit receipts |
| `main/providers/`, `agent.js`, `mcp-server.js` | Provider orchestration and document tools |
| `renderer/src/state.js`, `index.js`, `composer.js`, `tabs/` | Workspace state, shared composer and tab hosts |
| `shared/` | PortableDoc/Markdown and operation helpers |
| `tests/` | Unit, Electron and live adapter/editor checks |

The canvas loads from the connected Barkpark, with cached and vendored fallback. The recorded fallback baseline is Barkpark commit `a5440345c`; upstream PR #19579 was still open at the roadmap reset. [The parity matrix](../docs/EDITOR-PARITY.md) carries the exact proof and limitations. Preserve vendored licenses.

## Remaining work

P1–P5 deliver profile isolation, migration to one editor, interruption recovery and portability, optional sync, and clean-machine installation. Unsaved project buffers are still session memory. The Windows runtime is a source-checkout integration; forced-desktop termination, packaged installation and other platforms need further proof. Existing passing tests do not establish multi-profile or sync behavior.

Use [the local-runtime guide](../docs/LOCAL-BARKPARK.md) for setup and [the acceptance scenarios](../docs/ACCEPTANCE.md) to decide when a stage is complete. The prototype uses direct provider adapters; no T3 runtime import is claimed.

## Visual health by area

- [Workspace navigation](../docs/visual/workspace/README.md): renderer shell, sidebar, tabs and quick open.
- [Main chat](../docs/visual/chat/README.md) and [side chat](../docs/visual/side-chat/README.md): shared composer and conversation controls.
- [Local documents](../docs/visual/documents/README.md): the legacy editor retained pending P2; live Paper evidence remains in the root gallery.
- [Paper save safety](../docs/visual/paper-save/README.md): retained drafts during delayed writes, navigation and close, server-backed Undo/redo, Retry and explicit discard. Run `npm run test:paper-host` in `app/` for controlled host races; `npm run test:paper-host:isolated` adds a disposable real server (set `BARKDOWN_TEST_BP_SOURCE` to a built checkout).
- [Settings](../docs/visual/settings/README.md): preferences and connection controls.

Each page contains a still, recorded interaction GIF, provenance and changelog. [Rules and coverage limits](../docs/visual/RULES.md) distinguish visual review from functional/runtime proof.

### Editor takeover health � E002

[Reviewed real Paper motion, narrow receipt and evidence](../docs/visual/agent-takeover/README.md): guarded acceptance preserves acknowledged agent text and immediate human input; first Undo receipt keeps document geometry stable. Requires upstream bb3bd299d; older bundle retains safe reload fallback. See handoff for baseline test limits.


## Editor change record - 2026-09-22

E003 preserves selected text across agent mark/link and same-structure list/table updates in the real canvas. Basic rich table Markdown replacement now emits actual table blocks; unsupported conversion refuses before writing. Documents with unsupported Markdown exports stay readable as structured blocks. [Visual health and motion](../docs/visual/rich-takeover/README.md) and [validation](../docs/cycles/E003-rich-content-takeover.md). Requires upstream8530a9e23 for new selection mapping; default older bundle remains guarded.


## E004 structured table checkpoint

Revision-checked cell patches and exact structured reads preserve headerless/multiline/alignment metadata. Three real Paper MCP cases pass Undo, human save and reload; full app suite and focused upstream rich/header checks pass. See [E004 evidence](../docs/visual/structured-table/README.md). API parity is separate root E005 work; upstream full-suite baseline failures and default bundle pin remain explicit limits.
