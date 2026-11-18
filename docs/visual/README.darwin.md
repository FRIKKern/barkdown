# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Fence fix in app/shared/chat-menu.js (Markdown for Save as a note / Export; nothing drawn changes). Compared with the approved run 2026-11-18T06-18-06-358Z: every frame within tolerance except workspace narrow and side-chat ready (a few anti-aliased pixels at the send button corner) and settings assistant (the temporary CLI path). No app change visible.

Source commit: ac163fb18d3744de802d6b727774f6b9197457cd; review: docs/visual/reviews/approval-0536ed18b2e5e1137f32846f591307589b190aef5d0e63c434a711f355a6a178.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T07-09-59-606Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T07-09-59-606Z/adoption.gif)

