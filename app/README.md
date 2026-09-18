# Barkdown desktop (Electron prototype)

A working desktop app for the Barkdown product: app-wide documents and conversations on the left, a real assistant in the middle, and typed work tabs on the right. Agents work in folders; the app does not.

## Run it

```sh
cd app
npm install
npm start
```

`npm run dev` opens DevTools as well. Requires Node 22.13+ and a desktop session (Electron 38).

Add a Claude API key under **Settings** (Ctrl+,) or export `ANTHROPIC_API_KEY` before starting. Without a key the assistant runs in offline mode: it still opens the documents, websites, files and reviews you name, and explains that reasoning needs a key.

## What is real

| Area | Implementation |
|---|---|
| Documents | Local library in the Electron userData folder (`documents/*.json` plus a `.md` export). Tiptap block editor with slash commands, an attached Types submenu, links, task lists, autosave with revision history, optimistic-rev conflict handling, references, backlinks, related documents, restore. |
| Assistant | `@anthropic-ai/sdk` streaming tool loop in the main process (`main/agent.js`, default model `claude-opus-5`). Tools: list/search/read documents, propose document edits (kept or discarded by you), create documents, open websites (fetches readable text), list/search/read files, write files (approval gate), git diff. Each run captures its owner chat and folder; activity events route to that chat's work tabs and respect manual focus. |
| Working folders | Per chat, chosen from the composer. File access is confined to the folder (`main/files.js`). Project editor uses CodeMirror 6 with session buffers, Ctrl+S, and disk-change detection. |
| Code review | `git diff` of the working folder (working tree vs HEAD, or against a chosen commit), rendered per file with hunks. Marking a review never commits. |
| Websites | Electron `<webview>` with address bar, history, and external-open fallback. |
| Side chats | Separate conversation and run inside a work tab, inheriting the parent chat's folder at creation. |
| Navigation | Per-chat workspaces, direct document mode, linked-document paths, pins that restore navigation, quick open (Ctrl+K) over tabs, documents, chats, files and actions, Alt shortcuts, adjustable 60/40 split. Everything persists to `workspace.json`. |
| Barkpark | Read adapter (`main/barkpark.js`) over the documented `/v1/data/*` endpoints, or through the installed `bp` CLI so no token is copied into Barkdown. Papers appear in the library as read-only and can be imported into the local library. Writes go through the fenced bulldocs ops endpoint and are **off** unless enabled in Settings. |

## What is not there yet

- No T3 Code runtime import. The assistant loop is Barkdown's own, not the audited T3 provider adapters.
- The document editor is Tiptap, not Barkpark's `bp-paper-editor`; Barkpark papers are rendered from their HTML/blocks and edited only as local copies.
- Barkpark search, related and history go through the adapter but were verified only for list, get, backlinks and history through `bp`.
- Unsaved project buffers live in memory for the session; they are not written to a durable store.
- No packaging beyond `npm run dist` (electron-builder, unsigned).

## Verify

```sh
cd app
npm test
```

`tests/agent.test.mjs` drives the agent loop with a scripted Claude client (proposals stay pending, write approvals gate disk writes, path escapes are rejected, cancellation declines pending approvals, offline mode opens named targets, markdown round-trips). `tests/run.mjs` launches the real Electron app with Playwright against a throwaway userData folder and git repository and checks 23 end-to-end behaviours, saving screenshots to `test-results/`.

## Layout

```
main/       Electron main process: window, IPC, documents, files, git, agent, Barkpark adapter, settings
renderer/   index.html, styles.css, src/ (bundled by esbuild into renderer/dist/app.js)
shared/     markdown <-> ProseMirror JSON used by both processes
tests/      unit + Playwright/Electron end-to-end checks
```
