# Barkdown desktop (Electron prototype)

A working desktop app for the Barkdown product: app-wide documents and conversations on the left, a real assistant in the middle, and typed work tabs on the right. Agents work in folders; the app does not.

## Run it

```sh
cd app
npm install
npm start
```

`npm run dev` opens DevTools as well. Requires Node 22.13+ and a desktop session (Electron 38).

The assistant runs on the sign-ins already on your computer, like T3 Code does:

| Provider | Uses | How it works |
|---|---|---|
| **Claude Code** (default when signed in) | Your `claude` login in `~/.claude` | The Claude Agent SDK drives Claude Code with the chat's working folder as `cwd`, Barkdown's document tools attached as an MCP server, and every edit or command routed through an approval card in the chat. Sessions resume per chat. |
| **Codex** | Your `codex login` in `~/.codex` | The Codex SDK runs its bundled CLI sandboxed to the working folder (`workspace-write`, read-only without a folder) with the same MCP server; file changes are applied in the sandbox and shown as activity and in the review tab. Threads resume per chat. |
| **Claude API key** | A key from Settings or `ANTHROPIC_API_KEY` | Barkdown's own streaming tool loop (`main/agent.js`). Without a key it runs offline and only opens what you name. |

Pick the default under **Settings** (Ctrl+,); the composer chip switches the provider per chat. Neither login is copied into Barkdown: the SDKs read the CLI credentials directly.

## What is real

| Area | Implementation |
|---|---|
| Documents | Local library in the Electron userData folder (`documents/*.json` plus a `.md` export). Tiptap block editor with slash commands, an attached Types submenu, links, task lists, autosave with revision history, optimistic-rev conflict handling, references, backlinks, related documents, restore. |
| Assistant | Three providers behind one event stream (`main/providers/`): Claude Code via `@anthropic-ai/claude-agent-sdk`, Codex via `@openai/codex-sdk`, and a raw `@anthropic-ai/sdk` loop (`main/agent.js`). Document tools live in a stdio MCP server (`main/mcp-server.js`): list/search/read documents, propose edits (kept or discarded by you), create documents, show a website or file beside the chat. Each run captures its owner chat and folder; activity events route to that chat's work tabs and respect manual focus. |
| Working folders | Per chat, chosen from the composer. File access is confined to the folder (`main/files.js`). Project editor uses CodeMirror 6 with session buffers, Ctrl+S, and disk-change detection. |
| Code review | `git diff` of the working folder (working tree vs HEAD, or against a chosen commit), rendered per file with hunks. Marking a review never commits. |
| Websites | Electron `<webview>` with address bar, history, and external-open fallback. |
| Side chats | Separate conversation and run inside a work tab, inheriting the parent chat's folder at creation. |
| Navigation | Per-chat workspaces, direct document mode, linked-document paths, pins that restore navigation, quick open (Ctrl+K) over tabs, documents, chats, files and actions, Alt shortcuts, adjustable 60/40 split. Everything persists to `workspace.json`. |
| Barkpark | Read adapter (`main/barkpark.js`) over the documented `/v1/data/*` endpoints, or through the installed `bp` CLI so no token is copied into Barkdown. Papers appear in the library as read-only and can be imported into the local library. Writes go through the fenced bulldocs ops endpoint and are **off** unless enabled in Settings. |

## What is not there yet

- No T3 Code runtime import. The provider adapters are Barkdown's own, built directly on the Claude Agent SDK and Codex SDK rather than T3's audited provider layer.
- Codex edits inside the sandbox are not approval-gated per call (Codex's own `on-failure` policy); Claude Code edits and commands are.
- The document editor is Tiptap, not Barkpark's `bp-paper-editor`; Barkpark papers are rendered from their HTML/blocks and edited only as local copies.
- Barkpark search, related and history go through the adapter but were verified only for list, get, backlinks and history through `bp`.
- Unsaved project buffers live in memory for the session; they are not written to a durable store.
- No packaging beyond `npm run dist` (electron-builder, unsigned).

## Verify

```sh
cd app
npm test
```

`tests/mcp.test.mjs` drives the document MCP server with a real MCP client over stdio. `npm run test:live` (not part of `npm test`, spends real quota) runs one turn on Claude Code and one on Codex with your local sign-ins and checks that both read a document and record a proposal. `tests/agent.test.mjs` drives the API-key loop with a scripted Claude client (proposals stay pending, write approvals gate disk writes, path escapes are rejected, cancellation declines pending approvals, offline mode opens named targets, markdown round-trips). `tests/run.mjs` launches the real Electron app with Playwright against a throwaway userData folder and git repository and checks 23 end-to-end behaviours, saving screenshots to `test-results/`.

## Layout

```
main/       Electron main process: window, IPC, documents, files, git, agent, Barkpark adapter, settings
renderer/   index.html, styles.css, src/ (bundled by esbuild into renderer/dist/app.js)
shared/     markdown <-> ProseMirror JSON used by both processes
tests/      unit + Playwright/Electron end-to-end checks
```
