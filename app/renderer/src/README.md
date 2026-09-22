# Workspace and conversation health

The shell stays app-wide. Working folders belong to individual chats. Main chats and side chats share the composer and transcript controls; switching profiles must replace the owned workspace without carrying another profile's drafts or results.

![Workspace fixture](../../../docs/visual/runs/2026-09-22T02-13-13-738Z/workspace-0.png)

This retained fixture illustrates the shell at its recorded source. Use the [workspace gallery](../../../docs/visual/workspace/README.md) for the currently approved tour and its changelog. A fixture image does not prove provider execution or persistence.

| Area | Review before changing behavior |
|---|---|
| Sidebar, tabs, quick open and favorites | [Workspace](../../../docs/visual/workspace/README.md) and [accepted decisions](../../../docs/DESIGN-DECISIONS.md) |
| Composer, history, attachments and transcript | [Main chat](../../../docs/visual/chat/README.md), [side chat](../../../docs/visual/side-chat/README.md), [actual recovery](../../../docs/visual/chat-recovery/README.md) |
| Settings and profile switching | [Settings](../../../docs/visual/settings/README.md), [profiles](../../../docs/visual/profiles/README.md), [A1 evidence](../../../docs/cycles/A1-current-evidence.md) |
| Goal planning and workers | [Component tour](../../../docs/visual/goals/README.md), [actual coordinator recovery](../../../docs/visual/coordinator-recovery/README.md) |
| Document and file hosts | [Tab health](tabs/README.md) |

Keep human-organized Pages, the separate Cloud archive, the 60% default chat width and per-chat navigation. Closing a side-chat tab does not delete its conversation. Persist the original unsent draft while browsing history. Use owner/generation checks for asynchronous work; never infer ownership from whichever chat is visible when a promise settles.

Source changes trigger the [capture, comparison and named review workflow](../../../docs/visual/RULES.md). Inspect intermediate states, narrow widths, keyboard focus and menus. Pair those images with actual send, restart and save checks; the [integration handoff](../../../docs/cycles/C008-integration.md) distinguishes original lane evidence from combined approval.

## Changelog

- 22 September: linked shell, conversation and recovery evidence beside the owning code. Pending native journeys and combined validation remain explicit in the integration handoff.
