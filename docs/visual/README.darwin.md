# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, this session). Inspected the 2026-09-29T07-13-36-900Z comparison: 46 frames within tolerance against the darwin baseline (four frames differ by two pixels each, no geometry change). The renderer change is the inline side-by-side comparison under the rollback line in Settings › Barkpark, outside the fixture tour; proven by app/tests/migration-switch-ui.live.mjs (docs/cycles/evidence/C083/live/2026-09-29T07-09-36-896Z-switch-ui, screenshot 05d).

Source commit: 0bcd10d3adaf3a440175e2669489c65e42e1e625; review: docs/visual/reviews/approval-f5d00b76ac58167928167e7071023e17ebd1ec0398776e23617588b672f57305.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T07-13-36-900Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T07-13-36-900Z/adoption.gif)

