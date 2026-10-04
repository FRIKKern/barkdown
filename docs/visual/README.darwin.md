# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C091: every composer gains the approvals chip ('No approvals' in the warning colour by default), which changes 20 composer frames by a fraction of a percent each; reviewed in workspace: narrow (fits on one row), side-chat: open (both composers, wraps to a second row at 60%) and settings: assistant (the new Approvals row above Providers).

Source commit: b203dbfdfdf6675f1261413d1752b920f91136ad; review: docs/visual/reviews/approval-950333b56a5a3f670ea1ab82eb0c8f5f748f090fd150ecc286278ab64a143497.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/workspace-4.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/chat-4.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/documents-2.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/retained-4.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/settings-4.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/goals-8.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/profiles-3.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-04T10-13-01-090Z/adoption-5.png)

![Recorded interaction](runs/2026-10-04T10-13-01-090Z/adoption.gif)

