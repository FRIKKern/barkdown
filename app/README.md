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
| Barkpark papers | The document tab for a paper hosts **Barkpark's own editor**, the vendored `<bp-paper-canvas>` Web Component from `api/assets/paper-editor` (`renderer/vendor`, MIT). Blocks come from the connected server; every edit batch (`bp-canvas-ops`) is applied through `POST /v1/plugins/bulldocs/papers/:slug/ops` with the paper's `ifRev`, acknowledged on success, and the server echo is fed back so minted block ids land. A stale revision returns 412 and surfaces as a conflict card (load theirs, or re-apply yours on top); a network failure keeps the batch for retry. Title edits, backlinks and history use the same connection. HTML-only legacy papers render read-only with a one-click conversion to blocks. Papers appear in the sidebar and quick open, and the assistant reads and proposes on them with ids `bp:<slug>`; kept proposals become fenced ops. |
| Paper editing (Notion parity) | Improvements made in Barkpark's editor source (`barkdown/editor-quality` branch, merged into Barkpark main via PR #19366; rebuilt and vendored here): a hover gutter with `+` (insert below and open the slash menu) and `⋮⋮` (drag to reorder with a drop line, or click for turn-into / duplicate / move / delete); `Ctrl+Shift+↑/↓` moves a block, `Ctrl+D` duplicates it, `Ctrl+K` opens the link row on a selection; `---` becomes a divider and ``` a code block with the caret inside; `/` also works in an empty list item; strikethrough in the format bubble; the bubble and slash menu carry their Studio styles outside Studio; and a fix so lists created in the canvas save their items (they used to reach the server as empty `bulletList` blocks). Barkdown also rewrites the canvas's insert+move batches so servers older than the `move-block` allowlist accept them. |
| Paper look (Notion) | The vendored canvas ships Barkpark's Studio reading theme (tinted ground, serif display type, a 2px rule above every H2, a §-on-a-hairline divider). `renderer/paper-notion.css` rebinds its tokens for Barkdown: the app ground in light and dark, a sans reading face at 16px/1.5 with 30/24/20 headings, 3px block rows, hairline dividers, a flat code slab, gray callouts, a 52px hover gutter left of the text, and the same neutral surface for the slash menu, format bubble and block menu. A paper whose first block is a heading shows it as the 40px title row (Barkpark derives the paper title from it); otherwise the title input stands in. Status sits in the breadcrumb row. Underline (`Ctrl+U`, bubble button) and Notion's turn-into chords (`Ctrl+Shift+0` text, `1`–`3` headings, `5` bulleted, `6` numbered, `8` code block) were added to the canvas in Barkpark, along with `> ` for a quote block (`> [!note] ` still gives a callout), markdown paste (plain text with headings, lists, quotes, fences or rules lands as blocks), autolinked URLs, and Backspace at the start of a first list item or a quote lifting it to text. Checklists exist now: PortableDoc gained `task: true` on the list block with `checked` per item (server render, BPML, markdown import, all in Barkpark), and the canvas mounts them as native checkboxes with `[ ] ` shorthand, a Checklist slash row, block-menu turn-into and `Ctrl+Shift+4`. Turn-into now persists: a block whose kind changes is replaced on the server (same id) instead of patched, since patches cannot change a block's type. `node tests/editor-gaps.live.mjs` replays all of this against the scratch paper and checks the server's block kinds match the canvas. `node tests/paper-shot.mjs` captures light and dark screenshots for a visual check. |
| Keyboard | `Ctrl+W` closes the active work tab (a menu accelerator, so it also works while a website tab has focus); it never closes the window. On macOS the window closes with `Cmd+Shift+W`. |
| Images in chat (as T3 Code) | Paste an image into the prompt, drop one on the composer, or pick with the attach button. Thumbnails show above the prompt with a remove control and survive switching chats; PNG, JPEG, GIF and WebP up to 20 MB, downsized to 2400px on the long side. Each image is saved under `userData/barkdown/attachments` so chats keep a path, and it travels with the message: base64 image blocks in a streamed user message for Claude Code, `local_image` inputs for Codex, and image blocks ahead of the text for the API loop. Sent images render in the message and open in a lightbox. `node tests/image.live.mjs` sends a solid red PNG to each login and expects the reply to name the colour. |
| Chats know about each other | A side chat's run opens with a `[Workspace context]` note carrying the main conversation's latest exchanges and open tabs; a main chat's run gets a line per side chat with its last question and reply. Every provider also has `list_conversations` and `read_conversation` (MCP tools for Claude Code and Codex, native tools in the API loop) to read any other chat's transcript, including what each reply opened or used. The workspace is written to disk before each run so the note is current. `node tests/sidechat.live.mjs` asks a side chat what the main chat is about on each login. |
| Verbose transcript (as Claude Code's app) | Messages are plain: your text in a quiet rounded box, replies as prose under a one-line byline. Every tool call is an expandable step: a command opens to `$ command` plus its full output, an edit opens to a red/green line diff of the old and new text, a write shows the written lines, other tools show their input and result. Under each reply a change card lists every file and document touched with `+added −removed` counts (Codex reports kinds only), **View** opens the file or document, **Undo** restores a tracked file from git or removes a new one (confirmed first). Model and effort chips in the composer pick, per chat, the model (Opus 5, Sonnet 5, Haiku 4.5, GPT-5 Codex, or any id) and the reasoning effort the provider supports; both ride into the run. `shared/changes.js` holds the diff and summary logic, unit-checked in `tests/changes.test.mjs`. |
| Terminal tab | A work tab running a shell in the chat's working folder (PowerShell on Windows, the login shell elsewhere) over pipes, so commands, builds and scripts work but full-screen interactive programs do not. Output streams as it arrives, ↑/↓ recall history, Ctrl+C on an empty line restarts the shell. Every command the assistant runs in that chat is mirrored into the tab with its output as it happens. |
| Local documents | Local library in the Electron userData folder (`documents/*.json` plus a `.md` export). Tiptap block editor with slash commands, an attached Types submenu, links, task lists, autosave with revision history, optimistic-rev conflict handling, references, backlinks, related documents, restore. |
| Assistant | Three providers behind one event stream (`main/providers/`): Claude Code via `@anthropic-ai/claude-agent-sdk`, Codex via `@openai/codex-sdk`, and a raw `@anthropic-ai/sdk` loop (`main/agent.js`). Document tools live in a stdio MCP server (`main/mcp-server.js`): list/search/read documents, propose edits (kept or discarded by you), create documents, show a website or file beside the chat. Each run captures its owner chat and folder; activity events route to that chat's work tabs and respect manual focus. |
| Working folders | Per chat, chosen from the composer. File access is confined to the folder (`main/files.js`). Project editor uses CodeMirror 6 with session buffers, Ctrl+S, and disk-change detection. |
| Code review | `git diff` of the working folder (working tree vs HEAD, or against a chosen commit), rendered per file with hunks. Marking a review never commits. |
| Websites | Electron `<webview>` with address bar, history, and external-open fallback. |
| Side chats | Separate conversation and run inside a work tab, inheriting the parent chat's folder at creation. |
| Pages | The sidebar is a Notion-like page tree, not a flat list: nested pages with expand/collapse, drag and drop to reorder or nest (drop on the edges to reorder, on the middle to nest), hover actions for sub-pages, a context menu (sub-page, move to archive, open beside chat, delete), and breadcrumbs in the document header. Pages can be local documents or Barkpark papers. Everything not placed in the tree sits in a collapsed **Archive** below with a filter, from which any item can be pulled up into the tree. The tree persists with the workspace (`renderer/src/pages.js`). |
| Navigation | Per-chat workspaces, direct document mode, linked-document paths, pins that restore navigation, quick open (Ctrl+K) over tabs, documents, chats, files and actions, Alt shortcuts, adjustable 60/40 split. Everything persists to `workspace.json`. |
| Barkpark | Read adapter (`main/barkpark.js`) over the documented `/v1/data/*` endpoints, or through the installed `bp` CLI so no token is copied into Barkdown. Papers appear in the library as read-only and can be imported into the local library. Writes go through the fenced bulldocs ops endpoint and are **off** unless enabled in Settings. |

## What is not there yet

- No T3 Code runtime import. The provider adapters are Barkdown's own, built directly on the Claude Agent SDK and Codex SDK rather than T3's audited provider layer.
- Codex edits inside the sandbox are not approval-gated per call (Codex's own `on-failure` policy); Claude Code edits and commands are.
- Local documents still use Tiptap 3 while Barkpark papers use the real Barkpark canvas; they are not yet one editor. The canvas bundle is vendored from the sibling checkout at commit `8dca3402` rather than built from source.
- Barkpark search, related and history go through the adapter but were verified only for list, get, backlinks and history through `bp`.
- Unsaved project buffers live in memory for the session; they are not written to a durable store.
- No packaging beyond `npm run dist` (electron-builder, unsigned).

## Verify

```sh
cd app
npm test
```

`npm run test:paper` (live, needs the bp connection) opens the scratch paper `barkdown-editor-test` on the connected server in the Barkpark canvas, types into it, checks the revision and text on the server, injects an external edit to force a 412, and verifies the conflict card plus re-apply keep both edits. `tests/paper-proposal.live.mjs` makes an agent proposal on a paper through the MCP server and keeps it from the paper tab. `tests/portabledoc.test.mjs` covers the markdown, blocks and ops conversions. `tests/mcp.test.mjs` drives the document MCP server with a real MCP client over stdio. `npm run test:live` (not part of `npm test`, spends real quota) runs one turn on Claude Code and one on Codex with your local sign-ins and checks that both read a document and record a proposal. `tests/agent.test.mjs` drives the API-key loop with a scripted Claude client (proposals stay pending, write approvals gate disk writes, path escapes are rejected, cancellation declines pending approvals, offline mode opens named targets, markdown round-trips). `tests/run.mjs` launches the real Electron app with Playwright against a throwaway userData folder and git repository and checks 23 end-to-end behaviours, saving screenshots to `test-results/`.

## Layout

```
main/       Electron main process: window, IPC, documents, files, git, agent, Barkpark adapter, settings
renderer/   index.html, styles.css, src/ (bundled by esbuild into renderer/dist/app.js)
shared/     markdown <-> ProseMirror JSON used by both processes
tests/      unit + Playwright/Electron end-to-end checks
```
