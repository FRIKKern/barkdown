# Barkdown

**A desktop workspace for conversations, documents, and the work happening between them.**

Barkdown combines a ChatGPT-like conversation workspace with Notion-like document editing, using Barkpark for structured content, relationships, media, search, and revision history. The intended desktop foundation is a T3 Code fork.

This private repository is the **v0.5 product and engineering handoff**. It includes the actual interactive concept code and a detailed implementation plan. It does not yet contain the T3 runtime, a packaged desktop application, a live AI connection, or a connected Barkpark editor.

![Current Barkdown concept: app-wide sidebar, wide chat, document work tab](docs/images/prd-workspace-tabs.png)

## Desktop prototype (Electron)

The `app/` folder contains a working Electron prototype built from this handoff: a real Tiptap document library with revisions and backlinks, a Claude-powered assistant with document proposals and approval-gated file writes, per-chat working folders with a CodeMirror project editor, git diff reviews, website tabs, side chats, pins, quick open, and a read-only Barkpark adapter. See [app/README.md](app/README.md) for how to run and verify it, and what is still simulated.

```sh
cd app && npm install && npm start
```

## Start here

1. Read the [product requirements](docs/PRD.md).
2. Read the [next-agent handoff](docs/NEXT-AGENT.md), including the first milestone and known limitations.
3. Keep the [accepted design decisions](docs/DESIGN-DECISIONS.md) open while implementing.
4. Use the [architecture and integration plan](docs/ARCHITECTURE.md), [typed proposal](docs/contracts/workspace.ts), and [source map](docs/SOURCE-MAP.md).
5. Follow [acceptance and delivery](docs/ACCEPTANCE.md) before calling a production milestone complete.

The central rule: **Barkdown is app-wide. Agents have working folders.** The sidebar is not scoped to an active filesystem folder. Each chat carries its agent’s working context; a project editor is a work tab within that conversation.

## Open the handoff without installing anything

Clone or download this private repository, then open:

- `preview/index.html` — the current mixed work-tab concept.
- `preview/editor.html` — the earlier, richer document editing interaction study.
- `preview/prd.html` — the illustrated, self-contained product plan.

These pages embed their icons and need no network requests. GitHub displays HTML as source; download or open locally to interact with it. No public website or GitHub Pages deployment is configured.

## Develop and verify the handoff

Use Node.js 22.13.1 or newer and npm. These requirements apply to this handoff; the proposed T3 baseline has its own toolchain.

```sh
npm ci
npx playwright install chromium
npm run verify
npm run preview
```

Open `http://127.0.0.1:4173`. Stop the local preview with Ctrl+C. For Linux environments, Playwright may require `npx playwright install --with-deps chromium`.

To use an already installed browser for verification, set `BARKDOWN_BROWSER_CHANNEL=msedge` or `chrome` in your shell. Default verification uses Playwright’s Chromium. An installed desktop browser is optional.

`npm run build` regenerates the three portable preview pages, GitHub-readable PRD, and artifact hashes. `npm run check` checks the proposed types, source syntax, local links, and handoff consistency. `npm test` exercises the concepts, including folder context, editing, drafts, pins, agent focus, menus, and narrow layouts.

## Source ownership

| File | Role |
|---|---|
| `concepts/workspace.html` | Authoritative current app shell, chat/work tabs, agent folder controls, file editor, pins, and simulated AI activity. |
| `concepts/editor-study.html` | Authoritative interaction reference for block editing, selection formatting, attached Types submenu, and inline AI changes. Its older shell is superseded. |
| `docs/prd.source.html` | Editable source of the PRD. |
| `docs/PRD.md`, `preview/*.html` | Generated deliverables; edit their sources, then rebuild. |
| `docs/contracts/workspace.ts` | Checked design proposal for state and adapter boundaries, not a production protocol. |
| `tests/` | Repeatable concept checks. |
| `evidence/` | Source provenance, hashes, and the checked handoff baseline. |

## Try the intended behavior

Open a document, website, review, project editor, or side chat with **+** beside the work tabs. Chat starts at 60% of the available working width. Editing or choosing a tab pauses automatic following. **Watch AI work** demonstrates scripted activity; **Go to latest activity** resumes following.

Use the folder chip in the chat composer to inspect the agent’s working folder or open the project editor. **New chat in this folder** creates a conversation with that agent context. **Back to chat** restores the wider conversation. Hover or focus a tab to pin its navigation path, then restore it from **Pins**.

Drag the divider between chat and work tabs to adjust the split (double-click resets to 60%; arrow keys work when it is focused). Press **Ctrl+K** for quick open: jump to any work tab, document, recent chat, new tab type, or action by typing part of its name. **Alt+1–9** switches tabs, **Alt+W** closes the active one, **Alt+N** opens the type menu, and a middle-click closes a tab. **Enter** sends a message, **Shift+Enter** adds a line. A small **Working…** pulse beside the composer shows while the scripted agent runs, and a red dot on the project tab marks unsaved file drafts.

In the editor study, open a document directly from the sidebar, select text, and open **Types**. The attached submenu and block interactions are the editing target for the real Paper integration.

All edits, pins, reviews, replies, and file buffers in these concepts are local, in-memory demonstrations. Reloading resets them. “Store in demo” does not write a repository file.

## Delivery status

See [VALIDATION.md](docs/VALIDATION.md) for the exact checks run and [SOURCE-MAP.md](docs/SOURCE-MAP.md) for immutable upstream references. The first implementation milestone is one real Barkpark Paper mounted, edited, saved, and reopened inside an audited T3-derived desktop shell.

Original Barkdown material has no public open-source license in this handoff. Private visibility is intentional. Third-party notices are in [THIRD-PARTY.md](THIRD-PARTY.md).
