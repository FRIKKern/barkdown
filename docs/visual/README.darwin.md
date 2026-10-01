# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). Narrow frames (workspace, profiles) gain the Pages button in the context bar; 43 frames within tolerance, geometry unchanged; full-width context bar verified unshifted after the specificity fix (5269d505).

Source commit: 5269d5053a51ca201f593a7ec579f10255c26ea9; review: docs/visual/reviews/approval-22ba86a39c945214accd4c08d0cd14cfb299dd66d92666fbd151154515ff4ad6.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/workspace-4.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/chat-4.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/documents-2.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/retained-4.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/settings-4.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/goals-8.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/profiles-3.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-01T22-43-37-514Z/adoption-5.png)

![Recorded interaction](runs/2026-10-01T22-43-37-514Z/adoption.gif)

