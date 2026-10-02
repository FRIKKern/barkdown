# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C089 slice A: the nine review-required frames are Settings views whose nav gained the Browser pane (Shortcuts and About shift one row); 37 frames within tolerance, geometry unchanged elsewhere. Tour screenshots in docs/cycles/evidence/C089/live.

Source commit: 61afbf41f928b168e4237874344c5e54e0bf6b31; review: docs/visual/reviews/approval-8b2f91fa4b70735a2536bb8d561a4e522de8beaf8411c1a0489e2df8b5544347.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/workspace-4.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/chat-4.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/documents-2.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/retained-4.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/settings-4.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/goals-8.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/profiles-3.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-02T13-08-18-531Z/adoption-5.png)

![Recorded interaction](runs/2026-10-02T13-08-18-531Z/adoption.gif)

