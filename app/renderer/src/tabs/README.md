# Work-tab health

Each tab displays an exact destination in its owning chat and profile. File navigation does not change the agent's folder. Async loading, saving and editor presentation must preserve newer human input.

![Unavailable file with draft recovery](../../../../docs/visual/project-file-authority/runs/2026-09-22T03-49-16-379Z/02-unavailable.png)

Original C024 Electron evidence: an unavailable destination has no write authority, while **Return to a.md** restores the retained draft. The [file gallery](../../../../docs/visual/project-file-authority/README.md) includes narrow layout, motion, exact source and behavior assertions.

| Host | Evidence and boundary |
|---|---|
| Project files | [File authority](../../../../docs/visual/project-file-authority/README.md), [profile-switch buffer guard](../../../../docs/visual/project-buffers/README.md). Unsaved buffers remain session-only. |
| Real Paper | [Save recovery](../../../../docs/visual/paper-save/README.md), [human takeover](../../../../docs/visual/rich-takeover/README.md), [HTML table paste](../../../../docs/visual/html-table-paste/README.md). Editor behavior belongs upstream; do not replace it with a simulated editor. |
| Local documents | [Legacy editor tour](../../../../docs/visual/documents/README.md). Retain originals until the complete P2 migration gate passes. |
| Terminal | [Owned-process evidence](../../../../docs/visual/terminal-ownership/README.md). Closing UI alone does not prove descendant shutdown. |
| Side chats | [Full conversation controls](../../../../docs/visual/side-chat/README.md). Saved conversation identity and parent links survive tab closure. |

For Paper changes, test acknowledged revisions, native Undo/Redo, human takeover and actual reload. For file changes, test failed opens, late reads, a save resolving after newer typing, and declined conflicts. Preserve failed evidence. Follow the [visual rules](../../../../docs/visual/RULES.md), and use the [integration handoff](../../../../docs/cycles/C008-integration.md) for current gate status.

## Changelog

- 22 September: imported C024 file-authority recovery with its original reviewed stills and motion. C016 reading-position and newer clipboard/history work retain separate source and validation records until integrated.
