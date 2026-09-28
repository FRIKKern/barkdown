# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). Shortcuts pane and quick-open hints show ⌘ and ⌥ on macOS (the app already accepted either modifier). Inspected settings shortcuts (ratio 0.0027) and workspace quick-open (ratio 0.0002); every other frame within tolerance.

Source commit: be431235dfc0eccbba0dd247df640a4f0d693f3e; review: docs/visual/reviews/approval-411681d20c69bfb491c59cb4fa1fd48c372d2e981365a701db66427f021c78b9.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/workspace-4.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/chat-4.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/documents-2.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/documents.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/settings-3.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/goals-8.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/profiles-3.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-28T20-36-00-746Z/adoption-5.png)

![Recorded interaction](runs/2026-09-28T20-36-00-746Z/adoption.gif)

