# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). PR 159 runtime fence: main-process and launcher change only. 42 shots within tolerance; settings-1 differs only in the random temp-folder name in the Command line path; side-chat-3 differs by about two pixels. Nothing on screen changed.

Source commit: 8531a9a676ad0b6e7ec0c954b0e897b23e77e406; review: docs/visual/reviews/approval-a46a271e7dff966b07ef1ea23e2ac09183ac731d4a7e16f34c82fd435f8dc8e1.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T22-28-59-517Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T22-28-59-517Z/adoption.gif)

