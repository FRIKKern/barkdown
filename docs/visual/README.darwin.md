# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). macOS run 2026-11-19T20-38-28-146Z at 01622a0c (bp runner with main eeae412e merged; tests and package scripts only, no app source) approved against 2026-11-19T19-23-21-158Z: 41 frames within tolerance; settings-1 differs only in the per-run temp folder name under Settings > Command line; workspace-1 and side-chat-1 by one or two anti-aliased pixels

Source commit: 01622a0c286d2716ff642e4e8bc7da1ef570aee8; review: docs/visual/reviews/approval-8a62d2d69f96e0382028baacfaaef7bb7e0d4de6b5c3a4ca3d039a07df1f2a72.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T20-38-28-146Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T20-38-28-146Z/adoption.gif)

