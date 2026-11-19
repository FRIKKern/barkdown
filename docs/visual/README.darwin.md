# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Test runner, scan and a main-process spawn refactor only. Inspected every frame: all within tolerance except settings: assistant (only the per-run temporary folder name in Settings > Command line differs) and side-chat: draft (one anti-aliased pixel). No layout or geometry change.

Source commit: 99c944cf5ee2860a75adf40f687871bc132bff4a; review: docs/visual/reviews/approval-54ad3eb67fd710b586665f14a70aa538051a23434a79bf3dc3af51634b387eec.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T21-36-48-376Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T21-36-48-376Z/adoption.gif)

