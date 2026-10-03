# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). Terminal key handling changed (Windows copy and paste keys); nothing is drawn differently. The four differing frames are a single cursor pixel each.

Source commit: 0b9953891e66b66ca7cba5a6309f6e5d9904f7c6; review: docs/visual/reviews/approval-c46f05519823f02e807cc3f2f0e7756c55623f7c4096fd8d74322cd5fba7d1f0.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T20-01-14-853Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T20-01-14-853Z/adoption.gif)

