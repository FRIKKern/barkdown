# Barkdown agent instructions

Read `docs/NEXT-AGENT.md`, `docs/DESIGN-DECISIONS.md`, and the relevant sections of `docs/PRD.md` before changing behavior. The user's latest instructions take precedence. This is a private product handoff, not a connected application.

## Preserve the product model

- Barkdown stays app-wide. Working folders belong to agents in individual chats. Do not add an active-project selector to the global sidebar or make file navigation silently change an agent's folder.
- Documents are above recent chats. No dedicated Agents section, permanent ready/status row, or Follow toolbar.
- Chat is 60% of the working width by default. Browser-like work tabs occupy the right side and can contain documents, websites, reviews, project files, or side chats.
- Each chat remembers its own tabs, drafts, paths, and agent context. Direct document navigation opens without expanding a chat panel.
- Pins restore navigation and the exact path. They do not create a fixed extra sidebar, revert content, or repeat actions.
- Avoid visible scrollbar tracks and collapsed vertical pane rails. Preserve scrolling and keyboard reachability.
- Reuse Barkpark's real Paper editor and PortableDoc operations. The concept's `contenteditable`, textareas, timers, and simulated saves are not a production editor or runtime.

## Work from the right source

`concepts/workspace.html` owns the current shell. `concepts/editor-study.html` owns detailed editor interactions only; its older navigation loses conflicts with the current shell. `docs/prd.source.html` generates `docs/PRD.md` and the HTML plan. Rebuild generated outputs with `npm run build`.

Types in `docs/contracts/workspace.ts` are proposals. Audit actual upstream APIs and runtime-validate persisted or remote data. Do not invent endpoint support, CRDT guarantees, or save acknowledgements.

Keep credentials and real content out of the handoff. Do not enable public hosting or change repository visibility without a new user instruction. Publishing updated code to this private repository is within this repository's intended workflow.

## Implementation workflow

Create a `codex/` branch for subsequent implementation work. Do not switch branches or alter unrelated files in the sibling Barkpark checkout. Do not run destructive cleanup commands; use recoverable trash if cleanup is necessary. No production deployment is part of this handoff.

Run `npm ci`, install Playwright Chromium, then `npm run verify`. Add production integration checks as real adapters are built; concept tests alone cannot prove production behavior. Keep CI and generated outputs consistent. Commit and push work, report exact validation and limitations, and update the handoff when a milestone changes status.

Do not install or copy the paid Tiptap Notion template by default. It is an interaction reference. Preserve upstream and dependency licenses when code is introduced.
