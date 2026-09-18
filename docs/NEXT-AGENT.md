# Next-agent handoff

## What you are continuing

Build Barkdown: an app-wide desktop workspace that combines ChatGPT-like conversation with Notion-like editing, powered by Barkpark's structured content and a T3-derived agent runtime. The user wants to see agents open sources and make edits while remaining able to take over directly.

This repository delivers a working **concept**, not the desktop application. Preserve the interaction decisions while replacing the simulation with real execution and storage.

Read in order: [README](../README.md), [decisions](DESIGN-DECISIONS.md), [PRD](PRD.md), [architecture](ARCHITECTURE.md), [source map](SOURCE-MAP.md), [acceptance](ACCEPTANCE.md). The proposed [TypeScript contracts](contracts/workspace.ts) make the intended state ownership explicit. They are not upstream schemas.

## The correction most likely to get lost

**The program is not inside a folder. The agents are.**

Documents and recent chats remain available across the app. A chat retains its agent's execution context. The working-folder control lives beside the composer. Opening a project editor is a local action in that chat, and viewing another file does not change the agent's execution folder. A running task retains the context captured at launch even if the foreground chat changes.

There is no requirement that a content-only chat or direct document view have a local filesystem project. In the current demonstration, all example chats use different folders of a single sample project; the production model must support independent projects/environments and no-folder conversations.

## Status: Electron prototype delivered (branch `codex/electron-prototype`)

`app/` now holds a runnable desktop app that replaces most of the concept's simulation with real behaviour: a local document store with Tiptap editing, revisions, references and backlinks; an `@anthropic-ai/sdk` streaming tool loop whose document edits are proposals and whose file writes need approval; per-chat working folders with confined file access, a CodeMirror project editor and `git diff` reviews; `<webview>` website tabs; side chats with their own runs; persisted workspaces, pins and quick open; and a read-only Barkpark adapter (HTTP or through the `bp` CLI) that lists papers in the library and imports them as local copies. The assistant runs on the sign-ins already on the machine, as T3 Code does: Claude Code through the Claude Agent SDK (approval cards for edits and commands, per-chat session resume) and Codex through the Codex SDK (sandboxed to the working folder), both with Barkdown's document tools attached as a stdio MCP server; an API key remains the fallback. Both providers were exercised live from this machine. Barkpark papers now open in the real `<bp-paper-canvas>` (vendored from the reviewed checkout) with edits applied through the fenced ops endpoint under `ifRev`, acknowledged saves, server echo write-back, and a conflict card on 412; agent proposals on papers (`bp:<slug>`) are applied as ops when kept. That meets milestone B for prose blocks on a live server (verified with `npm run test:paper` against the scratch paper `barkdown-editor-test`), inside Barkdown's Electron shell rather than a T3-derived one; local documents still use Tiptap 3. Verification is `cd app && npm test` (scripted-client agent checks plus 23 Playwright checks against the real Electron window). What remains simulated or absent is listed in [app/README.md](../app/README.md): no T3 runtime import, Tiptap instead of `bp-paper-editor`, Barkpark writes fenced and off by default, in-memory unsaved file buffers, unsigned packaging. The milestone below is therefore met for the editor slice: a real Barkpark Paper is mounted in the upstream canvas, edited, saved with an acknowledged revision, and reopened inside a desktop shell.

## First 20 minutes

1. Run `npm ci`, `npx playwright install chromium`, and `npm run verify`.
2. Open `preview/index.html`. Inspect the wide chat and work tabs. Switch recents. Edit a document. Start the simulated AI walkthrough, manually choose a tab, and confirm focus stops moving.
3. Open the composer's folder control, then the project editor. Edit a file, switch files, and return. Create a chat in that folder and verify the original draft survives. Restore a pin.
4. Open `preview/editor.html`. Select document text and use the attached Types submenu. This study supplies the richer editing interactions absent from the current shell's simplified editor.
5. Review the exact scope and known limitations below before choosing a runtime integration approach.

## First implementation milestone

