# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude (agent). Inspected every frame. settings-1: only the random /private/tmp/barkdown-visual-* folder name in the command-line path changed. workspace-3: one anti-aliased pixel at the send button corner. No layout or content change; the boot change (chats drawn before the library) does not alter settled frames.

Source commit: 6e8683bc55b7dc14c03ae2ad6b1ae790f112e0fc; review: docs/visual/reviews/approval-2999bb7d79b8278a049dfa04275608c08c49a394f5a816dfc7c949d93e1849d5.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/workspace-4.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/chat-2.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/documents-2.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/retained-4.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/settings-4.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/goals-8.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/profiles-3.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-26T23-23-52-319Z/adoption-5.png)

![Recorded interaction](runs/2026-10-26T23-23-52-319Z/adoption.gif)

