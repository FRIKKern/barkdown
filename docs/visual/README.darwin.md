# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, this session). Inspected the 2026-09-29T08-38-54-371Z comparison: 46 frames within tolerance against the darwin baseline (two frames differ by two pixels each, no geometry change). The renderer change adds Keep on Paper and a two-click Restore staged text under each changed Paper in Settings › Barkpark, outside the fixture tour; proven by app/tests/migration-switch-ui.live.mjs (docs/cycles/evidence/C083/live/2026-09-29T08-34-47-447Z-switch-ui, screenshot 05e).

Source commit: 58e58536ddb6ecb0a87e9f02d0109c6cf19ae530; review: docs/visual/reviews/approval-a287427ce0c2fb098ea0dc78d0845b67b412bf02e999d779e336f4d8febc87ce.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T08-38-54-371Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T08-38-54-371Z/adoption.gif)