Deliver **one real Barkpark Paper inside a T3-derived desktop shell**, with acknowledged saves and correct agent context. Keep the milestone small enough to verify before widening the product.

### A. Establish an auditable upstream baseline

- The source map records T3 reference commit `4749035bda13b4b6260499caedbc0d69a2f60e6f` and Barkpark reviewed commit `88280ee4306baa911a3cfd0c33b04f44ee71d427`. Barkpark main was newer at handoff; see the recorded observation.
- Inspect upstream instructions, manifests, licenses, desktop startup, client/runtime ownership, provider adapters, and environment authentication. Select the import commit deliberately and record it.
- Keep this repository private. Importing upstream code is separate from creating a public GitHub fork. Preserve this handoff history, documentation, and reference concepts. Do not overwrite the initial commit or force-push main.
- The candidate T3 manifest requires Node `^24.13.1` and `pnpm@11.10.0`; the handoff's Node 22/npm tooling does not establish compatibility for the runtime.
- Use a `codex/` implementation branch. If the sibling Barkpark repository needs changes, use its own authorized worktree and follow its instructions; its shared main checkout must stay on main.

### B. Mount the existing Paper editor

- Read Barkpark's editor embed contract and host implementation. Reuse `bp-paper-canvas` / `bp-paper-editor`, their actual block conversions, identity preservation, flush/acknowledgement behavior, and revision checks.
- Establish a small adapter that reads a scoped real Paper, mounts the editor with its current revision, applies valid operations through the authoritative Barkpark boundary, and updates the saved-state indicator only on an acknowledged result.
- Exercise a paragraph, heading, list, reference, and media/opaque block. Unsupported content must survive unchanged with a clear read-only fallback.
- Edit, save, unmount, and reopen. Verify equivalent structured content and stable IDs, not just similar HTML.
- Introduce a stale revision and a second update. Surface the conflict while retaining the user's unsaved draft. Do not force-write or silently replace it.

### C. Establish navigation and run ownership

- Implement app-wide navigation separately from each chat's workspace and optional agent execution context.
- Start with a document tab and project-editor tab; use typed descriptors so websites, reviews, and side chats can be added without changing identity semantics.
- A run event carries its originating chat/agent/run and target. Route it to that chat even while another chat is visible. Manual browsing pauses focus changes.
- Prove chat A with folder A, chat B with folder B, direct document mode, and a no-folder chat are independent. Pins restore navigation only.

### D. Exit evidence

Provide the chosen upstream commits, changed source modules, a runnable desktop route, screenshots of the actual integration, and results for read/edit/save/reopen, stale revision, background ownership, and restart recovery. If an upstream contract blocks this slice, record the exact missing seam and a small adapter change; do not mask it with fixture responses.

## Exact concept code map

All functions below are in `concepts/workspace.html`, scoped by `#bd-worktabs` and an IIFE. The code is deliberately compact and contains later function wrappers; read final assignments before changing it.

| Symbol | Responsibility / production replacement |
|---|---|
| `contexts`, `ctx()`, `current` | In-memory chat workspaces. Replace with persisted chat IDs/state and per-agent contexts. |
| `newTab`, `renderTabs`, `openTab`, `focusTab` | Typed work-tab creation and focus; preserve stable IDs and ownership. |
| `savePosition` | Chat/work scroll, side-chat draft, composer draft, file caret and scroll. Do not remount over unsent input. |
| `documentMarkup`, `docs` | Simplified contenteditable fixture. Replace with the real Paper editor and scoped addresses. |
| `runDemo` | Four scripted events: website, document proposal, review, project file. Captures owner chat; replace timers with authoritative activity events. |
| `pauseFollow`, `closed`, `following` | Manual navigation pauses focus; deliberately closed targets stay closed during the demo. Production suppress by stable target identity, not only tab type. |
| `addPin`, `renderPins`, restore handler | Navigation snapshot; persists only in memory. Production needs versioned storage, permission rechecks, and unavailable destinations. |
| `project`, `exampleFiles`, `fileState` | One sample project and editable in-memory buffers. Never treat these fixtures as filesystem access. |
| `projectMarkup`, `treeMarkup`, `openProject` | Project file tab, file tree, expand/return layout. Replace textarea with audited file-editor host if appropriate. |
| `contextLabel`, `renderProjectContext`, `projectMenu`, `placeProjectMenu` | Agent folder control; app-wide recents; attached composer menu. There is no sidebar folder picker. |
| `startFolderChat` | Creates new chat with folder context; preserves original state and draft. |
| `setChatWidth`, `#bw-splitter` | Adjustable 60/40 split with drag, arrow keys, and double-click reset (D07). Production should persist the width per window and keep the 40–70% range. |
| `collectPalette`, `renderPalette`, `openPalette` | Ctrl+K quick open built from the current navigation state (D23). Replace the fixture index with permission-scoped Barkpark search and typed targets. |
| `sideChatMarkup`, `sideMessages`, `sideDrafts` | Separate conversation surface and drafts with inherited working context. Responses are scripted. |

