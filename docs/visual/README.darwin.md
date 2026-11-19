# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Only diff: the per-run temp folder name in Settings > Command line; other frames at 1e-6 noise. Chat search by message id adds an invisible data-message-id attribute (no visual change).

Source commit: 85fb92a74c9c1e25197af338486275fbf69ce6a7; review: docs/visual/reviews/approval-05d403b4e56339b6688315044677668a68bf82a903f881a0665f8986098ebaa9.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T08-05-10-488Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T08-05-10-488Z/adoption.gif)

