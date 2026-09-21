# Accepted design decisions

These record the user's decisions through the private handoff. Preserve the intent, even when the production implementation differs from the concept's internals. The latest user instruction always supersedes this record.

| ID | Decision | Observable behavior |
|---|---|---|
| D01 | Barkdown combines conversational work and structured documents. | Start from chat or a document; keep the related work within reach. |
| D02 | Use Barkpark's existing capabilities. | Reuse Paper, PortableDoc, content types, references, media, revisions, permissions, and search. Do not build a disconnected document store. |
| D03 | T3 Code is the intended desktop/runtime foundation. | Audit and pin upstream before import; retain its execution boundaries. This handoff itself has no runtime fork yet. |
| D04 | Barkdown is app-wide. Agents work in folders. | No active filesystem project at the top of the app sidebar. Switching chats changes agent context, not the global document/chat navigation. |
| D05 | Documents first in the sidebar; recent chats below. | A compact library above app-wide conversation recents, without an Agents section. |
| D06 | A compact Notion-like top is desirable. | Use compact navigation and work tabs; avoid duplicated title/status rows. |
| D07 | Main chat has priority. | Default to 60% chat / 40% work area after subtracting the sidebar; allow adjustment. Keep chat plus the latest work when possible. |
| D08 | Work tabs are browser-like and typed. | The right workspace can host documents, websites, code reviews, project editors, and independent side chats. The + action opens these types. |
| D09 | Every main chat owns its workspace. | Switching chats restores tabs, active target, document paths, drafts, scroll, and agent context. |
| D10 | Linked documents open to the right within their document tab. | Retain the source path. Collapse earlier document panes based on available width; they remain reachable from the tab/path navigation. |
| D11 | Direct document navigation is quiet. | Clicking a sidebar document opens it without an expanded chat or agent panel. |
| D12 | The UI can follow AI work from chat. | Activity references a typed target. Open the corresponding work tab or mark it updated. Manual navigation or typing pauses automatic focus. |
| D13 | No permanent “Ada ready” or Follow/title row. | Actor information belongs in messages, activity, and edits. A contextual “Go to latest activity” action is enough. |
| D14 | Editing feels like Notion. | Direct text editing, block controls, slash insertion, selection formatting, and attached type menus. Preserve text selection and menu focus. |
| D15 | The Types submenu is attached. | It travels with its parent selection menu, flips at pane edges, and remains open while selecting a type. It is not a floating unrelated menu. |
| D16 | Hide scrollbar tracks and collapsed vertical tabs. | Content still scrolls with mouse, touch, and keyboard. No vertical “earlier panes” strips consuming space. |
| D17 | Tab hover or keyboard focus exposes pin/close. | Both remain reachable by touch and keyboard. Closing a view does not delete its content or cancel a run. |
| D18 | Pins restore the exact route. | A right-side Pins dropdown restores the chat, work tabs, focused destination, document path, reading anchors, and layout. |
| D19 | Pins are navigation snapshots. | No extra pinned sidebar, no content rollback, no repeated agent actions. Unavailable paths remain visibly unavailable. |
| D19a | Favorites supersede pins (2026-09-19). | D18 and D19 are superseded: a pin snapshotted a whole workspace route and could only be restored into its own chat. A favorite bookmarks one tab (document, paper, website, file, review, terminal or side chat) and reopens it from any chat, after the tab was closed, by name. Tabs rename in place; a side chat's tab name is its title, a document tab's name is the document title. |
| D20 | Agent context is local to the conversation. | A compact composer control shows the working folder. Side-chat agents inherit that context when created. File viewing does not silently rebind a run. |
| D21 | Open the agent's project as an editor. | A chat action or working-folder menu opens files on the right. Expand if needed; Back to chat restores the conversation and split. |
| D22 | Start a chat from the current file's folder. | Create a new chat whose agent uses that folder, retaining the original chat and unsaved buffers. |
| D23 | Search and the content graph are central. | Search real permitted content and media; open the exact source; distinguish stored references/backlinks from ranked suggestions. |
| D24 | Prototype before full application delivery. | Preserve working interaction studies and an implementation-ready PRD. Do not present simulated actions as production integration. |
| D25 | Menus anchor to their control; questions are in-app dialogs. | A popup opens where its control is (below a toolbar button, above a composer chip) and never at a fixed window corner; all menus share one dismissal policy. Electron has no `window.prompt`, so nothing in the renderer calls `prompt()` or `confirm()`: page titles, names, model ids, link addresses and confirmations use the app's own dialog sheet. Settings is a sectioned sheet (General, Assistant, Barkpark, Shortcuts, About) with app-styled controls; appearance previews live and reverts on Cancel. |