In `concepts/editor-study.html`, inspect `editorState`, `addBlock`, `showBlockMenu`, and `attachTypeMenu`. The last two preserve the selected block and keep Types attached to the formatting menu. Also inspect the inline change Keep/Undo behavior as an interaction reference. Production undo must use actual authorized Barkpark receipts and native text history, not the fixture's reversals.

The previous session's one-time migration scripts and stale extension chunks were deliberately not included. Only the resulting authoritative concepts, repeatable builders, checks, and documentation belong in this handoff.

## What works in this handoff

- Mixed tabs and per-chat restoration; direct document view; internal document paths.
- Local document/file edits, side-chat replies, drafts, caret/scroll, review marking, pin restoration.
- Composer-local agent folder actions; expanded project editor; new chat in a folder; side-chat folder inheritance.
- Scripted AI activity that retains its owner, respects manual focus, preserves drafts, and can reopen its exact file target when explicitly requested.
- The separate editor study's block insertion/formatting, selection menu, attached Types submenu, and inline change demonstration.
- Responsive examples down to 320px without page overflow; no visible scrollbar tracks or vertical collapsed-pane rails.
- Adjustable chat/work split (drag, keyboard, double-click reset), Ctrl+K quick open across tabs, documents, chats, and actions, Alt+digit/Alt+W/Alt+N shortcuts, middle-click close, Enter to send, a working indicator during runs, and an unsaved-draft marker on the project tab. Quick open indexes fixture navigation, not Barkpark search; the split width is not persisted.

## Known limitations to replace, not hide

- No persistence after reload. No authentication, native desktop shell, provider process, filesystem read/write, Git operation, live search, or connected Barkpark mutation.
- Website tabs validate and retain addresses but show a local illustration, not a loaded website. Code reviews are example diffs.
- The main concept's Paper content is plain fixture data and `contenteditable`, not Tiptap or PortableDoc. The editor study is also a simulation, not the production editor.
- The project model assumes one example project; buffers are keyed only by relative filename. Production buffer keys must include environment, checkout, and file identity.
- Chat folder fields in the demo stand in for agent-session ownership. Production supports optional context and multiple agents/runs without a shared cwd.
- Pin snapshots use an in-memory clone of fixture navigation. Do not clone transcripts, dirty buffers, secrets, or historical file text into production pins.
- Focus suppression uses tab types in the demo. Multiple tabs of the same type need stable target keys in production.
- Closing a tab does not implement production unsaved-buffer recovery or a save prompt policy. Recover unsaved data through the durable buffer store.
- All automated results here prove the concept and handoff, not backend security, production editor fidelity, or full assistive-technology compatibility.

## How to finish future work

Update the PRD source and regenerate it when behavior or scope changes. Keep the decision record current, preserve the concept as a reference, and add meaningful integration tests for real boundaries. Report what became real, what remains simulated, the commands run, the verified upstream versions, and the next milestone. Do not call the whole desktop app complete after the first connected Paper works.
