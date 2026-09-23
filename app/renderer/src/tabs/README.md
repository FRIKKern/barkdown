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

For Paper changes, test acknowledged revisions, native Undo/Redo, human takeover and actual reload. For file changes, test failed opens, late reads, a save resolving after newer typing, and declined conflicts. Preserve failed evidence. Follow the [visual rules](../../../../docs/visual/RULES.md), and use the [current handoff](../../../../docs/NEXT-AGENT.md) for current gate status.

## Changelog

- 23 September, C046: [migrated Paper evidence](../../../../docs/visual/migration/README.md) proves nine native edit/save/Undo cases and restart. Long titles now wrap in narrow panes without changing title-save ownership. The tenth inline-break case remains explicitly refused; this is not migration activation.

- 23 September, C037: [Paper visual polish](../../../../docs/cycles/C037-paper-polish.md) repairs inherited heading spacing and double-rendered code, with smaller headings, readable tasks, compact tables and muted callouts. [Light capture](../../../../docs/images/status/paper-light.1c1f1f10.png), [dark capture](../../../../docs/images/status/paper-dark.3f197809.png), [editing GIF](../../../../docs/images/status/editing.44c0c473.gif). Real save/Undo/retry/discard and narrow layout pass separately in the linked cycle.

- 22 September: imported C024 file-authority recovery with its original reviewed stills and motion. At that earlier checkpoint, C016 reading-position and newer clipboard/history work still awaited integration; the subsequent entry below supersedes that status.

- 22 September, candidate76b07d3: E011 upstream54579 and C016 reading-position source/evidence are imported. [C032 native refusal/restart motion](../../../../docs/visual/folder-preflight/README.md) retains original8b51fbc; C033 has controlled context-race checks only. C023 original final gates passed. Fresh combined review remains pending; historical images above are not promoted. See [historical validation order](../../../../docs/cycles/C008-integration.md#remaining-combined-validation-order). E012 upstream work remains unconsumed.


### Health update — 22 September, audited3ce6b21

- Side-chat and goal-worker tabs display full saved conversations, not disposable subpanels. [C015 worker views](../../../../docs/goals/evidence/61eea4d/README.md), [C020 recovery stills](../../../../docs/visual/coordinator-recovery/README.md) and [C032 main/side refusal/restart GIF](../../../../docs/visual/folder-preflight/README.md) link exact original evidence; their distinct provider/transport scopes remain in those galleries.
- [C016 actual profile-isolation GIF](../../../../docs/visual/profiles/isolation-runs/README.md) covers same-slug ownership, B’s reading position and A-only Undo at34ef068. [C012 recovery stills](../../../../docs/visual/workspace-recovery/README.md) cover unavailable persisted workspace, while C024 above covers individual unavailable project files; neither implies automatic repair.
- [C035 packaged Electron38 gallery](../../../../docs/visual/packaging38/README.md) now proves terminal profile switching, forced application death and restart without replay at89a0fd2, with all four Job receipts stopped. Original videos are available through its motion map; there is no packaged-install GIF claim or clean-machine/bundled-Barkpark claim.
- Full desktop52348 passed at5e8433e, before later C036 capture-tool changes. Final combined dedicated/visual/live/root gates remain pending; these links do not promote original screenshots to newer-source approval.

### C038 — Callout refinement

Real Paper callouts use softly tinted cards, restrained tonal borders and a separate editable title line. All seven tones and native folding remain intact. [Cycle and evidence](../../../../docs/cycles/C038-callout-polish.md) records light/dark/narrow review and real-server editing verification.
