# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, this session). Inspected the 2026-09-29T05-29-10-488Z comparison: 46 frames, every one within tolerance against the darwin baseline (side-chat open differs by two pixels, no geometry change). The renderer change this covers is text in the preparation notice and the rollback confirm sheet plus a Restart button that the fixture tour does not reach; the behavior is proven by app/tests/migration-switch-ui.live.mjs (docs/cycles/evidence/C083/live/2026-09-29T05-23-42-582Z-switch-ui).

Source commit: 354c0b6e4b11ab5e2c018761e31f7bbf0bdc4818; review: docs/visual/reviews/approval-4232a40b813e47474337957bbc89afe4e31e639a64650c538806b0aa8b4b0051.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T05-29-10-488Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T05-29-10-488Z/adoption.gif)

