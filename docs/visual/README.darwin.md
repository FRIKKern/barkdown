# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). The terminal's text read changed (wrapped lines join); nothing is drawn differently. The four differing frames are a single cursor pixel each.

Source commit: 516726b74953069f015685eaae5953359b623256; review: docs/visual/reviews/approval-65ed7ea62a5baef0f045edbebf18b94524a543da6d319de32829215e469e547b.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T23-18-56-679Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T23-18-56-679Z/adoption.gif)

