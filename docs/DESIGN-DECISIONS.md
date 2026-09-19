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

## Explicitly superseded directions

- The earlier proposal for a permanently visible pinned sidebar is superseded by the Pins dropdown that restores a path.
- The earlier “one top tab per document pane” model is superseded **in chat mode** by typed work tabs, each document tab retaining its internal path.
- A global project selector and a program-wide working directory are superseded by per-agent working context.
- Earlier status chrome, visible scroll tracks, and collapsed vertical rails must not return when implementing responsive layouts.
- The old editor study still demonstrates detailed editing behavior, but its shell is not the current navigation specification.

## Recommendations that are not settled user decisions

The PRD proposes Windows for the first pilot, one existing provider adapter, review-before-apply for initial agent changes, and one active Barkpark connection for the first connected slice. These are starting assumptions to validate, not permanent platform/provider restrictions. The exact T3 import baseline, persistence engine, native file editor component, browser host, commercial-template entitlement, and searchable-chat storage are unresolved.
