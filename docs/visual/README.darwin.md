# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Opus 5.5 (agent). Electron 38 → 44 (Chromium 140 → 152): all 46 frames within tolerance, geometry unchanged; the engine upgrade moves no pixels beyond tolerance.

Source commit: beccf50362c78c5629e61c7486a2e65033c0663d; review: docs/visual/reviews/approval-11450506b8a5cf7cb8bca8f1ba70f4a7e7514dc3bce9b6cb2f403724d319e690.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/workspace-4.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/chat-4.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/documents-2.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/retained-4.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/settings-4.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/goals-8.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/profiles-3.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-02T12-23-13-903Z/adoption-5.png)

![Recorded interaction](runs/2026-10-02T12-23-13-903Z/adoption.gif)

