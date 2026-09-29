# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). Input-only change: app/BARKPARK_REF and the vendored editor provenance moved to upstream 4532a25ea with byte-identical editor assets. All 46 frames within tolerance against the 2026-09-29T02-02-28 darwin baseline (two-pixel anti-aliasing on send buttons). Limits: darwin only.

Source commit: 04b3e31d47e953404d7e75c78aa3e89466fdcd99; review: docs/visual/reviews/approval-0b50b368013549a2190f87b1d4fed8641cfac0bf43c90e4f3e678aa6d69089d3.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T03-01-01-669Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T03-01-01-669Z/adoption.gif)

