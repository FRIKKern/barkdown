# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, this session). Inspected the 2026-09-29T06-44-41-653Z comparison: 46 frames within tolerance against the darwin baseline (chat dismiss differs by two pixels, no geometry change). The renderer change is the rollback status line in Settings › Barkpark naming the changed Papers after a divergence, outside the fixture tour; proven by app/tests/migration-selection.live.mjs (docs/cycles/evidence/C083/live, the latest -selection run).

Source commit: 83bd2b38c694a08aebc34406cd31538720681434; review: docs/visual/reviews/approval-eb3e256cf0f8ff9bf4698a9f9e8007291dcd99ec379aa1cfb287d1b7726b39d3.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T06-44-41-653Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T06-44-41-653Z/adoption.gif)