**D26 (2026-09-21): Resizable sidebar.** Drag the left sidebar’s right edge to resize it; remember the width across restarts. Arrow keys adjust the focused edge, and double-click restores the default. Keep enough room for the active workspace.

**D27 (2026-09-21): People organize Pages.** Cloud discovery stays in a separate, initially collapsed Cloud archive. Opening a paper does not place it in Pages. People explicitly add, nest, reorder, or import a local copy; refresh and disconnect preserve that arrangement. The approved one-time migration moves legacy loose cloud roots into Cloud archive, preserves nested groups, and records the previous root order for recovery.

**D28 (2026-09-21): Direct assistant editing with visible intent.** Document edits apply without a Keep step. Mark the target, move an agent caret, and reveal replacement text in the real editor. Show only actual acknowledged changes, allow immediate human takeover, honor reduced motion, and skip animation in hidden panes. Offer revision-checked Undo. This supersedes review-before-apply for new document edits; file/command permissions and disabled cloud writes retain their existing scope.

**D29 (2026-09-21): Composer history.** Up from the first visual line recalls up to 100 sent messages in that conversation. Down from the last visual line moves forward and restores the original draft and caret. Preserve normal multiline navigation, text selections, modifiers and IME. Main and side chats keep independent histories. Save the original unsent draft while browsing so restart cannot lose it.

## Explicitly superseded directions

- The earlier proposal for a permanently visible pinned sidebar is superseded by the Pins dropdown that restores a path.
- The earlier “one top tab per document pane” model is superseded **in chat mode** by typed work tabs, each document tab retaining its internal path.
- A global project selector and a program-wide working directory are superseded by per-agent working context.
- Earlier status chrome, visible scroll tracks, and collapsed vertical rails must not return when implementing responsive layouts.
- The old editor study still demonstrates detailed editing behavior, but its shell is not the current navigation specification.

## Recommendations that are not settled user decisions

The PRD proposes Windows for the first pilot, one existing provider adapter, review-before-apply for initial agent changes, and one active Barkpark connection for the first connected slice. These are starting assumptions to validate, not permanent platform/provider restrictions. The exact T3 import baseline, persistence engine, native file editor component, browser host, commercial-template entitlement, and searchable-chat storage are unresolved.

## Direction set 2026-09-20

- **D-editor:** the standing goal is that the Barkpark canvas becomes as good as the Tiptap document tab, measured by the matrix in [EDITOR-PARITY.md](EDITOR-PARITY.md); when every row is green the Tiptap tab is deleted and local documents are Barkpark papers. Editor fixes land in the Barkpark repo and reach Barkdown through the connected server's bundle, not a hand copy.
- **D-identity:** Barkdown is a note + agent app utilizing Barkpark. It runs the real Barkpark locally as a sidecar (its own Postgres cluster per profile) rather than reimplementing any of it, and syncs to bp cloud. Profiles may be cloud-backed or local-only; a profile's data must be zippable to another device. This supersedes the earlier assumption of "one active Barkpark connection" as the only mode.
- **D-headings (2026-09-20, plan #22): three heading levels.** Notes offer H1–H3 — what Notion offers, what Barkdown's Tiptap tab offered, and what the Barkpark reader renders (`heading_level/1` folds anything else to H2). The canvas configures `levels: [1, 2, 3]`, the slash menu and the turn-into palette offer exactly those, and `#### ` stays text. A paper that already carries a deeper level (an import, an agent) is never restructured: the level rides the node and round-trips byte-identically. Choosing six would have cost a reader change, three chords and a menu row for a rung Notion users do not reach for; the decision can be revisited if a row shows authors needing it.
