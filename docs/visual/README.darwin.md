# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C088 S2: Settings › Assistant gains a Tool field per provider showing the found path and version (settings: assistant, geometry changed as expected). retained: interrupted, goals: worker-chat and goals: planned/running/paused/restore differ only in relative-time text and a one-pixel dot; no other geometry change.

Source commit: 8108e50b75c92b5119c37574d2d5ecdf1abe860a; review: docs/visual/reviews/approval-0b0b2e47a72ea7c8c26742eb91b5e06abcfdbaac4811cfd4ccbe19002c32f530.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/workspace-4.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/chat-4.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/documents-2.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/retained-4.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/settings-4.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/goals-8.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/profiles-3.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-01T10-18-28-806Z/adoption-5.png)

![Recorded interaction](runs/2026-10-01T10-18-28-806Z/adoption.gif)

