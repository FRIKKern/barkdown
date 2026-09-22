# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T00-23-29-485Z/README.md).

Reviewed by Codex root integration review. Inspected all37 actual candidate stills in eight area sheets, including menus, both themes, full side chats, narrow profile/goal/adoption recovery views. All comparisons have zero above-tolerance pixel/geometry changes versus preceding combined baseline. No new clipping or displacement observed. These are reduced-motion fixture steps, not live Paper or credential durability evidence; dedicated actual crash tests and live captures remain separate. Full combined desktop44785 is still running; prior466dfd9 full suite and rebuilt7248ef8 delayed-startup draft regression passed.

Source commit: 82cc6229a4c67900d111cd1a700d369b8b757e5f; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T00-23-29-485Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T00-23-29-485Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T00-23-29-485Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T00-23-29-485Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T00-23-29-485Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T00-23-29-485Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T00-23-29-485Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-22T00-23-29-485Z/adoption.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.

## Aligned Markdown table paste — original E006 evidence

[Reviewed paste, save, Undo, redo and reload journey](markdown-paste/README.md) is imported from editor evidence `d2e356c`, captured against Barkdown `c22c0d3` and upstream `9803bbe5e`. It is original lane evidence; combined integration verification remains pending. The upstream mounted JSDOM save-ack baseline failure remains documented.
