# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). Renderer text change only: the preparation release notice names a completed switch or rollback instead of a cancellation, in a state the tour does not enter. All 45 frames within tolerance against the 2026-09-29T01-42-22 darwin baseline; comparison report inspected. Limits: darwin only.

Source commit: 596639e1f5c41e62cc0ed99d6f3b54efea095aae; review: docs/visual/reviews/approval-decb3f29886ea8ecab9d59f9daba33f8b30ba6740231e522848ca0385414de7d.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/settings-3.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T01-54-31-353Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T01-54-31-353Z/adoption.gif)

