# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C089 slice E: 45 frames within tolerance, one small anti-alias difference; the find bar, zoom chip, shield, context menu and download cards appear only on interaction, which the fixtures do not perform.

Source commit: 595460c6c2725b4b3cb3581f781375b061230691; review: docs/visual/reviews/approval-19883a1a7ea9252d5940ab49e000ec15f23563d3a6b018e846d6b7002f3c64cb.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/workspace-4.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/chat-4.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/documents-2.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/retained-4.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/settings-4.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/goals-8.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/profiles-3.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-02T14-49-42-447Z/adoption-5.png)

![Recorded interaction](runs/2026-10-02T14-49-42-447Z/adoption.gif)

